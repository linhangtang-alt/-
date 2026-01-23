import React, { useState, useEffect, useRef } from 'react';
import { AgentStage, AgentLog, PipelineStatus, AppView } from '../types';
import { Video, FileText, Activity, Code, Layers, PlayCircle, CheckCircle2, Circle, UploadCloud } from 'lucide-react';

interface GeneratorViewProps {
  onNavigate: (view: AppView) => void;
}

const StageItem = ({ stage, isActive, isCompleted }: { stage: AgentStage, isActive: boolean, isCompleted: boolean }) => {
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

const GeneratorView: React.FC<GeneratorViewProps> = ({ onNavigate }) => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<PipelineStatus>(PipelineStatus.IDLE);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [activeStage, setActiveStage] = useState<AgentStage | null>(null);
  
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
        // Simulate inner thoughts of agents
        if (stage === AgentStage.MOTION) {
            setTimeout(() => addLog(stage, "Optimizing animation curves...", 'info'), 1000);
        }
        
        setTimeout(() => {
          addLog(stage, `Stage ${stage} completed successfully.`, 'success');
          currentStep++;
          runStep();
        }, 1500); // Duration of the "work"
      }, 500); // Initial delay
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
        {status === PipelineStatus.COMPLETED && (
          <button 
            onClick={() => onNavigate(AppView.PLAYER)}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg transition-all transform hover:scale-105"
          >
            <PlayCircle size={20} />
            Watch Generated Video
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full min-h-0">
        
        {/* Left Column: Input */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <UploadCloud size={20} className="text-brand-600"/> Source Material
            </h2>
            
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 flex flex-col items-center justify-center text-center hover:bg-brand-50 transition-colors cursor-pointer relative">
              <input 
                type="file" 
                onChange={handleUpload}
                disabled={status === PipelineStatus.PROCESSING}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                accept=".md,.pdf,.txt"
              />
              <FileText size={40} className="text-slate-400 mb-2" />
              <p className="text-sm text-slate-600 font-medium">
                {file ? file.name : "Drag & Drop PDF or Markdown"}
              </p>
              <p className="text-xs text-slate-400 mt-1">Limit 50MB</p>
            </div>

            {/* Configuration Form */}
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Target Audience</label>
                <select className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                  <option>Undergraduate Student</option>
                  <option>High School Student</option>
                  <option>Expert Researcher</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Visual Style</label>
                <select className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                  <option>3blue1brown (Manim)</option>
                  <option>Hand-drawn Sketch</option>
                  <option>Minimalist Geometric</option>
                </select>
              </div>
            </div>

            <button 
              onClick={startGeneration}
              disabled={!file || status === PipelineStatus.PROCESSING || status === PipelineStatus.COMPLETED}
              className={`w-full mt-6 py-3 rounded-lg font-semibold text-white transition-all
                ${!file || status === PipelineStatus.PROCESSING 
                  ? 'bg-slate-300 cursor-not-allowed' 
                  : 'bg-slate-900 hover:bg-slate-800 shadow-md'}`}
            >
              {status === PipelineStatus.PROCESSING ? 'Agents Working...' : 
               status === PipelineStatus.COMPLETED ? 'Generated' : 'Generate Video'}
            </button>
          </div>
        </div>

        {/* Right Column: Pipeline Visualization */}
        <div className="lg:col-span-2 flex flex-col gap-6 h-full min-h-0">
            
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