# AnyQuery AI

AnyQuery AI is a full-stack Retrieval-Augmented Generation (RAG) application for asking questions about the content of YouTube videos and PDF documents. It extracts source text, splits it into overlapping chunks, creates local semantic embeddings, retrieves relevant context, and generates grounded answers with Google Gemini.

## Features

- Process YouTube videos from standard `youtube.com` and `youtu.be` URLs.
- Fetch transcripts with automatic language selection or a requested language.
- Upload and process PDF documents.
- Create local embeddings with Hugging Face `all-MiniLM-L6-v2`.
- Store document chunks in an in-memory FAISS similarity index.
- Retrieve the three most relevant chunks for each question.
- Generate answers with `gemini-3.6-flash` through LangChain.
- Render assistant responses as Markdown in a responsive Next.js chat interface.

## How It Works

1. The user submits a YouTube URL or PDF file from the frontend.
2. FastAPI extracts the transcript or PDF text.
3. `RecursiveCharacterTextSplitter` creates chunks of 1,000 characters with 200-character overlap.
4. `all-MiniLM-L6-v2` converts the chunks into local embeddings.
5. FAISS indexes the embeddings and exposes a similarity retriever.
6. The retriever supplies the top three matching chunks to a LangChain prompt.
7. Google Gemini generates an answer using only the retrieved context.

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, Lucide Icons, React Markdown
- **Backend:** Python, FastAPI, Pydantic, Uvicorn
- **RAG:** LangChain, FAISS, Hugging Face Sentence Transformers
- **AI model:** Google Gemini `gemini-3.6-flash`
- **Data sources:** YouTube Transcript API and `pypdf`

## Project Structure

```text
YouTube_Rag/
├── backend/
│   ├── main.py             # FastAPI app and RAG pipeline
│   ├── list_models.py      # Utility for listing Google AI models
│   └── requirements.txt
├── frontend/
│   ├── src/app/page.tsx    # Upload, processing, and chat UI
│   ├── src/app/layout.tsx
│   └── package.json
└── README.md
```

## Prerequisites

- Python 3.10 or newer
- Node.js and npm
- A Google AI API key with access to the configured Gemini model

## Configuration

Create a `.env` file in `backend/`:

```env
GOOGLE_API_KEY=your_google_ai_api_key
```

Optionally configure the frontend backend URL with `frontend/.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

If `NEXT_PUBLIC_BACKEND_URL` is not set, the frontend uses `http://localhost:8000`.

## Local Development

### Start the backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload
```

The FastAPI server runs at `http://localhost:8000`.

### Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in a browser.

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/process` | Fetch and index a YouTube transcript. |
| `POST` | `/process-pdf` | Extract and index an uploaded PDF. |
| `POST` | `/chat` | Ask a question about the currently indexed source. |

Example YouTube processing request:

```json
{
	"url": "https://www.youtube.com/watch?v=video_id",
	"language": "auto"
}
```

Example chat request:

```json
{
	"query": "What are the main ideas discussed in this video?"
}
```

## Current Limitations

- The FAISS index is stored only in memory and is lost when the backend restarts.
- The application currently supports one active source at a time; processing a new video or PDF replaces the previous index.
- There is no authentication, per-user session isolation, or rate limiting.
- Answers currently do not include transcript timestamps or PDF page citations.
- CORS is configured permissively for local development and should be restricted before production deployment.
