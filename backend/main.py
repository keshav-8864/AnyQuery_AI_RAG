import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re

from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound

load_dotenv()

app = FastAPI()

# Allow CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables to store our LangChain components
vector_store = None
rag_chain = None

class ProcessRequest(BaseModel):
    url: str
    language: str

class ChatRequest(BaseModel):
    query: str

def format_docs(docs):
    return "\\n\\n".join(doc.page_content for doc in docs)

@app.post("/process")
def process_video(request: ProcessRequest):
    global vector_store, rag_chain

    # Extract Video ID
    video_id = None
    if "youtube.com" in request.url:
        match = re.search(r"v=([A-Za-z0-9_-]+)", request.url)
        if match:
            video_id = match.group(1)
    elif "youtu.be" in request.url:
        match = re.search(r"youtu\\.be/([A-Za-z0-9_-]+)", request.url)
        if match:
            video_id = match.group(1)
    
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    # Fetch Transcript
    try:
        api = YouTubeTranscriptApi()
        if request.language == "auto":
            # Fetch the first available transcript
            transcript_list = api.list(video_id)
            t = next(iter(transcript_list))
            transcript_data = t.fetch()
        else:
            transcript_list = api.list(video_id)
            t = transcript_list.find_transcript([request.language])
            transcript_data = t.fetch()
        
        transcript = " ".join(chunk.text for chunk in transcript_data)
    except TranscriptsDisabled:
        raise HTTPException(status_code=400, detail="Captions are disabled for this video.")
    except NoTranscriptFound:
        raise HTTPException(status_code=400, detail="Requested transcript not found for this language.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching transcript: {str(e)}")

    # Split Transcript
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = text_splitter.create_documents([transcript])

    # Create Embeddings and Vector Store
    try:
        embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
        vector_store = FAISS.from_documents(documents=chunks, embedding=embeddings)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating embeddings: {str(e)}. Check your GOOGLE_API_KEY.")

    # Create Retriever
    retriever = vector_store.as_retriever(search_type="similarity", search_kwargs={"k": 3})

    # Setup RAG Chain
    prompt = ChatPromptTemplate.from_template(
        """You are a helpful AI assistant.
Answer the user's question ONLY using the provided context.
If the answer is not available in the context, reply:
"I don't know based on the provided context."

-----------------------
Context:
{context}
-----------------------

Question:
{question}

Answer:"""
    )

    llm = ChatGoogleGenerativeAI(model="gemini-3.6-flash", temperature=0)

    rag_chain = (
        {
            "context": retriever | format_docs,
            "question": RunnablePassthrough(),
        }
        | prompt
        | llm
        | StrOutputParser()
    )

    return {"success": True, "message": "Video processed successfully"}

@app.post("/chat")
def chat(request: ChatRequest):
    global rag_chain

    if not rag_chain:
        raise HTTPException(status_code=400, detail="Please process a video first.")

    try:
        response = rag_chain.invoke(request.query)
        return {"answer": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during chat: {str(e)}")
