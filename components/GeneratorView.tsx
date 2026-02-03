
import React, { useState, useEffect, useRef } from 'react';
import { AgentStage, AgentLog, PipelineStatus, AppView, SavedSession, GeneratedArtifacts, SemanticVideoData } from '../types';
import { Video, FileText, Code, CheckCircle2, UploadCloud, FileVideo, Trash2, Eye, Terminal, Play, Cpu } from 'lucide-react';

interface GeneratorViewProps {
  onNavigate: (view: AppView) => void;
  onVideoUpload: (file: File | null, artifacts?: GeneratedArtifacts, videoUrl?: string, semanticData?: SemanticVideoData) => void;
  history: SavedSession[];
  onLoadSession: (id: string) => void;
}

const API_BASE = "http://localhost:8000";

const GeneratorView: React.FC<GeneratorViewProps> = ({ onNavigate, onVideoUpload, history, onLoadSession }) => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<PipelineStatus>(PipelineStatus.IDLE);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [activeStage, setActiveStage] = useState<AgentStage | null>(null);
  
  const [artifacts, setArtifacts] = useState<GeneratedArtifacts>({});
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [generatedSemanticData, setGeneratedSemanticData] = useState<SemanticVideoData | undefined>(undefined);
  
  const [activeTab, setActiveTab] = useState<'logs' | 'script' | 'code'>('logs');

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (stage: AgentStage, message: string, status: 'info' | 'success' | 'warning' = 'info') => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      stage,
      message,
      timestamp: Date.now(),
      status
    }]);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.toLowerCase().endsWith('.mp4')) {
        setFile(selectedFile);
        setStatus(PipelineStatus.IDLE);
      } else {
        alert("Only MP4 videos are supported.");
      }
    }
  };

  const removeFile = () => {
    setFile(null);
    setStatus(PipelineStatus.IDLE);
    setLogs([]);
    setActiveStage(null);
    setArtifacts({});
    setGeneratedVideoUrl(null);
  };

  const isVideoFile = file?.type.startsWith('video/') || file?.name.toLowerCase().endsWith('.mp4');

  const handleMainAction = () => {
    if (!file) return;
    startVideoAnalysis();
  };

  const handleEnterSession = () => {
      onVideoUpload(file, artifacts, generatedVideoUrl || undefined, generatedSemanticData);
  };

  const startVideoAnalysis = () => {
      if (!file) return;
      setStatus(PipelineStatus.PROCESSING);
      setLogs([]);
      setActiveStage(AgentStage.INGEST);
      
      setTimeout(() => {
          addLog(AgentStage.INGEST, "Ingesting video file...", "info");
          setTimeout(() => {
            addLog(AgentStage.KNOWLEDGE, "Indexing visual content (Vector DB)...", "info");
            setStatus(PipelineStatus.COMPLETED);
            setActiveStage(null);
            addLog(AgentStage.RENDER, "Video Analysis Ready.", "success");
          }, 2000);
      }, 1000);
  };

  return (
    <div className="flex flex-col h-full max-w-[1800px] mx-auto p-6 md:p-8 gap-6 bg-slate-50/50">
      <div className="flex justify-between items-end pb-4 border-b border-slate-200/60">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">InsightStream</h1>
          <p className="text-slate-500 mt-2 font-medium">AI-Powered Educational Video Generation Studio</p>
        </div>
        <div className="text-right hidden md:block">
            <div className={`text-xs font-mono px-3 py-1.5 rounded-full border flex items-center gap-2 ${status === PipelineStatus.PROCESSING ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                <Cpu size={14} className={status === PipelineStatus.PROCESSING ? "animate-spin" : ""} />
                System Status: <span className="uppercase font-bold">{status}</span>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full min-h-0">
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6">
          <div className="bg-white p-1 rounded-2xl shadow-sm border border-slate-200 transition-all hover:shadow-md group">
            <div className="bg-slate-50/50 p-5 rounded-xl border border-dashed border-slate-200 group-hover:border-brand-300 transition-colors h-full flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <UploadCloud size={16} className="text-brand-600"/> PROJECT SOURCE
                    </h2>
                </div>
                
                {!file ? (
                    <div className="relative py-10 flex flex-col items-center justify-center text-center cursor-pointer">
                        <input 
                            type="file" 
                            onChange={handleUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            accept=".mp4"
                        />
                        <div className="bg-white p-4 rounded-full mb-3 text-brand-600 shadow-sm border border-slate-100 group-hover:scale-110 transition-transform duration-300">
                            <UploadCloud size={32} />
                        </div>
                        <p className="text-slate-900 font-semibold">Drop Video</p>
                        <p className="text-xs text-slate-400 mt-1">Supports MP4</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3 shadow-sm">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-purple-50 text-purple-600">
                                <FileVideo size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-slate-900 truncate">{file.name}</p>
                                <p className="text-[10px] text-slate-400 font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                            {status === PipelineStatus.IDLE && (
                                <button onClick={removeFile} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>

                        {status === PipelineStatus.COMPLETED ? (
                            <button 
                                onClick={handleEnterSession}
                                className="w-full py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                            >
                                <Play size={18} fill="currentColor" /> Enter Session
                            </button>
                        ) : (
                            <button 
                                onClick={handleMainAction}
                                disabled={status === PipelineStatus.PROCESSING}
                                className={`w-full py-3 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2
                                    ${status === PipelineStatus.PROCESSING 
                                        ? 'bg-slate-800 cursor-not-allowed opacity-80' 
                                        : 'bg-brand-600 hover:bg-brand-700 shadow-brand-500/20'}`}
                            >
                                {status === PipelineStatus.PROCESSING ? (
                                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Processing...</>
                                ) : (
                                    'Analyze Video'
                                )}
                            </button>
                        )}
                    </div>
                )}
            </div>
          </div>

           <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-5 overflow-hidden flex flex-col shadow-sm">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Library</h3>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                  {history.map(session => (
                      <div 
                        key={session.id}
                        onClick={() => onLoadSession(session.id)}
                        className="group flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
                      >
                          <div className="w-10 h-10 bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-brand-600 group-hover:shadow-sm rounded-lg flex items-center justify-center transition-all">
                              <FileVideo size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 truncate">{session.videoName}</p>
                              <p className="text-[10px] text-slate-400">{new Date(session.lastAccessed).toLocaleDateString()}</p>
                          </div>
                          <Eye size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                  ))}
                  {history.length === 0 && (
                      <div className="text-center py-10 text-slate-400 text-sm italic">
                          No recent projects
                      </div>
                  )}
              </div>
          </div>
        </div>

        <div className="lg:col-span-8 xl:col-span-9 flex flex-col h-full min-h-0">
            <div className="flex-1 bg-slate-950 rounded-2xl shadow-2xl border border-slate-800 flex flex-col overflow-hidden relative group">
                <div className="h-10 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                    </div>
                    <div className="flex gap-1 bg-slate-950 p-1 rounded-lg">
                        <button 
                            onClick={() => setActiveTab('logs')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${activeTab === 'logs' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <span className="flex items-center gap-1.5"><Terminal size={12} /> Console</span>
                        </button>
                    </div>
                    <div className="w-16"></div>
                </div>

                <div className="flex-1 overflow-auto p-6 font-mono text-sm relative scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {activeTab === 'logs' && (
                        <div className="space-y-3">
                             {logs.length === 0 && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700 select-none pointer-events-none">
                                    <Terminal size={48} className="mb-4 opacity-50" />
                                    <p>Ready to initialize analysis pipeline...</p>
                                </div>
                             )}
                             {logs.map((log) => (
                                <div key={log.id} className="flex gap-4 animate-in fade-in slide-in-from-left-2 duration-300 group/log">
                                    <span className="text-slate-600 shrink-0 select-none text-xs pt-1">{new Date(log.timestamp).toLocaleTimeString([], {hour12: false, minute:'2-digit', second:'2-digit', fractionalSecondDigits: 2} as any)}</span>
                                    <div className="flex-1 break-words">
                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase mr-3 w-24 text-center select-none
                                            ${log.stage === AgentStage.ERROR ? 'bg-red-500/20 text-red-400' : 
                                              log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 
                                              'bg-slate-800 text-slate-400'}`}>
                                            {log.stage}
                                        </span>
                                        <span className={`${log.status === 'warning' ? 'text-yellow-400' : log.status === 'success' ? 'text-emerald-300' : 'text-slate-300'}`}>
                                            {log.message}
                                        </span>
                                    </div>
                                </div>
                             ))}
                             {status === PipelineStatus.PROCESSING && activeTab === 'logs' && (
                                 <div className="flex gap-4 mt-2">
                                     <span className="w-[70px]"></span>
                                     <span className="w-2 h-4 bg-brand-500 animate-pulse block"></span>
                                 </div>
                             )}
                             <div ref={logsEndRef} />
                        </div>
                    )}
                </div>
                
                {activeStage && (
                    <div className="absolute bottom-4 right-4 bg-slate-900/90 backdrop-blur border border-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-full flex items-center gap-2 shadow-xl animate-in slide-in-from-bottom-2">
                        <div className="w-2 h-2 bg-brand-400 rounded-full animate-pulse"></div>
                        Agent Active: <span className="text-brand-300 font-bold">{activeStage}</span>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default GeneratorView;
