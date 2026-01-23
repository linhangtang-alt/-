import React, { useState, useEffect, useRef } from 'react';
import { AgentStage, AgentLog, PipelineStatus, AppView, SavedSession } from '../types';
import { Video, FileText, Activity, Code, Layers, PlayCircle, CheckCircle2, Circle, UploadCloud, FileVideo, Trash2, FileCheck, Clock, MessageSquare, ChevronRight } from 'lucide-react';

interface GeneratorViewProps {
  onNavigate: (view: AppView) => void;
  onVideoUpload: (file: File) => void;
  history: SavedSession[];
  onLoadSession: (id: string) => void;
}

interface StageItemProps {
  stage: AgentStage;
  isActive: boolean;
  isCompleted: boolean;
}

const StageItem: React.FC<StageItemProps> = ({ stage, isActive, isCompleted }) => {
  let Icon = Circle;
  if (stage === AgentStage.INGEST) Icon = FileText;
  if (stage === AgentStage.SCRIPT) Icon = Code;
  if (stage === AgentStage.VISUAL_PLAN) Icon = Layers;
  if (stage === AgentStage.MOTION) Icon = Activity;
  if (stage === AgentStage.RENDER) Icon = Video;

  return (
    <div className={`flex flex-col items-center gap-2 w-24 transition-all duration-300 ${isActive ? 'scale-110' : 'opacity-70'}`}>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 
        ${isCompleted ? 'bg-green-100 border-green-500 text-green-600' : 
          isActive ? 'bg-blue-100 border-blue-500 text-blue-600 animate-pulse' : 
          'bg-slate-50 border-slate-300 text-slate-400'}`}>
        {isCompleted ? <CheckCircle2 size={24} /> : <Icon size={24} />}
      </div>
      <span className="text-xs text-center font-medium text-slate-600">{stage}</span>
    </div>
  );
};

const GeneratorView: React.FC<GeneratorViewProps> = ({ onNavigate, onVideoUpload, history, onLoadSession }) => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<PipelineStatus>(PipelineStatus.IDLE);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [activeStage, setActiveStage] = useState<AgentStage | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
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
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
  };

  const isVideoFile = file?.type.startsWith('video/');

  const handleMainAction = () => {
    if (!file) return;

    if (isVideoFile) {
        // Run a simulated analysis pipeline for video before navigating
        startVideoAnalysis();
    } else {
        // Document generation mode
        startGeneration();
    }
  };

  const startVideoAnalysis = () => {
      if (!file) return;
      setStatus(PipelineStatus.PROCESSING);
      setLogs([]);

      const videoStages = [
          { msg: "Analyzing video codec and container...", delay: 800 },
          { msg: "Extracting metadata tracks...", delay: 1500 },
          { msg: "Initializing Gemini 1.5 Pro Vision Model...", delay: 2500 },
          { msg: "Video ready for interactive analysis.", delay: 3200 }
      ];

      setActiveStage(AgentStage.INGEST);
      addLog(AgentStage.INGEST, "Starting Video Analysis Pipeline...", "info");

      let currentStep = 0;
      const runVideoStep = () => {
          if (currentStep >= videoStages.length) {
              addLog(AgentStage.INGEST, "Initialization Complete.", "success");
              setTimeout(() => {
                  onVideoUpload(file);
              }, 800);
              return;
          }

          const { msg, delay } = videoStages[currentStep];
          setTimeout(() => {
              addLog(AgentStage.INGEST, msg, "info");
              currentStep++;
              runVideoStep();
          }, 800);
      };
      
      runVideoStep();
  };

  const startGeneration = () => {
    if (!file) return;
    setStatus(PipelineStatus.PROCESSING);
    setLogs([]);
    
    // Simulate the Agentic Pipeline described in the docs
    const stages = [
      { stage: AgentStage.INGEST, msg: "Cleaning and normalizing Markdown...", delay: 1000 },
      { stage: AgentStage.KNOWLEDGE, msg: "Building Concept Graph and Glossary...", delay: 2500 },
      { stage: AgentStage.SCRIPT, msg: "Generating script outline and narration...", delay: 4000 },
      { stage: AgentStage.VISUAL_PLAN, msg: "Mapping visual elements to script segments...", delay: 6000 },
      { stage: AgentStage.MOTION, msg: "Writing Manim (Python) animation code...", delay: 8000 },
      { stage: AgentStage.RENDER, msg: "Compiling final MP4 assets...", delay: 11000 },
    ];

    let currentStep = 0;

    const runStep = () => {
      if (currentStep >= stages.length) {
        setStatus(PipelineStatus.COMPLETED);
        setActiveStage(null);
        addLog(AgentStage.RENDER, "Video generation complete! Ready for playback.", 'success');
        return;
      }

      const { stage, msg, delay } = stages[currentStep];
      setActiveStage(stage);
      addLog(stage, "Starting agent...", 'info');
      
      setTimeout(() => {
        addLog(stage, msg, 'info');
        if (stage === AgentStage.MOTION) {
            setTimeout(() => addLog(stage, "Optimizing animation curves...", 'info'), 1000);
        }
        
        setTimeout(() => {
          addLog(stage, `Stage ${stage} completed successfully.`, 'success');
          currentStep++;
          runStep();
        }, 1500);
      }, 500);
    };

    runStep();
  };

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto p-6 gap-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">InsightStream Studio</h1>
          <p className="text-slate-500 mt-1">Transform documents into visual intuitive videos powered by Gemini & Manim.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-full min-h-0">
        
        {/* Left Column: Input */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <UploadCloud size={20} className="text-brand-600"/> New Project
            </h2>
            
            {/* Upload Area */}
            {!file ? (
                <div 
                    className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative ${
                        dragActive ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:bg-slate-50 hover:border-slate-400'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <input 
                        type="file" 
                        onChange={handleUpload}
                        disabled={status === PipelineStatus.PROCESSING}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        accept=".md,.pdf,.txt,.mp4,.mov,.webm"
                    />
                    <div className="bg-brand-100 p-4 rounded-full mb-3 text-brand-600">
                        <UploadCloud size={32} />
                    </div>
                    
                    <p className="text-slate-900 font-medium mb-1">
                        Click or drag file
                    </p>
                    <p className="text-xs text-slate-500 max-w-[200px]">
                        Supports <span className="font-semibold text-slate-700">PDF, MD</span> or <span className="font-semibold text-slate-700">MP4</span>.
                    </p>
                </div>
            ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3 animate-fade-in relative group">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                        isVideoFile ? 'bg-purple-100 text-purple-600' : 'bg-red-100 text-red-600'
                    }`}>
                        {isVideoFile ? <FileVideo size={24} /> : <FileText size={24} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{file.name}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                    </div>
                    {status !== PipelineStatus.PROCESSING && status !== PipelineStatus.COMPLETED && (
                        <button 
                            onClick={removeFile}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>
            )}

            <button 
              onClick={handleMainAction}
              disabled={!file || status === PipelineStatus.PROCESSING || status === PipelineStatus.COMPLETED}
              className={`w-full mt-6 py-3.5 rounded-lg font-semibold text-white transition-all shadow-sm flex items-center justify-center gap-2
                ${!file || status === PipelineStatus.PROCESSING 
                  ? 'bg-slate-300 cursor-not-allowed' 
                  : 'bg-brand-600 hover:bg-brand-700 hover:shadow-md'}`}
            >
              {status === PipelineStatus.PROCESSING ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Processing...
                  </>
              ) : 
               isVideoFile ? 'Start Video Analysis' : 'Generate Video'}
            </button>
          </div>

          {/* History Section */}
          <div className="flex-1 min-h-[200px] bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-hidden flex flex-col">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Clock size={16} /> Recent Sessions
              </h3>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {history.length === 0 ? (
                      <div className="text-center text-slate-400 text-sm mt-8">
                          No history yet.
                      </div>
                  ) : (
                      history.map(session => (
                          <div 
                            key={session.id}
                            onClick={() => onLoadSession(session.id)}
                            className="bg-white border border-slate-200 p-3 rounded-lg cursor-pointer hover:border-brand-300 hover:shadow-sm transition-all group"
                          >
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-brand-50 text-brand-600 rounded-md flex items-center justify-center shrink-0">
                                      <FileVideo size={20} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-slate-900 truncate">{session.videoName}</p>
                                      <p className="text-xs text-slate-500 flex items-center gap-2">
                                          <span>{new Date(session.lastAccessed).toLocaleDateString()}</span>
                                          <span>•</span>
                                          <span className="flex items-center gap-0.5">
                                              <MessageSquare size={10} /> {session.chatHistory.length}
                                          </span>
                                      </p>
                                  </div>
                                  <ChevronRight size={16} className="text-slate-300 group-hover:text-brand-500" />
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>
        </div>

        {/* Right Column: Pipeline Visualization */}
        <div className="lg:col-span-3 flex flex-col gap-6 h-full min-h-0">
            
            {/* Visual Pipeline Stages */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex flex-wrap justify-between items-start gap-4">
                  {Object.values(AgentStage)
                    .filter(s => s !== AgentStage.ERROR)
                    .map((s) => {
                      const isCompleted = logs.some(l => l.stage === s && l.message.includes('completed'));
                      const isActive = activeStage === s;
                      return <StageItem key={s} stage={s} isActive={isActive} isCompleted={isCompleted} />;
                  })}
                </div>
            </div>

            {/* Terminal/Logs */}
            <div className="flex-1 bg-slate-900 rounded-xl shadow-lg border border-slate-800 p-4 font-mono text-sm overflow-hidden flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                <span className="text-slate-400 flex items-center gap-2">
                  <Activity size={14} /> System Activity Log
                </span>
                <div className="flex gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                {logs.length === 0 && (
                  <div className="text-slate-600 italic">Waiting for job submission...</div>
                )}
                {logs.map((log) => (
                  <div key={log.id} className="flex gap-3 animate-fade-in">
                    <span className="text-slate-500 min-w-[60px]">{new Date(log.timestamp).toLocaleTimeString([], {hour12:false, minute:'2-digit', second:'2-digit'})}</span>
                    <span className={`font-bold min-w-[140px] ${
                      log.stage === AgentStage.ERROR ? 'text-red-400' : 'text-brand-400'
                    }`}>[{log.stage}]</span>
                    <span className={`${
                      log.status === 'success' ? 'text-green-400' : 
                      log.status === 'warning' ? 'text-yellow-400' : 'text-slate-300'
                    }`}>{log.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default GeneratorView;