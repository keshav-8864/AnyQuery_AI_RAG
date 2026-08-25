"use client";

import { useState } from "react";
import { PlayCircle, Search, Send, Loader2, Bot, User } from "lucide-react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("auto");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessed, setIsProcessed] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [query, setQuery] = useState("");
  const [isSending, setIsSending] = useState(false);

  const BACKEND_URL = "http://localhost:8000";

  const handleProcessVideo = async () => {
    if (!url) return;
    setIsProcessing(true);
    setIsProcessed(false);
    try {
      const res = await fetch(`${BACKEND_URL}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, language }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsProcessed(true);
        setMessages([{ role: "assistant", content: "Video processed successfully! What would you like to know?" }]);
      } else {
        alert(data.detail || "Failed to process video");
      }
    } catch (error) {
      alert("Error connecting to backend. Is the FastAPI server running?");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isSending) return;

    const userQuery = query;
    setQuery("");
    setMessages((prev) => [...prev, { role: "user", content: userQuery }]);
    setIsSending(true);

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userQuery }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${data.detail}` }]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, error connecting to backend." }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 font-sans text-slate-900">
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-12 gap-6 h-[85vh]">
        {/* Sidebar */}
        <div className="md:col-span-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col gap-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              <PlayCircle className="text-rose-500 w-10 h-10" />
              VideoQuery AI
            </h1>
            <p className="text-slate-500 text-sm mt-2 font-medium">Chat with YouTube videos using LangChain & Gemini</p>
          </div>

          <div className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">YouTube URL</label>
              <input
                type="text"
                placeholder="https://youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Transcript Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all cursor-pointer"
              >
                <option value="auto">Auto-detect</option>
                <option value="en">English (en)</option>
                <option value="hi">Hindi (hi)</option>
                <option value="es">Spanish (es)</option>
                <option value="fr">French (fr)</option>
              </select>
            </div>

            <button
              onClick={handleProcessVideo}
              disabled={isProcessing || !url}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow mt-2"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              {isProcessing ? "Processing..." : "Process Video"}
            </button>
          </div>
          

        </div>

        {/* Chat Area */}
        <div className="md:col-span-8 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-white shadow-sm z-10 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <h2 className="font-bold text-slate-800 text-lg">Chat Interface</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-slate-50/50">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center px-4">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4 border border-slate-200 shadow-sm">
                  <Bot className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-600 mb-1">Ready to assist</h3>
                <p className="text-sm max-w-sm">Enter a YouTube URL on the left and click "Process Video" to start chatting about its content.</p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm border ${msg.role === "user" ? "bg-indigo-600 text-white border-indigo-700" : "bg-white text-slate-600 border-slate-200"}`}>
                      {msg.role === "user" ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>
                    <div className={`px-5 py-3 rounded-2xl shadow-sm leading-relaxed ${msg.role === "user" ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white text-slate-700 border border-slate-200 rounded-tl-none"} whitespace-pre-wrap`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))
            )}
            {isSending && (
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-[85%] flex-row">
                  <div className="w-10 h-10 rounded-full bg-white text-slate-600 border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-500" /> 
                    <span className="font-medium animate-pulse">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-200">
            <div className="relative flex items-center">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={!isProcessed || isSending}
                placeholder={isProcessed ? "Ask a question about the video..." : "Process a video first..."}
                className="w-full px-5 py-4 pr-16 bg-slate-50 text-slate-900 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-50 disabled:bg-slate-100 placeholder:text-slate-400 shadow-inner"
              />
              <button
                type="submit"
                disabled={!isProcessed || isSending || !query.trim()}
                className="absolute right-3 p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow hover:-translate-y-0.5 active:translate-y-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
