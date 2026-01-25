import React, { useState, useEffect, useRef } from 'react';
import { AgentStage, AgentLog, PipelineStatus, AppView, SavedSession, GeneratedArtifacts, SemanticVideoData } from '../types';
import { Video, FileText, Activity, Code, Layers, PlayCircle, CheckCircle2, Circle, UploadCloud, FileVideo, Trash2, Settings, Zap, Search, Eye, Terminal } from 'lucide-react';

interface GeneratorViewProps {
  onNavigate: (view: AppView) => void;
  onVideoUpload: (file: File | null, artifacts?: GeneratedArtifacts, videoUrl?: string, semanticData?: SemanticVideoData) => void;
  history: SavedSession[];
  onLoadSession: (id: string) => void;
}

interface StageItemProps {
  stage: AgentStage;
  isActive: boolean;
  isCompleted: boolean;
}

const API_BASE = "http://localhost:8000";

const StageItem: React.FC<StageItemProps> = ({ stage, isActive, isCompleted }) => {
  let Icon = Circle;
  if (stage === AgentStage.INGEST) Icon = FileText;
  if (stage === AgentStage.SCRIPT) Icon = FileText;
  if (stage === AgentStage.VISUAL_PLAN) Icon = Layers;
  if (stage === AgentStage.MOTION) Icon = Activity;
  if (stage === AgentStage.CODE_GEN) Icon = Code;
  if (stage === AgentStage.RENDER) Icon = Video;

  return (
    <div className={`flex flex-col items-center gap-2 w-20 transition-all duration-300 ${isActive ? 'scale-110 opacity-100' : 'opacity-60'}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-500
        ${isCompleted ? 'bg-green-100 border-green-500 text-green-600' : 
          isActive ? 'bg-brand-100 border-brand-500 text-brand-600 animate-pulse' : 
          'bg-slate-50 border-slate-300 text-slate-400'}`}>
        {isCompleted ? <CheckCircle2 size={20} /> : <Icon size={20} />}
      </div>
      <span className="text-[10px] text-center font-medium text-slate-600 leading-tight h-8 flex items-center">{stage}</span>
    </div>
  );
};

const GeneratorView: React.FC<GeneratorViewProps> = ({ onNavigate, onVideoUpload, history, onLoadSession }) => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<PipelineStatus>(PipelineStatus.IDLE);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [activeStage, setActiveStage] = useState<AgentStage | null>(null);
  const [analysisMode, setAnalysisMode] = useState<'fast' | 'deep'>('fast');
  
  // Generated Artifacts & Backend Data
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
      setFile(e.target.files[0]);
      setStatus(PipelineStatus.IDLE);
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

  const isVideoFile = file?.type.startsWith('video/');

  const handleMainAction = () => {
    if (!file) return;
    if (isVideoFile) {
        startVideoAnalysis(); // Keep local simulation for raw video analysis if needed
    } else {
        startBackendGeneration(); // Use Python Backend for Documents
    }
  };

  const handleEnterSession = () => {
      // Pass the backend video URL if available, otherwise fallback to local file
      onVideoUpload(file, artifacts, generatedVideoUrl || undefined, generatedSemanticData);
  };

  // Keep this as a simulation for uploaded MP4s (Video Analysis)
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

  // --- REAL BACKEND INTEGRATION ---
  const startBackendGeneration = async () => {
    if (!file) return;
    setStatus(PipelineStatus.PROCESSING);
    setLogs([]);
    setArtifacts({});
    setActiveTab('logs');
    setActiveStage(AgentStage.INGEST);

    try {
        // 1. Submit Job
        const res = await fetch(`${API_BASE}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: file.name,
                user_requirements: "Explain clearly and concisely.",
                file_path: file.name // Mocking path as backend is a simulation wrapper
            })
        });
        
        if (!res.ok) throw new Error("Failed to submit job");
        const { task_id } = await res.json();
        addLog(AgentStage.INGEST, `Job submitted to Queue. Task ID: ${task_id}`, 'info');

        // 2. Poll Status
        const pollInterval = setInterval(async () => {
            try {
                const statusRes = await fetch(`${API_BASE}/api/status/${task_id}`);
                if(!statusRes.ok) return;
                
                const data = await statusRes.json();
                
                // Map Backend Progress to Frontend Stages & Logs
                syncProgressToStage(data.progress, data.message);

                if (data.status === 'completed') {
                    clearInterval(pollInterval);
                    await handleBackendCompletion(data);
                } else if (data.status === 'failed') {
                    clearInterval(pollInterval);
                    setStatus(PipelineStatus.ERROR);
                    addLog(AgentStage.ERROR, data.message || "Generation Failed", 'warning');
                }
            } catch (pollErr) {
                console.warn("Polling error", pollErr);
            }
        }, 1500);

    } catch (e: any) {
        console.error(e);
        setStatus(PipelineStatus.ERROR);
        addLog(AgentStage.ERROR, `Connection Error: ${e.message}`, 'warning');
    }
  };

  const syncProgressToStage = (progress: number, message: string) => {
      // Heuristic mapping of progress % to Agents
      let currentStage = AgentStage.INGEST;
      if (progress > 10) currentStage = AgentStage.SCRIPT;
      if (progress > 30) currentStage = AgentStage.VISUAL_PLAN; // Backend skips explicit plan step, but visual feedback is nice
      if (progress > 45) currentStage = AgentStage.CODE_GEN;
      if (progress > 60) currentStage = AgentStage.RENDER;
      if (progress > 80) currentStage = AgentStage.RENDER; // QA phase
      
      setActiveStage(currentStage);
      
      // Only add log if message changed to avoid spam
      setLogs(prev => {
          const last = prev[prev.length - 1];
          if (last?.message !== message && message) {
              return [...prev, {
                  id: Math.random().toString(36).substr(2, 9),
                  stage: currentStage,
                  message,
                  timestamp: Date.now(),
                  status: 'info'
              }];
          }
          return prev;
      });
  };

  const handleBackendCompletion = async (data: any) => {
      setStatus(PipelineStatus.COMPLETED);
      setActiveStage(null);
      addLog(AgentStage.RENDER, "Pipeline Finished Successfully.", "success");

      const fullVideoUrl = `${API_BASE}${data.video_url}`;
      setGeneratedVideoUrl(fullVideoUrl);

      if (data.script_url) {
          try {
              // Fetch the generated script JSON
              const scriptRes = await fetch(`${API_BASE}${data.script_url}`);
              const scriptJson = await scriptRes.json();
              
              // Convert Backend Script Schema to SemanticVideoData
              const convertedSemanticData: SemanticVideoData = {
                  meta: { project_id: data.task_id, language: 'en', version: '1.0' },
                  scenes: [{
                      scene_id: "Main",
                      start_time: 0,
                      end_time: 999,
                      visual_context: {
                          layout: { strategy_name: "Generated Layout", description: "Dynamic layout based on script.", regions: [] },
                          frame_description: "Auto-generated scene",
                          components: []
                      },
                      actions: [],
                      lines: scriptJson.map((line: any) => ({
                          line_id: line.line_id || Math.random().toString(),
                          text: line.text,
                          start_s: line.start_time,
                          end_s: line.end_time
                      }))
                  }]
              };
              
              setGeneratedSemanticData(convertedSemanticData);
              setArtifacts(prev => ({ ...prev, script: JSON.stringify(scriptJson, null, 2) }));
              setActiveTab('script');
          } catch (err) {
              console.error("Failed to parse generated script", err);
              addLog(AgentStage.SCRIPT, "Warning: Could not load generated script metadata.", "warning");
          }
      }
  };

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto p-6 gap-6">
      <div className="flex justify-between items-center pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">InsightStream Studio</h1>
          <p className="text-slate-500 mt-1">End-to-End Educational Video Generation Pipeline.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-full min-h-0">
        
        {/* Left Column: Upload */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <UploadCloud size={20} className="text-brand-600"/> New Project
            </h2>
            
            {!file ? (
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-all relative">
                    <input 
                        type="file" 
                        onChange={handleUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        accept=".md,.pdf,.txt,.mp4"
                    />
                    <div className="bg-brand-100 p-4 rounded-full mb-3 text-brand-600">
                        <UploadCloud size={32} />
                    </div>
                    <p className="text-slate-900 font-medium mb-1">Upload Material</p>
                    <p className="text-xs text-slate-500">PDF, Markdown or MP4</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${isVideoFile ? 'bg-purple-100 text-purple-600' : 'bg-red-100 text-red-600'}`}>
                            {isVideoFile ? <FileVideo size={24} /> : <FileText size={24} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 truncate">{file.name}</p>
                            <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        {status === PipelineStatus.IDLE && (
                            <button onClick={removeFile} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full">
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>

                    {status === PipelineStatus.COMPLETED ? (
                        <button 
                            onClick={handleEnterSession}
                            className="w-full py-3.5 rounded-lg font-bold text-white bg-green-600 hover:bg-green-700 transition-all flex items-center justify-center gap-2 animate-bounce-short"
                        >
                            Enter Session <Eye size={18} />
                        </button>
                    ) : (
                        <button 
                            onClick={handleMainAction}
                            disabled={status === PipelineStatus.PROCESSING}
                            className={`w-full py-3.5 rounded-lg font-semibold text-white transition-all shadow-sm flex items-center justify-center gap-2
                                ${status === PipelineStatus.PROCESSING ? 'bg-slate-300 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700'}`}
                        >
                            {status === PipelineStatus.PROCESSING ? 'Processing...' : isVideoFile ? 'Analyze Video' : 'Generate Video'}
                        </button>
                    )}
                </div>
            )}
          </div>

           {/* History List */}
           <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-hidden flex flex-col">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Recent Projects</h3>
              <div className="flex-1 overflow-y-auto space-y-2">
                  {history.map(session => (
                      <div 
                        key={session.id}
                        onClick={() => onLoadSession(session.id)}
                        className="bg-white border border-slate-200 p-3 rounded-lg cursor-pointer hover:border-brand-300 hover:shadow-sm transition-all flex items-center gap-3"
                      >
                          <div className="w-8 h-8 bg-brand-50 text-brand-600 rounded flex items-center justify-center">
                              <FileVideo size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-900 truncate">{session.videoName}</p>
                              <p className="text-[10px] text-slate-500">{new Date(session.lastAccessed).toLocaleDateString()}</p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
        </div>

        {/* Right Column: Pipeline Inspector */}
        <div className="lg:col-span-3 flex flex-col gap-6 h-full min-h-0">
            
            {/* Visual Pipeline Stages */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex flex-wrap justify-between items-start gap-2">
                  {Object.values(AgentStage).filter(s => s !== AgentStage.ERROR).map((s) => {
                      const isCompleted = logs.some(l => l.stage === s && l.message.includes('completed')) || status === PipelineStatus.COMPLETED || (status === PipelineStatus.PROCESSING && activeStage !== s && logs.some(l => l.stage === s));
                      return <StageItem key={s} stage={s} isActive={activeStage === s} isCompleted={isCompleted} />;
                  })}
                </div>
            </div>

            {/* Inspector Tabs */}
            <div className="flex-1 bg-slate-900 rounded-xl shadow-lg border border-slate-800 flex flex-col overflow-hidden">
                <div className="flex border-b border-slate-800 bg-slate-950">
                    <button 
                        onClick={() => setActiveTab('logs')}
                        className={`px-4 py-3 text-sm font-mono flex items-center gap-2 ${activeTab === 'logs' ? 'bg-slate-900 text-brand-400 border-t-2 border-brand-400' : 'text-slate-400 hover:bg-slate-900'}`}
                    >
                        <Terminal size={14} /> Agent Logs
                    </button>
                    <button 
                        onClick={() => setActiveTab('script')}
                        className={`px-4 py-3 text-sm font-mono flex items-center gap-2 ${activeTab === 'script' ? 'bg-slate-900 text-brand-400 border-t-2 border-brand-400' : 'text-slate-400 hover:bg-slate-900'}`}
                    >
                        <FileText size={14} /> Script.json
                    </button>
                    <button 
                        onClick={() => setActiveTab('code')}
                        className={`px-4 py-3 text-sm font-mono flex items-center gap-2 ${activeTab === 'code' ? 'bg-slate-900 text-brand-400 border-t-2 border-brand-400' : 'text-slate-400 hover:bg-slate-900'}`}
                    >
                        <Code size={14} /> Manim.py
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-4 font-mono text-sm">
                    {activeTab === 'logs' && (
                        <div className="space-y-2">
                             {logs.length === 0 && <div className="text-slate-600 italic">Ready to start pipeline...</div>}
                             {logs.map((log) => (
                                <div key={log.id} className="flex gap-3 animate-fade-in">
                                    <span className="text-slate-500 min-w-[60px]">{new Date(log.timestamp).toLocaleTimeString([], {minute:'2-digit', second:'2-digit'})}</span>
                                    <span className={`font-bold min-w-[140px] text-brand-400`}>[{log.stage}]</span>
                                    <span className="text-slate-300">{log.message}</span>
                                </div>
                             ))}
                             <div ref={logsEndRef} />
                        </div>
                    )}

                    {activeTab === 'script' && (
                        <div className="text-slate-300 whitespace-pre-wrap">
                            {artifacts.script || <span className="text-slate-600 italic">Script not generated yet.</span>}
                        </div>
                    )}

                    {activeTab === 'code' && (
                        <div className="text-blue-300 whitespace-pre-wrap">
                            {artifacts.manimCode || <span className="text-slate-600 italic">Code not generated yet.</span>}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default GeneratorView;