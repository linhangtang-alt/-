import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { AppView, ChatMessage, SelectionBox, SavedSession } from '../types';
import { ArrowLeft, MessageSquare, Mic, MicOff, Send, X, BoxSelect, Maximize2, Play, Pause, Settings, Gauge, Volume2, VolumeX, Eraser, Loader2 } from 'lucide-react';
import { generateTextResponse, LiveSession, isApiKeyAvailable } from '../services/geminiService';

interface PlayerViewProps {
  onNavigate: (view: AppView) => void;
  session: SavedSession | null;
  onUpdateSession: (id: string, history: ChatMessage[]) => void;
}

interface Point {
  x: number;
  y: number;
}

// Default sample video if none is uploaded
const DEFAULT_VIDEO = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

const PlayerView: React.FC<PlayerViewProps> = ({ onNavigate, session, onUpdateSession }) => {
  // Video State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [videoSrc, setVideoSrc] = useState(DEFAULT_VIDEO);
  
  // Interaction State
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]); 
  const [mode, setMode] = useState<'view' | 'draw'>('view');
  
  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(session?.chatHistory || []);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  
  // Live Voice State
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const liveSessionRef = useRef<LiveSession | null>(null);
  const frameIntervalRef = useRef<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); 
  const containerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initialize Video Source - Only when session ID changes (New Video)
  useEffect(() => {
    if (session?.videoFile) {
      const url = URL.createObjectURL(session.videoFile);
      setVideoSrc(url);
      setIsPlaying(false); // Reset play state for new video
      return () => URL.revokeObjectURL(url);
    }
  }, [session?.id, session?.videoFile]);

  // Initialize Chat History - Only when session ID changes (Switching Sessions)
  useEffect(() => {
    if (session) {
      setChatHistory(session.chatHistory);
    }
  }, [session?.id]);

  // Sync back to parent when chat history changes locally
  useEffect(() => {
    if (session && chatHistory !== session.chatHistory) {
        onUpdateSession(session.id, chatHistory);
    }
  }, [chatHistory, session, onUpdateSession]);

  // Intelligent Auto-scroll
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    if (!userScrolledUp || chatHistory.length <= 1) {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [chatHistory, isLoading, userScrolledUp]);

  // Detect manual scroll
  const handleChatScroll = () => {
      const container = chatContainerRef.current;
      if (!container) return;
      
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
      setUserScrolledUp(!isAtBottom);
  };

  // Clean up live session on unmount
  useEffect(() => {
    return () => {
      if (frameIntervalRef.current) window.clearInterval(frameIntervalRef.current);
      if (liveSessionRef.current) liveSessionRef.current.disconnect();
    };
  }, []);

  // --- Video Controls ---
  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    if (mode === 'draw' && e?.type === 'click' && (e.target as HTMLElement).tagName === 'VIDEO') {
        return;
    }

    if (videoRef.current) {
      if (isPlaying) {
          videoRef.current.pause();
      } else {
          if (drawingPoints.length > 0) {
              setDrawingPoints([]);
          }
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
              playPromise.catch(error => {
                  console.warn("Video playback interrupted:", error);
              });
          }
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setCurrentTime(e.currentTarget.currentTime);
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setDuration(e.currentTarget.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleSpeed = () => {
    const rates = [0.5, 1.0, 1.25, 1.5, 2.0];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    if (videoRef.current) {
      videoRef.current.playbackRate = nextRate;
    }
    setPlaybackRate(nextRate);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      videoRef.current.muted = newMuted;
      if (!newMuted && volume === 0) {
        setVolume(1);
        videoRef.current.volume = 1;
      }
    }
  };

  const toggleDrawingMode = () => {
      const newMode = mode === 'draw' ? 'view' : 'draw';
      setMode(newMode);
      
      if (newMode === 'draw' && videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
          setIsPlaying(false);
      }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const clearDrawing = () => {
      setDrawingPoints([]);
  };

  const getBoundingBox = (points: Point[]): SelectionBox | null => {
      if (points.length < 2) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      points.forEach(p => {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
      });
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };

  const getFrameAsBase64 = (overridePoints?: Point[]): string | null => {
    if (!videoRef.current || !canvasRef.current || !containerRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const pointsToUse = overridePoints || drawingPoints;

    if (pointsToUse.length > 0) {
        const videoRatio = video.videoWidth / video.videoHeight;
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;
        const containerRatio = containerWidth / containerHeight;

        let displayWidth, displayHeight, offsetX, offsetY;

        if (containerRatio > videoRatio) {
            displayHeight = containerHeight;
            displayWidth = displayHeight * videoRatio;
            offsetX = (containerWidth - displayWidth) / 2;
            offsetY = 0;
        } else {
            displayWidth = containerWidth;
            displayHeight = displayWidth / videoRatio;
            offsetX = 0;
            offsetY = (containerHeight - displayHeight) / 2;
        }

        const scale = video.videoWidth / displayWidth;

        ctx.strokeStyle = "#0ea5e9";
        ctx.lineWidth = 5 * scale;
        ctx.beginPath();
        pointsToUse.forEach((p, index) => {
            const mappedX = (p.x - offsetX) * scale;
            const mappedY = (p.y - offsetY) * scale;
            if (index === 0) ctx.moveTo(mappedX, mappedY);
            else ctx.lineTo(mappedX, mappedY);
        });
        ctx.closePath();
        ctx.stroke();
    }

    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'draw' || !containerRef.current) return;
    
    e.stopPropagation(); 
    setDrawingPoints([]);

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    setDrawingPoints([{ x, y }]);
    
    if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        setIsPlaying(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || mode !== 'draw' || !containerRef.current) return;
    e.stopPropagation();
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setDrawingPoints(prev => [...prev, { x, y }]);
  };

  const handleMouseUp = async (e: React.MouseEvent) => {
    if (!isDrawing) return;
    e.stopPropagation();
    setIsDrawing(false);

    if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
    }
    
    const finalPoints = [...drawingPoints];
    const boundingBox = getBoundingBox(finalPoints);

    if (boundingBox && (boundingBox.width > 20 || boundingBox.height > 20)) {
         await performAutoAnalysis(finalPoints, boundingBox);
    }
  };

  const performAutoAnalysis = async (points: Point[], selectionBox: SelectionBox) => {
      const imageBase64 = getFrameAsBase64(points);
      
      const userMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'user',
          content: "我圈出来的部分是什么？",
          timestamp: Date.now()
      };
      setChatHistory(prev => [...prev, userMsg]);
      setIsLoading(true);

      const prompt = "请解释图片中蓝色线条圈出的部分。不要寒暄。若是公式，使用LaTeX格式解释含义；若是图表，分析趋势。";
      
      const responseText = await generateTextResponse(
          prompt,
          [...chatHistory, userMsg],
          {
              selection: selectionBox,
              timestamp: videoRef.current?.currentTime || 0,
              image: imageBase64 || undefined
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

  const captureAndSendFrameToLive = () => {
    if (!liveSessionRef.current) return;
    const base64 = getFrameAsBase64();
    if (base64) {
        liveSessionRef.current.sendImage(base64);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    const imageBase64 = getFrameAsBase64();
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
        selection: getBoundingBox(drawingPoints),
        timestamp: videoRef.current?.currentTime || 0,
        image: imageBase64 || undefined
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
      if (frameIntervalRef.current) window.clearInterval(frameIntervalRef.current);
      liveSessionRef.current?.disconnect();
      setIsLiveActive(false);
      setIsSpeaking(false);
    } else {
      if (!isApiKeyAvailable()) {
          alert("API Key missing. Cannot start Live mode.");
          return;
      }
      try {
        const session = new LiveSession((text, isUser) => {
            // NOTE: This callback handles real-time transcripts
            setChatHistory(prev => {
                // To avoid spamming multiple bubbles for partial transcripts or back-to-back phrases,
                // we could check the last message. For now, simple append is safest for Demo.
                return [...prev, {
                    id: Date.now().toString(),
                    role: isUser ? 'user' : 'model',
                    content: text,
                    timestamp: Date.now(),
                    isVoice: true
                }];
            });

            // Update speaking visualizer based on who communicated last
            setIsSpeaking(isUser); 
            // If model responds, after a short while reset speaking state? 
            // The LiveSession handles audio output separately.
        });

        await session.connect();
        liveSessionRef.current = session;
        setIsLiveActive(true);
        if (videoRef.current) {
            videoRef.current.pause();
            setIsPlaying(false);
        }
        // Send frames more frequently for better "seeing"
        frameIntervalRef.current = window.setInterval(captureAndSendFrameToLive, 1000);
      } catch (err) {
        console.error(err);
        alert("Failed to connect to Gemini Live.");
      }
    }
  };

  const getSvgPath = () => {
      if (drawingPoints.length === 0) return "";
      const d = drawingPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      return d;
  };

  return (
    <div className="flex h-full bg-slate-900 text-white overflow-hidden">
      {/* Navbar / Back Button */}
      <div className="absolute top-4 left-4 z-50">
        <button 
          onClick={() => onNavigate(AppView.GENERATOR)}
          className="bg-black/50 hover:bg-black/70 p-2 rounded-full text-white backdrop-blur-sm transition flex items-center gap-2 pr-4"
        >
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">History & Upload</span>
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Main Content Area */}
      <div className="flex flex-1 h-full min-w-0">
        
        {/* Video Player Container */}
        <div className="flex-1 relative flex flex-col justify-center bg-black overflow-hidden" ref={containerRef}
             onMouseDown={handleMouseDown}
             onMouseMove={handleMouseMove}
             onMouseUp={handleMouseUp}>
          
          <div className="relative flex-1 flex items-center justify-center overflow-hidden">
            <video 
                ref={videoRef}
                src={videoSrc}
                className="w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                controls={false}
                onClick={togglePlay}
                crossOrigin="anonymous"
            />
            
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                <path 
                    d={getSvgPath()} 
                    stroke="#0ea5e9" 
                    strokeWidth="3" 
                    fill="rgba(14, 165, 233, 0.1)" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className="drop-shadow-lg"
                />
            </svg>
            
            {drawingPoints.length > 0 && (
                <button 
                onClick={clearDrawing}
                className="absolute top-4 right-4 z-30 bg-black/50 hover:bg-black/70 p-2 rounded-full transition text-slate-300 hover:text-white pointer-events-auto"
                title="Clear drawing"
                onMouseDown={(e) => e.stopPropagation()} 
                >
                <Eraser size={16} />
                </button>
            )}

            {isLiveActive && (
                <div className="absolute top-4 right-16 z-30 flex items-center gap-2 bg-red-600/80 px-3 py-1 rounded-full animate-pulse">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    <span className="text-xs font-bold text-white">LIVE VISION ON</span>
                </div>
            )}
          </div>

          {/* Bottom Control Bar */}
          <div className="h-16 bg-gradient-to-t from-black/90 to-transparent px-6 flex items-center gap-4 z-20 shrink-0">
             <button onClick={togglePlay} className="text-white hover:text-brand-400 transition">
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
             </button>
             <div className="flex items-center gap-2 group relative">
               <button onClick={toggleMute} className="text-white hover:text-brand-400 transition">
                 {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
               </button>
               <input 
                 type="range"
                 min="0"
                 max="1"
                 step="0.05"
                 value={isMuted ? 0 : volume}
                 onChange={handleVolumeChange}
                 className="w-0 group-hover:w-20 overflow-hidden transition-all duration-300 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-brand-500 [&::-webkit-slider-thumb]:rounded-full"
               />
             </div>
             <div className="flex-1 flex items-center gap-3">
                <span className="text-xs font-mono text-slate-300 w-10 text-right">{formatTime(currentTime)}</span>
                <input 
                    type="range" 
                    min="0" 
                    max={duration || 100} 
                    value={currentTime} 
                    onChange={handleSeek}
                    className="flex-1 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-brand-500 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:w-4 hover:[&::-webkit-slider-thumb]:h-4 transition-all"
                />
                <span className="text-xs font-mono text-slate-300 w-10">{formatTime(duration)}</span>
             </div>
             <div className="h-6 w-[1px] bg-slate-700 mx-2"></div>
             <button onClick={toggleSpeed} className="flex items-center gap-1 text-xs font-bold hover:text-brand-400 transition min-w-[50px]">
                <Gauge size={16} />
                {playbackRate}x
             </button>
             <button 
                onClick={toggleDrawingMode}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    mode === 'draw' 
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20' 
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
             >
                <BoxSelect size={18} />
                {mode === 'draw' ? 'Drawing...' : 'Draw & Ask'}
             </button>
          </div>
        </div>

        {/* Sidebar: Q&A and Chat */}
        <div className="w-[400px] bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl z-40 shrink-0 h-full max-h-screen">
           {/* Sidebar Header */}
           <div className="p-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur flex justify-between items-center shrink-0">
             <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                <MessageSquare size={18} className="text-brand-400" />
                {session?.videoName || "Study Assistant"}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                Circle on video to analyze (Lasso).
                </p>
             </div>
           </div>

           {/* Chat History */}
           <div 
             ref={chatContainerRef} 
             onScroll={handleChatScroll}
             className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700"
           >
             {chatHistory.length === 0 && (
                <div className="text-center text-slate-500 mt-10">
                    <p className="mb-2">👋 Hi! I'm your AI tutor.</p>
                    <p className="text-sm px-8">Pause the video, click <span className="text-brand-400 font-bold">Draw & Ask</span>, then draw a circle around a formula to get an explanation.</p>
                </div>
             )}
             
             {chatHistory.map((msg) => (
               <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                   msg.role === 'user' 
                     ? 'bg-brand-600 text-white rounded-br-none' 
                     : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                 }`}>
                   {msg.isVoice && (
                       <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 mb-1 flex items-center gap-1">
                           {msg.role === 'user' ? <><Mic size={10}/> You said</> : <><Volume2 size={10}/> AI Spoke</>}
                       </span>
                   )}
                   <div className="markdown-body">
                      <ReactMarkdown 
                        remarkPlugins={[remarkMath]} 
                        rehypePlugins={[rehypeKatex]}
                      >
                        {msg.content}
                      </ReactMarkdown>
                   </div>
                 </div>
               </div>
             ))}
             {isLoading && (
               <div className="flex justify-start">
                 <div className="bg-slate-800 text-slate-400 rounded-2xl rounded-bl-none px-4 py-3 text-sm flex items-center gap-2">
                   <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                   <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                   <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></div>
                   <span className="text-xs ml-1">Thinking...</span>
                 </div>
               </div>
             )}
             <div ref={chatEndRef} />
           </div>

           {/* Input Area */}
           <div className="p-4 border-t border-slate-800 bg-slate-900 shrink-0">
             <div className="flex items-center gap-2 mb-2">
                <button 
                  onClick={toggleLiveMode}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                    isLiveActive 
                    ? 'bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {isLiveActive ? (
                      <div className="flex items-center gap-2">
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                          </span>
                          End Voice Session
                      </div>
                  ) : <><Mic size={16} /> Start Voice Chat</>}
                </button>
             </div>
             
             <div className="relative">
               <input
                 type="text"
                 value={inputText}
                 onChange={(e) => setInputText(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                 placeholder={isLiveActive ? "Listening..." : "Type a question..."}
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