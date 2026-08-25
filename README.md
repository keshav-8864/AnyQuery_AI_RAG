# AnyQuery AI

AnyQuery AI is a full-stack RAG (Retrieval-Augmented Generation) application that lets you chat with YouTube videos using LangChain, Google Gemini 3.6, and FastAPI.

## How to Use the App

Using **AnyQuery AI** is simple and fast. Here is what a user needs to do:

1. **Find a YouTube Video:** Copy the URL of any YouTube video you want to learn from (e.g., a long lecture, tutorial, or documentary).
2. **Paste the URL:** Open AnyQuery AI and paste the YouTube URL into the input field on the left panel.
3. **Select Language (Optional):** If the video is in a specific language (like Hindi, Spanish, or French), you can select it from the dropdown, or just leave it on **Auto-detect**.
4. **Process the Video:** Click the **"Process Video"** button. The app will fetch the video's transcript, break it down into chunks, and store it in an AI vector database.
5. **Start Chatting:** Once processing is complete, use the chat interface on the right to ask any questions! The AI will instantly read through the video's transcript and give you a precise answer based entirely on the video's context.

## Tech Stack
* **Frontend:** Next.js (React), Tailwind CSS, Lucide Icons
* **Backend:** Python, FastAPI, LangChain, FAISS Vector Database
* **AI Models:** Google Gemini 3.6 (Chat) & Gemini Text Embeddings
