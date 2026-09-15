
import os
import io
import re
from operator import itemgetter

from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings.fastembed import FastEmbedEmbeddings

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from youtube_transcript_api import (
    YouTubeTranscriptApi,
    TranscriptsDisabled,
    NoTranscriptFound,
)

from pypdf import PdfReader


# ============================================================
# Load environment variables
# ============================================================

load_dotenv()


# ============================================================
# FastAPI app
# ============================================================

app = FastAPI()


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Global variables
# ============================================================

vector_store = None
rag_chain = None


# ============================================================
# Request Models
# ============================================================

class ProcessRequest(BaseModel):
    url: str
    language: str = "auto"


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    query: str
    history: list[ChatMessage] = []


# ============================================================
# Helper: Format documents
# ============================================================

def format_docs(docs):
    return "\n\n".join(
        doc.page_content for doc in docs
    )


# ============================================================
# Setup RAG Chain
# ============================================================

def setup_rag_chain(text: str):
    global vector_store, rag_chain

    # Reset previous vector store
    vector_store = None
    rag_chain = None

    # --------------------------------------------------------
    # Split text into chunks
    # --------------------------------------------------------

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=2000,
        chunk_overlap=400,
    )

    chunks = text_splitter.create_documents([text])

    if not chunks:
        raise HTTPException(
            status_code=400,
            detail="Could not create document chunks."
        )

    # --------------------------------------------------------
    # Create embeddings
    # --------------------------------------------------------

    try:
        embeddings = FastEmbedEmbeddings()

        vector_store = FAISS.from_documents(
            documents=chunks,
            embedding=embeddings,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error creating embeddings/vector store: {str(e)}"
        )

    # --------------------------------------------------------
    # Retriever
    # --------------------------------------------------------

    retriever = vector_store.as_retriever(
        search_type="similarity",
        search_kwargs={
            "k": 15
        },
    )

    # --------------------------------------------------------
    # Prompt
    # --------------------------------------------------------

    prompt = ChatPromptTemplate.from_template(
        """
You are a helpful AI assistant.

Answer the user's question ONLY using the provided context.

If the answer is not available in the context, reply:

"I don't know based on the provided context."

-----------------------
Context:
{context}
-----------------------

Previous Chat History:
{history}
-----------------------

Question:
{question}

Answer:
"""
    )

    # --------------------------------------------------------
    # Gemini
    # --------------------------------------------------------

    try:
        llm = ChatGoogleGenerativeAI(
            model="gemini-3.6-flash",
            temperature=0,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error initializing Gemini: {str(e)}"
        )

    # --------------------------------------------------------
    # RAG Chain
    # --------------------------------------------------------

    rag_chain = (
        {
            "context": itemgetter("question")
            | retriever
            | format_docs,

            "question": itemgetter("question"),

            "history": itemgetter("history"),
        }
        | prompt
        | llm
        | StrOutputParser()
    )


# ============================================================
# Helper: Extract YouTube Video ID
# ============================================================

def extract_video_id(url: str):

    # --------------------------------------------------------
    # Normal URL
    # https://www.youtube.com/watch?v=P26AE7NLx4Q
    # --------------------------------------------------------

    match = re.search(
        r"(?:youtube\.com/watch\?v=)([A-Za-z0-9_-]+)",
        url,
    )

    if match:
        return match.group(1)

    # --------------------------------------------------------
    # Short URL
    # https://youtu.be/P26AE7NLx4Q
    # --------------------------------------------------------

    match = re.search(
        r"(?:youtu\.be/)([A-Za-z0-9_-]+)",
        url,
    )

    if match:
        return match.group(1)

    # --------------------------------------------------------
    # Embedded URL
    # https://www.youtube.com/embed/P26AE7NLx4Q
    # --------------------------------------------------------

    match = re.search(
        r"(?:youtube\.com/embed/)([A-Za-z0-9_-]+)",
        url,
    )

    if match:
        return match.group(1)

    return None


# ============================================================
# Process YouTube Video
# ============================================================

@app.post("/process")
def process_video(request: ProcessRequest):

    # --------------------------------------------------------
    # Extract Video ID
    # --------------------------------------------------------

    video_id = extract_video_id(request.url)

    if not video_id:
        raise HTTPException(
            status_code=400,
            detail="Invalid YouTube URL."
        )

    # --------------------------------------------------------
    # Fetch Transcript
    # --------------------------------------------------------

    try:

        api = YouTubeTranscriptApi()

        # youtube-transcript-api 1.2.4
        transcript_data = api.fetch(video_id)

        # Convert transcript objects into plain text
        transcript = " ".join(
            chunk.text
            for chunk in transcript_data
        )

        if not transcript.strip():
            raise HTTPException(
                status_code=400,
                detail="Transcript is empty."
            )

    except TranscriptsDisabled:

        raise HTTPException(
            status_code=400,
            detail="Captions are disabled for this video."
        )

    except NoTranscriptFound:

        raise HTTPException(
            status_code=400,
            detail="No transcript was found for this video."
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Error fetching transcript: {str(e)}"
        )

    # --------------------------------------------------------
    # Create RAG chain
    # --------------------------------------------------------

    setup_rag_chain(transcript)

    return {
        "success": True,
        "message": "Video processed successfully",
    }


# ============================================================
# Process PDF
# ============================================================

@app.post("/process-pdf")
async def process_pdf(file: UploadFile = File(...)):

    try:

        # ----------------------------------------------------
        # Read PDF
        # ----------------------------------------------------

        contents = await file.read()

        reader = PdfReader(
            io.BytesIO(contents)
        )

        # ----------------------------------------------------
        # Extract text
        # ----------------------------------------------------

        text = ""

        for page in reader.pages:

            page_text = page.extract_text()

            if page_text:
                text += page_text + "\n"

        # ----------------------------------------------------
        # Check extracted text
        # ----------------------------------------------------

        if not text.strip():

            raise HTTPException(
                status_code=400,
                detail="Could not extract text from PDF."
            )

        # ----------------------------------------------------
        # Create RAG chain
        # ----------------------------------------------------

        setup_rag_chain(text)

        return {
            "success": True,
            "message": "PDF processed successfully",
        }

    except HTTPException:
        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Error processing PDF: {str(e)}"
        )


# ============================================================
# Chat
# ============================================================

@app.post("/chat")
def chat(request: ChatRequest):

    global rag_chain

    # --------------------------------------------------------
    # Check whether document/video was processed
    # --------------------------------------------------------

    if rag_chain is None:

        raise HTTPException(
            status_code=400,
            detail="Please process a video or PDF first."
        )

    try:

        # ----------------------------------------------------
        # Format chat history
        # ----------------------------------------------------

        history_str = "\n".join(
            f"{msg.role.capitalize()}: {msg.content}"
            for msg in request.history
        )

        if not history_str:
            history_str = "No previous history."

        # ----------------------------------------------------
        # Run RAG
        # ----------------------------------------------------

        response = rag_chain.invoke(
            {
                "question": request.query,
                "history": history_str,
            }
        )

        return {
            "answer": response
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Error during chat: {str(e)}"
        )


# ============================================================
# Health Check
# ============================================================

@app.get("/")
def root():

    return {
        "message": "YouTube RAG API is running"
    }

