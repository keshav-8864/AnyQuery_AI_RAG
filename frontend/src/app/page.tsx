"use client";

import { useState, useRef } from "react";
import { PlayCircle, Search, Send, Loader2, Bot, User, FileText, Upload } from "lucide-react";

import ReactMarkdown from "react-markdown";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"youtube" | "pdf">("youtube");
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("auto");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessed, setIsProcessed] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [query, setQuery] = useState("");
  const [isSending, setIsSending] = useState(false);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

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

  const handleProcessPdf = async () => {
    if (!pdfFile) return;
    setIsProcessing(true);
    setIsProcessed(false);
    
    const formData = new FormData();
    formData.append("file", pdfFile);
    
    try {
      const res = await fetch(`${BACKEND_URL}/process-pdf`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setIsProcessed(true);
        setMessages([{ role: "assistant", content: "PDF processed successfully! What would you like to know?" }]);
      } else {
        alert(data.detail || "Failed to process PDF");
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
        <div className="md:col-span-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
              <Bot className="text-indigo-600 w-10 h-10" />
              AnyQuery AI
            </h1>
            <p className="text-slate-500 text-sm mt-2 font-medium">Chat with YouTube videos and PDFs using AI</p>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("youtube")}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === "youtube" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <PlayCircle className="w-4 h-4" /> YouTube
            </button>
            <button
              onClick={() => setActiveTab("pdf")}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === "pdf" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <FileText className="w-4 h-4" /> PDF
            </button>
          </div>

          <div className="flex flex-col gap-5">
            {activeTab === "youtube" ? (
              <>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">YouTube URL</label>
                  <input
                    id="youtube-url"
                    name="youtube-url"
                    type="text"
                    placeholder="https://youtube.com/watch?v=..."
                    value={url ?? ""}
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
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Upload PDF Document</label>
                  <input 
                    type="file" 
                    accept="application/pdf"
                    ref={fileInputRef}
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    className="hidden" 
                  />
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-center gap-3"
                  >
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                      <Upload className="w-6 h-6" />
                    </div>
                    {pdfFile ? (
                      <p className="text-sm font-medium text-slate-800 break-all">{pdfFile.name}</p>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Click to upload</p>
                        <p className="text-xs text-slate-500 mt-1">PDF files only (max 10MB)</p>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleProcessPdf}
                  disabled={isProcessing || !pdfFile}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow mt-2"
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                  {isProcessing ? "Processing..." : "Process PDF"}
                </button>
              </>
            )}
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
                <p className="text-sm max-w-sm">Process a YouTube video or a PDF document on the left to start chatting about its content.</p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm border ${msg.role === "user" ? "bg-indigo-600 text-white border-indigo-700" : "bg-white text-slate-600 border-slate-200"}`}>
                      {msg.role === "user" ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>
                    <div className={`px-5 py-3 rounded-2xl shadow-sm leading-relaxed ${msg.role === "user" ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white text-slate-700 border border-slate-200 rounded-tl-none"}`}>
                      {msg.role === "user" ? (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      ) : (
                        <div className="prose prose-sm prose-slate max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )}
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
                id="chat-query"
                name="chat-query"
                type="text"
                value={query ?? ""}
                onChange={(e) => setQuery(e.target.value)}
                disabled={!isProcessed || isSending}
                placeholder={isProcessed ? "Ask a question about the content..." : "Process content first..."}
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
