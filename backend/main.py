import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
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
from pypdf import PdfReader
import io

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

def setup_rag_chain(text: str):
    global vector_store, rag_chain
    
    # Reset vector store for new document
    vector_store = None
    
    # Split Text into smaller chunks suitable for local MiniLM embedding model
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=2000, chunk_overlap=400)
    chunks = text_splitter.create_documents([text])

    # Create Embeddings and Vector Store (Using FastEmbed to bypass Render 512MB limit)
    from langchain_community.embeddings.fastembed import FastEmbedEmbeddings
    try:
        # FastEmbed uses ONNX and is extremely lightweight (<200MB RAM)
        embeddings = FastEmbedEmbeddings()
        
        # We can now process all chunks at once since we are running locally!
        vector_store = FAISS.from_documents(documents=chunks, embedding=embeddings)
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating local embeddings: {str(e)}")

    # Create Retriever (Increased k from 3 to 15 to provide much more context to the AI)
    retriever = vector_store.as_retriever(search_type="similarity", search_kwargs={"k": 15})

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


@app.post("/process")
def process_video(request: ProcessRequest):
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

    setup_rag_chain(transcript)
    return {"success": True, "message": "Video processed successfully"}


@app.post("/process-pdf")
async def process_pdf(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        reader = PdfReader(io.BytesIO(contents))
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\\n"
        
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF.")
        
        setup_rag_chain(text)
        return {"success": True, "message": "PDF processed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")


@app.post("/chat")
def chat(request: ChatRequest):
    global rag_chain

    if not rag_chain:
        raise HTTPException(status_code=400, detail="Please process a video or PDF first.")

    try:
        response = rag_chain.invoke(request.query)
        return {"answer": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during chat: {str(e)}")
