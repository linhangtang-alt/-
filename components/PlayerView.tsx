import React, { useState, useRef, useEffect } from 'react';
import { AppView, ChatMessage, SelectionBox } from '../types';
import { ArrowLeft, MessageSquare, Mic, MicOff, Send, X, BoxSelect, Maximize2 } from 'lucide-react';
import { generateTextResponse, LiveSession, isApiKeyAvailable } from '../services/geminiService';

interface PlayerViewProps {
  onNavigate: (view: AppView) => void;
}

// Sample video for demo (A creative commons tech/math video would be ideal, using a placeholder)
const VIDEO_SRC = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"; // Placeholder

const PlayerView: React.FC<PlayerViewProps> = ({ onNavigate }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selection, setSelection] = useState<SelectionBox | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<'view' | 'select'>('view');
  
  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Live Voice State
  const [isLiveActive, setIsLiveActive] = useState(false);
  const liveSessionRef = useRef<LiveSession | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  // --- Drawing Logic ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'select' || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsDrawing(true);
    setStartPos({ x, y });
    setSelection({ x, y, width: 0, height: 0 });
    // Pause video when starting to draw
    if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        setIsPlaying(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || mode !== 'select' || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    setSelection({
      x: Math.min(startPos.x, currentX),
      y: Math.min(startPos.y, currentY),
      width: Math.abs(currentX - startPos.x),
      height: Math.abs(currentY - startPos.y)
    });
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    // Switch back to view mode but keep selection visible until cleared
    setMode('view');
  };

  const clearSelection = () => {
    setSelection(null);
  };

  // --- Text Chat Logic ---
  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
      timestamp: Date.now()
    };

    setChatHistory(prev => [...prev, newMessage]);
    setInputText("");
    setIsLoading(true);

    const responseText = await generateTextResponse(
      newMessage.content,
      chatHistory,
      {
        selection: selection,
        timestamp: videoRef.current?.currentTime || 0
      }
    );

    setIsLoading(false);
    setChatHistory(prev => [...prev, {
      id: (Date.now() + 1).toString(),
      role: 'model',
      content: responseText,
      timestamp: Date.now()
    }]);
  };

  // --- Live Voice Logic ---
  const toggleLiveMode = async () => {
    if (isLiveActive) {
      // Stop
      liveSessionRef.current?.disconnect();
      setIsLiveActive(false);
    } else {
      // Start
      if (!isApiKeyAvailable()) {
          alert("API Key missing. Cannot start Live mode.");
          return;
      }
      
      try {
        const session = new LiveSession((text, isUser) => {
            setChatHistory(prev => [...prev, {
                id: Date.now().toString(),
                role: isUser ? 'user' : 'model',
                content: text,
                timestamp: Date.now(),
                isVoice: true
            }]);
        });
        await session.connect();
        liveSessionRef.current = session;
        setIsLiveActive(true);
        // Pause video for voice interaction
        if (videoRef.current) {
            videoRef.current.pause();
            setIsPlaying(false);
        }
      } catch (err) {
        console.error(err);
        alert("Failed to connect to Gemini Live.");
      }
    }
  };

  return (
    <div className="flex h-full bg-slate-900 text-white overflow-hidden">
      {/* Navbar / Back Button */}
      <div className="absolute top-4 left-4 z-50">
        <button 
          onClick={() => onNavigate(AppView.GENERATOR)}
          className="bg-black/50 hover:bg-black/70 p-2 rounded-full text-white backdrop-blur-sm transition"
        >
          <ArrowLeft size={20} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 h-full">
        
        {/* Video Player Container */}
        <div className="flex-1 relative flex items-center justify-center bg-black" ref={containerRef}
             onMouseDown={handleMouseDown}
             onMouseMove={handleMouseMove}
             onMouseUp={handleMouseUp}>
          
          <video 
            ref={videoRef}
            src={VIDEO_SRC}
            className="w-full max-h-full object-contain"
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            controls={false} // Custom controls or default
            onClick={togglePlay}
          />
          
          {/* Custom Overlay UI */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-4 bg-black/60 px-6 py-2 rounded-full backdrop-blur-md items-center z-20">
             <button onClick={togglePlay} className="hover:text-brand-400 transition">
                {isPlaying ? "Pause" : "Play"}
             </button>
             <span className="text-sm font-mono text-slate-300">{Math.floor(currentTime)}s</span>
             <div className="h-4 w-[1px] bg-slate-500"></div>
             <button 
                onClick={() => setMode(mode === 'select' ? 'view' : 'select')}
                className={`flex items-center gap-2 text-sm ${mode === 'select' ? 'text-brand-400' : 'text-white'} hover:text-brand-400 transition`}
             >
                <BoxSelect size={18} />
                {mode === 'select' ? 'Drawing Mode' : 'Select Area'}
             </button>
          </div>

          {/* Selection Box Overlay */}
          {selection && (
            <div 
              className="absolute border-2 border-brand-500 bg-brand-500/10 z-10 pointer-events-none"
              style={{
                left: selection.x,
                top: selection.y,
                width: selection.width,
                height: selection.height
              }}
            >
              <div className="absolute -top-8 left-0 bg-brand-600 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                Context Selected
              </div>
            </div>
          )}
          
          {/* Clear Selection Button */}
          {selection && (
             <button 
               onClick={clearSelection}
               className="absolute top-4 right-4 z-30 bg-black/50 p-2 rounded-full hover:bg-red-500/80 transition"
             >
               <X size={16} />
             </button>
          )}

        </div>

        {/* Sidebar: Q&A and Chat */}
        <div className="w-[400px] bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl z-40">
           {/* Sidebar Header */}
           <div className="p-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
             <h2 className="text-lg font-semibold flex items-center gap-2">
               <MessageSquare size={18} className="text-brand-400" />
               Study Assistant
             </h2>
             <p className="text-xs text-slate-400 mt-1">
               Ask about the video or select an area to get specific explanations.
             </p>
           </div>

           {/* Chat History */}
           <div className="flex-1 overflow-y-auto p-4 space-y-4">
             {chatHistory.length === 0 && (
                <div className="text-center text-slate-500 mt-10">
                    <p className="mb-2">👋 Hi! I'm your AI tutor.</p>
                    <p className="text-sm">Pause the video, draw a box around a formula or diagram, and ask me to explain it!</p>
                </div>
             )}
             
             {chatHistory.map((msg) => (
               <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                   msg.role === 'user' 
                     ? 'bg-brand-600 text-white rounded-br-none' 
                     : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                 }`}>
                   {msg.isVoice && <span className="text-xs opacity-70 block mb-1">🎤 Voice Transcript</span>}
                   {msg.content}
                 </div>
               </div>
             ))}
             {isLoading && (
               <div className="flex justify-start">
                 <div className="bg-slate-800 text-slate-400 rounded-2xl rounded-bl-none px-4 py-3 text-sm flex items-center gap-2">
                   <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                   <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                   <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></div>
                 </div>
               </div>
             )}
             <div ref={chatEndRef} />
           </div>

           {/* Context Indicator */}
           {selection && (
             <div className="px-4 py-2 bg-brand-900/30 border-t border-brand-900/50 flex items-center justify-between">
                <span className="text-xs text-brand-300 flex items-center gap-1">
                    <Maximize2 size={12} /> Area Selected
                </span>
                <span className="text-xs text-slate-400">Will be sent with next question</span>
             </div>
           )}

           {/* Input Area */}
           <div className="p-4 border-t border-slate-800 bg-slate-900">
             <div className="flex items-center gap-2 mb-2">
                <button 
                  onClick={toggleLiveMode}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                    isLiveActive 
                    ? 'bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {isLiveActive ? <><MicOff size={16} /> End Voice Session</> : <><Mic size={16} /> Start Voice Chat</>}
                </button>
             </div>
             
             <div className="relative">
               <input
                 type="text"
                 value={inputText}
                 onChange={(e) => setInputText(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                 placeholder="Type a question..."
                 className="w-full bg-slate-800 text-white rounded-lg pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none placeholder-slate-500"
                 disabled={isLiveActive}
               />
               <button 
                 onClick={handleSendMessage}
                 disabled={!inputText.trim() || isLiveActive}
                 className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 text-brand-400 hover:text-brand-300 disabled:text-slate-600 transition"
               >
                 <Send size={18} />
               </button>
             </div>
             <div className="text-center mt-2">
                 <a href="https://ai.google.dev/" target="_blank" rel="noreferrer" className="text-[10px] text-slate-600 hover:underline">Powered by Gemini</a>
             </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default PlayerView;
