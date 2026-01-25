import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { AppView, ChatMessage, SelectionBox, SavedSession, AnswerCardData, SemanticVideoData, SceneData, SceneAction } from '../types';
import { ArrowLeft, MessageSquare, Mic, MicOff, Send, X, BoxSelect, Play, Pause, Gauge, Volume2, VolumeX, Eraser, Loader2, AlertCircle, CheckCircle2, Activity, ChevronDown, ChevronRight, HelpCircle, Clock, LayoutTemplate, Zap, Subtitles, ChevronUp } from 'lucide-react';
import { generateStructuredResponse, LiveSession, isApiKeyAvailable } from '../services/geminiService';

// --- MOCK DATA FROM DOCUMENT (FALLBACK) ---
const MOCK_SCENE_DATA: SemanticVideoData = {
  "meta": {
    "project_id": "gradient_descent_101",
    "language": "en",
    "version": "narration_v2"
  },
  "scenes": [
    {
      "scene_id": "S01",
      "start_time": 0.0,
      "end_time": 36.0,
      "visual_context": {
        "layout": {
          "strategy_name": "Data and Metric Split",
          "description": "A split layout emphasizing the contrast between the visual fit (the line) and the mathematical score (the cost).",
          "regions": [
            { "name": "data_space", "bounds": "[0, 0, 0.65, 1]", "purpose": "Displays the coordinate system with data points." },
            { "name": "metric_space", "bounds": "[0.65, 0, 0.35, 1]", "purpose": "Displays the Cost Function definition." }
          ]
        },
        "frame_description": "We start in 'Data Space'. The viewer sees a scatter plot of data points with a regression line passing through them poorly.",
        "components": [
          { "name": "scatter_points", "type": "ScatterPoints", "region": "data_space", "content_specs": "Randomly distributed data points ($y \\approx 2x + 1$)." },
          { "name": "bad_fit_line", "type": "LinePlot", "region": "data_space", "content_specs": "A straight line $y = wx$." },
          { "name": "cost_definition", "type": "MathTex", "region": "metric_space", "content_specs": "$J(w) = \\frac{1}{n} \\sum (y_{pred} - y_{actual})^2$" },
          { "name": "current_cost_value", "type": "Text", "region": "metric_space", "content_specs": "Cost $J = HIGH$" }
        ]
      },
      "lines": [
        { "line_id": "S01_L001", "text": "Imagine we have a jumbled set of data points in front of us.", "start_s": 0.0, "end_s": 3.0 },
        { "line_id": "S01_L002", "text": "Our task is to draw a straight line that passes through them as perfectly as possible; this is **Linear Regression**.", "start_s": 3.0, "end_s": 11.0 },
        { "line_id": "S01_L003", "text": "If we just draw lines randomly, it's too inefficient.", "start_s": 11.0, "end_s": 15.0 },
        { "line_id": "S01_L004", "text": "We need a scoreboard to tell us just how bad each line is.", "start_s": 15.0, "end_s": 19.0 },
        { "line_id": "S01_L005", "text": "By calculating the vertical distance error from all data points to the line, we get a score.", "start_s": 19.0, "end_s": 25.0 },
        { "line_id": "S01_L006", "text": "This metric, which measures the total error, is the **Cost Function**.", "start_s": 26.0, "end_s": 30.0 },
        { "line_id": "S01_L007", "text": "Now, our goal is no longer to draw lines, but to minimize this error score.", "start_s": 32.0, "end_s": 36.0 }
      ],
      "actions": [
        { "action_id": "S01_A001", "type": "enter", "targets": ["scatter_points"], "description": "Fade in the scatter plot.", "track": "geom:scatter", "layer": 0, "start_s": 0.0, "duration_s": 2.0 },
        { "action_id": "S01_A002", "type": "enter", "targets": ["bad_fit_line"], "description": "Draw straight line.", "track": "geom:line", "layer": 1, "start_s": 3.0, "duration_s": 1.0 },
        { "action_id": "S01_A003", "type": "transform", "targets": ["bad_fit_line"], "description": "Wiggle line randomly.", "track": "geom:line", "layer": 1, "start_s": 11.0, "duration_s": 4.0 },
        { "action_id": "S01_A004", "type": "enter", "targets": ["cost_definition", "current_cost_value"], "description": "Reveal scoreboard.", "track": "ui:metric", "layer": 2, "start_s": 15.0, "duration_s": 2.0 },
        { "action_id": "S01_A007", "type": "value_update", "targets": ["current_cost_value"], "description": "Pulse cost value.", "track": "text:score", "layer": 2, "start_s": 34.0, "duration_s": 1.0 }
      ]
    },
    {
      "scene_id": "S02",
      "start_time": 36.0,
      "end_time": 65.0,
      "visual_context": {
        "layout": {
          "strategy_name": "Dual Space Correspondence",
          "description": "Split screen to map 'Line Rotation' (Left) directly to 'Curve Traversal' (Right).",
          "regions": [
            { "name": "left_data_view", "bounds": "[0, 0, 0.5, 1]", "purpose": "Regression line rotating." },
            { "name": "right_parameter_view", "bounds": "[0.5, 0, 0.5, 1]", "purpose": "Cost Function curve." }
          ]
        },
        "frame_description": "On the left, the line exists in (x,y) space; on the right, 'Parameter Space' w vs J.",
        "components": [
          { "name": "rotating_line", "type": "LinePlot", "region": "left_data_view", "content_specs": "Line rotating." },
          { "name": "cost_curve", "type": "LinePlot", "region": "right_parameter_view", "content_specs": "U-shaped parabola." },
          { "name": "state_dot", "type": "ScatterPoints", "region": "right_parameter_view", "content_specs": "Dot on parabola." }
        ]
      },
      "lines": [
        { "line_id": "S02_L001", "text": "To find the minimum score, we need to change our perspective.", "start_s": 36.0, "end_s": 40.0 },
        { "line_id": "S02_L002", "text": "Stop staring at that wobbly line on the left.", "start_s": 40.0, "end_s": 43.0 },
        { "line_id": "S02_L003", "text": "Look to the right; this shows the slope of the line vs Error.", "start_s": 44.0, "end_s": 50.0 },
        { "line_id": "S02_L004", "text": "When we rotate the left straight line, the point on the right will draw a curve like a bowl.", "start_s": 51.0, "end_s": 56.0 },
        { "line_id": "S02_L006", "text": "So, the problem changes from 'drawing a line' to 'finding the bottom of the bowl'.", "start_s": 61.0, "end_s": 65.0 }
      ],
      "actions": [
         { "action_id": "S02_A004", "type": "transform", "targets": ["rotating_line"], "description": "Rotate line.", "track": "geom:rotation", "layer": 1, "start_s": 51.0, "duration_s": 5.0 },
         { "action_id": "S02_A005", "type": "draw", "targets": ["cost_curve"], "description": "Trace parabola.", "track": "geom:curve", "layer": 0, "start_s": 51.0, "duration_s": 5.0 }
      ]
    },
    {
      "scene_id": "S03",
      "start_time": 65.0,
      "end_time": 96.0,
      "visual_context": {
        "layout": {
          "strategy_name": "Landscape Zoom",
          "description": "Full-screen focus on the Parameter Space (The Bowl).",
          "regions": [{ "name": "landscape_main", "bounds": "full", "purpose": "The terrain for the 'Hiker' metaphor." }]
        },
        "frame_description": "Zoom in on the U-curve. The 'Hiker' is on a steep slope.",
        "components": [
          { "name": "zoomed_parabola", "type": "LinePlot", "region": "landscape_main", "content_specs": "Zoomed U-curve." },
          { "name": "hiker_marker", "type": "Shape", "region": "landscape_main", "content_specs": "Circle at $w_{old}$." },
          { "name": "tangent_slope", "type": "LinePlot", "region": "landscape_main", "content_specs": "Tangent line $\\frac{\\partial J}{\\partial w}$." },
          { "name": "descent_vector", "type": "Arrow", "region": "landscape_main", "content_specs": "Arrow pointing downhill." }
        ]
      },
      "lines": [
        { "line_id": "S03_L001", "text": "However, the computer is a 'blindfolded hiker'; it cannot see the entire shape of the bowl.", "start_s": 65.0, "end_s": 71.0 },
        { "line_id": "S03_L003", "text": "The direction and steepness of this slope are mathematically termed **Gradient**.", "start_s": 76.0, "end_s": 80.0 },
        { "line_id": "S03_L004", "text": "If the slope beneath our feet is uphill, we take a step in the opposite direction.", "start_s": 80.0, "end_s": 85.0 },
        { "line_id": "S03_L005", "text": "How big this step is is determined by the **Learning Rate**.", "start_s": 86.0, "end_s": 88.0 }
      ],
      "actions": [
         { "action_id": "S03_A002", "type": "enter", "targets": ["tangent_slope"], "description": "Show tangent.", "track": "geom:tangent", "layer": 1, "start_s": 73.5, "duration_s": 1.0 },
         { "action_id": "S03_A004", "type": "enter", "targets": ["descent_vector"], "description": "Show arrow.", "track": "geom:vector", "layer": 2, "start_s": 82.5, "duration_s": 1.0 }
      ]
    },
    {
      "scene_id": "S04",
      "start_time": 96.0,
      "end_time": 121.0,
      "visual_context": {
        "layout": {
          "strategy_name": "Equation Translation",
          "description": "Top-bottom layout. Formula vs Legend.",
          "regions": []
        },
        "frame_description": "The formal equation is presented centrally.",
        "components": [
          { "name": "update_rule", "type": "MathTex", "region": "formula_area", "content_specs": "$w_{new} = w_{old} - \\alpha \\frac{\\partial J}{\\partial w}$" },
          { "name": "alpha_explainer", "type": "Text", "region": "component_map", "content_specs": "$\\alpha$ = Learning Rate" },
          { "name": "gradient_explainer", "type": "Text", "region": "component_map", "content_specs": "Derivative = Slope" }
        ]
      },
      "lines": [
        { "line_id": "S04_L001", "text": "Let's translate this downhill motion into that famous formula.", "start_s": 96.0, "end_s": 100.0 },
        { "line_id": "S04_L002", "text": "The new position equals the old position, minus the step size multiplied by the slope.", "start_s": 100.0, "end_s": 105.0 },
        { "line_id": "S04_L003", "text": "That is, the current parameter, minus **Learning Rate** multiplied by **Gradient**.", "start_s": 105.0, "end_s": 110.0 },
        { "line_id": "S04_L005", "text": "When we finally stop, congratulations, we have found that perfect straight line.", "start_s": 116.0, "end_s": 121.0 }
      ],
      "actions": [
         { "action_id": "S04_A001", "type": "enter", "targets": ["update_rule"], "description": "Reveal formula.", "track": "ui:formula", "layer": 0, "start_s": 100.0, "duration_s": 2.0 },
         { "action_id": "S04_A003", "type": "enter", "targets": ["alpha_explainer", "gradient_explainer"], "description": "Show legend.", "track": "ui:legend", "layer": 1, "start_s": 105.0, "duration_s": 2.0 }
      ]
    }
  ]
};

interface PlayerViewProps {
  onNavigate: (view: AppView) => void;
  session: SavedSession | null;
  onUpdateSession: (id: string, history: ChatMessage[]) => void;
}

interface Point { x: number; y: number; }

const DEFAULT_VIDEO = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// --- Module 8: Answer UI Agent (Card Component) ---
const AnswerCard: React.FC<{ data: AnswerCardData; onQuestionClick: (q: string) => void }> = ({ data, onQuestionClick }) => {
    const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

    return (
        <div className="flex flex-col gap-3">
            {/* Title / Confidence */}
            <div className="flex justify-between items-center border-b border-slate-600/50 pb-2 mb-1">
                <h3 className="font-bold text-brand-300 text-sm flex items-center gap-2">
                    <CheckCircle2 size={14} /> {data.title}
                </h3>
                {data.is_voice_stream && (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-brand-400 bg-brand-950/50 px-2 py-0.5 rounded-full border border-brand-500/30">
                        <Activity size={10} className="animate-pulse" /> Voice
                    </span>
                )}
            </div>

            {/* Main Answer */}
            <div className="markdown-body text-slate-200 text-sm">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {data.answer}
                </ReactMarkdown>
            </div>

            {/* Key Terms (Foldable) */}
            {data.key_terms && data.key_terms.length > 0 && (
                <div className="bg-slate-900/50 rounded-lg p-2 mt-1 border border-slate-700/50">
                    <p className="text-[10px] uppercase font-bold text-slate-500 mb-2">Key Concepts</p>
                    <div className="space-y-2">
                        {data.key_terms.map((term, idx) => (
                            <div key={idx} className="text-xs">
                                <button 
                                    onClick={() => setExpandedTerm(expandedTerm === term.term ? null : term.term)}
                                    className="flex items-center gap-1 font-mono text-brand-400 hover:text-brand-300 text-left w-full"
                                >
                                    {expandedTerm === term.term ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                    {term.term}
                                </button>
                                {expandedTerm === term.term && (
                                    <p className="pl-4 pt-1 text-slate-400 italic">{term.definition}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Suggested Followups */}
            {data.suggested_followups && (
                <div className="mt-2 flex flex-wrap gap-2">
                    {data.suggested_followups.map((q, idx) => (
                        <button 
                            key={idx} 
                            onClick={() => onQuestionClick(q)}
                            className="text-[10px] bg-brand-900/30 text-brand-200 px-2 py-1 rounded-full border border-brand-800/50 cursor-pointer hover:bg-brand-900/50 hover:border-brand-500/50 transition-colors text-left"
                        >
                            {q}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const PlayerView: React.FC<PlayerViewProps> = ({ onNavigate, session, onUpdateSession }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [preciseTime, setPreciseTime] = useState(0); // Stage 0: Precise time state
  const [duration, setDuration] = useState(0);
  const [videoSrc, setVideoSrc] = useState(DEFAULT_VIDEO);
  const [isHudOpen, setIsHudOpen] = useState(true); // Control visibility of telemetry details
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]); 
  const [mode, setMode] = useState<'view' | 'draw'>('view');
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(session?.chatHistory || []);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  
  const liveSessionRef = useRef<LiveSession | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const currentVoiceMessageIdRef = useRef<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); 
  const containerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // --- Derived Semantic State ---
  const semanticData = session?.semanticData || MOCK_SCENE_DATA;

  const { currentScene, currentLine, activeActions } = useMemo(() => {
    const scene = semanticData.scenes.find(s => preciseTime >= s.start_time && preciseTime < s.end_time);
    const line = scene?.lines.find(l => preciseTime >= l.start_s && preciseTime < l.end_s);
    
    // Look ahead window of 1 second for actions to make them feel responsive/anticipated
    const actions = scene?.actions.filter(a => {
        const isActive = preciseTime >= a.start_s && preciseTime < (a.start_s + a.duration_s);
        return isActive;
    }) || [];
    
    return { currentScene: scene, currentLine: line, activeActions: actions };
  }, [preciseTime, semanticData]);


  useEffect(() => {
    const requestMic = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            setHasMicPermission(true);
        } catch (err) {
            setHasMicPermission(false);
        }
    };
    requestMic();
  }, []);

  useEffect(() => {
    if (session?.videoUrl) {
        setVideoSrc(session.videoUrl);
        setIsPlaying(false);
    } else if (session?.videoFile) {
      const url = URL.createObjectURL(session.videoFile);
      setVideoSrc(url);
      setIsPlaying(false);
      return () => URL.revokeObjectURL(url);
    }
  }, [session?.id, session?.videoFile, session?.videoUrl]);

  useEffect(() => {
    if (session) setChatHistory(session.chatHistory);
  }, [session?.id]);

  useEffect(() => {
    if (session && chatHistory !== session.chatHistory) {
        onUpdateSession(session.id, chatHistory);
    }
  }, [chatHistory, session, onUpdateSession]);

  useEffect(() => {
    if (isLiveActive || !userScrolledUp || chatHistory.length <= 1) {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [chatHistory, isLoading, userScrolledUp, isLiveActive]);

  // Stage 0: High-precision time loop
  useEffect(() => {
    let animationFrameId: number;
    const loop = () => {
      if (videoRef.current) {
        setPreciseTime(videoRef.current.currentTime);
      }
      animationFrameId = requestAnimationFrame(loop);
    };

    if (isPlaying) {
      loop();
    } else {
        // One-off update to ensure accuracy when paused/stopped
        if (videoRef.current) setPreciseTime(videoRef.current.currentTime);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying]);

  const handleChatScroll = () => {
      const container = chatContainerRef.current;
      if (!container) return;
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
      setUserScrolledUp(!isAtBottom);
  };

  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  const stopLiveSession = () => {
    if (frameIntervalRef.current) {
        window.clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
    }
    if (liveSessionRef.current) {
        try {
            liveSessionRef.current.disconnect();
        } catch(e) { console.warn("Error disconnecting session", e); }
        liveSessionRef.current = null;
    }
  };

  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (mode === 'draw' && e?.type === 'click' && (e.target as HTMLElement).tagName === 'VIDEO') return;
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else {
          if (drawingPoints.length > 0) setDrawingPoints([]);
          videoRef.current.play().catch(console.warn);
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      setPreciseTime(time); // Stage 0: Immediate update on seek
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
    
    // ... drawing overlay logic for ROI ...
    return canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'draw' || !containerRef.current) return;
    e.stopPropagation(); 
    setDrawingPoints([]);
    const rect = containerRef.current.getBoundingClientRect();
    setIsDrawing(true);
    setDrawingPoints([{ x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        setIsPlaying(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || mode !== 'draw' || !containerRef.current) return;
    e.stopPropagation();
    const rect = containerRef.current.getBoundingClientRect();
    setDrawingPoints(prev => [...prev, { x: e.clientX - rect.left, y: e.clientY - rect.top }]);
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
         await handleTextQuery("What is this?", finalPoints, boundingBox);
    }
  };

  const captureAndSendFrameToLive = () => {
    if (!liveSessionRef.current) return;
    const base64 = getFrameAsBase64();
    if (base64) liveSessionRef.current.sendImage(base64);
  };

  const handleTextQuery = async (queryText: string, points = drawingPoints, bbox = getBoundingBox(drawingPoints)) => {
    if (!queryText.trim()) return;
    
    // Module 5: Context Policy - Capture context
    const imageBase64 = getFrameAsBase64(points);
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: queryText,
      timestamp: Date.now()
    };
    setChatHistory(prev => [...prev, newMessage]);
    setInputText("");
    setIsLoading(true);

    // Call Module 6: Q&A Orchestrator
    const responseData = await generateStructuredResponse(
      newMessage.content as string,
      chatHistory,
      {
        selection: bbox,
        timestamp: videoRef.current?.currentTime || 0,
        image: imageBase64 || undefined
      }
    );

    setIsLoading(false);
    
    // Module 7: Answer Packaging - Store structured Data
    setChatHistory(prev => [...prev, {
      id: (Date.now() + 1).toString(),
      role: 'model',
      content: responseData, 
      timestamp: Date.now()
    }]);
  };

  // --- Live Voice Logic ---
  const toggleLiveMode = async () => {
    if (isLiveActive) {
      stopLiveSession();
      setIsLiveActive(false);
      currentVoiceMessageIdRef.current = null;
      setMicVolume(0);
    } else {
      if (!isApiKeyAvailable()) { alert("API Key missing."); return; }
      if (hasMicPermission === false) { alert("Mic permission denied."); return; }

      try {
        const placeholderId = Date.now().toString();
        currentVoiceMessageIdRef.current = placeholderId;
        setChatHistory(prev => [...prev, {
            id: placeholderId,
            role: 'user',
            content: "Listening...",
            timestamp: Date.now(),
            isVoice: true
        }]);

        const session = new LiveSession(
            (text, isUser) => {
                setChatHistory(prev => {
                    const currentId = currentVoiceMessageIdRef.current;
                    let newHistory = [...prev];
                    if (currentId) {
                        const existingMsgIndex = newHistory.findIndex(m => m.id === currentId);
                        if (existingMsgIndex !== -1 && newHistory[existingMsgIndex].role === (isUser ? 'user' : 'model')) {
                            const currentMsg = newHistory[existingMsgIndex];
                            newHistory[existingMsgIndex] = {
                                ...currentMsg,
                                content: isUser ? text : (currentMsg.content as string) + text
                            };
                            return newHistory;
                        }
                    }
                    const newId = Date.now().toString();
                    currentVoiceMessageIdRef.current = newId;
                    return [...newHistory, {
                        id: newId,
                        role: isUser ? 'user' : 'model',
                        content: text,
                        timestamp: Date.now(),
                        isVoice: true
                    }];
                });
            },
            (vol) => setMicVolume(Math.min(1, vol * 5)) 
        );

        await session.connect();
        liveSessionRef.current = session;
        setIsLiveActive(true);
        if (videoRef.current) {
            videoRef.current.pause();
            setIsPlaying(false);
        }
        frameIntervalRef.current = window.setInterval(captureAndSendFrameToLive, 1000);
      } catch (err) {
        console.error(err);
        setChatHistory(prev => prev.filter(m => m.content !== "Listening..."));
        alert("Failed to connect to Gemini Live.");
      }
    }
  };

  const getSvgPath = () => {
      if (drawingPoints.length === 0) return "";
      const d = drawingPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      return d;
  };

  const clearDrawing = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDrawingPoints([]);
  };

  return (
    <div className="flex h-full bg-slate-900 text-white overflow-hidden">
      <div className="absolute top-4 left-4 z-50 flex items-center gap-3">
        <button onClick={() => onNavigate(AppView.GENERATOR)} className="bg-black/50 hover:bg-black/70 p-2 rounded-full text-white backdrop-blur-sm transition flex items-center gap-2 pr-4">
          <ArrowLeft size={20} /> <span className="text-sm font-medium">Project</span>
        </button>
        <div className={`px-3 py-1.5 rounded-full backdrop-blur-sm border flex items-center gap-2 text-xs font-medium ${hasMicPermission ? 'bg-green-500/20 border-green-500/30 text-green-200' : 'bg-red-500/20 border-red-500/30 text-red-200'}`}>
            {hasMicPermission ? <><CheckCircle2 size={12}/> Mic Ready</> : <><AlertCircle size={12}/> Check Mic</>}
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {/* Main Content */}
      <div className="flex flex-1 h-full min-w-0">
        {/* Video Player */}
        <div className="flex-1 relative flex flex-col justify-center bg-black overflow-hidden" ref={containerRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
          <div className="relative flex-1 flex items-center justify-center overflow-hidden">
            <video ref={videoRef} src={videoSrc} className="w-full h-full object-contain" onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} controls={false} onClick={togglePlay} crossOrigin="anonymous"/>
            
            {/* --- SEMANTIC TELEMETRY DECK (HUD) --- */}
            <div className="absolute top-20 right-6 z-30 pointer-events-none flex flex-col items-end gap-3 w-72 transition-all duration-300">
                
                {/* 1. Timer Panel with Toggle */}
                <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-xl px-4 py-3 shadow-2xl flex items-center justify-between gap-3 w-full pointer-events-auto transition-all hover:bg-slate-900/90">
                    <div className="flex items-center gap-3">
                        <Clock size={18} className="text-brand-500" />
                        <span className="font-mono text-xl font-bold text-white tabular-nums tracking-tight leading-none">
                            <span className="text-slate-500 font-medium text-sm mr-1.5">t=</span>
                            {preciseTime.toFixed(3)}
                            <span className="text-slate-500 text-sm font-medium ml-1">s</span>
                        </span>
                    </div>
                    <button 
                        onClick={() => setIsHudOpen(!isHudOpen)}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                        title={isHudOpen ? "Hide Details" : "Show Details"}
                    >
                        {isHudOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>

                {/* Collapsible Container */}
                <div className={`flex flex-col gap-3 w-full transition-all duration-300 ${isHudOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none h-0 overflow-hidden'}`}>
                    
                    {/* 2. Scene Context Panel */}
                    {currentScene && (
                        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-xl px-4 py-3 shadow-2xl w-full">
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700/50">
                                <LayoutTemplate size={14} className="text-purple-400" />
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Scene {currentScene.scene_id}</span>
                            </div>
                            <h3 className="font-bold text-sm text-white leading-tight mb-1">{currentScene.visual_context.layout.strategy_name}</h3>
                            <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2">{currentScene.visual_context.layout.description}</p>
                        </div>
                    )}

                     {/* 3. Active Actions Panel */}
                     {activeActions.length > 0 && (
                        <div className="bg-slate-900/80 backdrop-blur-md border border-brand-500/30 rounded-xl px-4 py-3 shadow-2xl w-full">
                            <div className="flex items-center gap-2 mb-2">
                                 <Zap size={14} className="text-yellow-400 animate-pulse" />
                                 <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Events</span>
                            </div>
                            <div className="space-y-2">
                                {activeActions.map(action => (
                                    <div key={action.action_id} className="flex flex-col gap-0.5 animate-pulse">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-mono text-brand-300">{action.type}</span>
                                            <span className="text-[10px] text-slate-500">{action.duration_s}s</span>
                                        </div>
                                        <div className="text-[11px] text-white font-medium">
                                            {action.description}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 4. Component Inspector (Math Objects) */}
                    {currentScene && (
                        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-xl p-3 shadow-2xl w-full max-h-[30vh] overflow-y-auto scrollbar-hide">
                             <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Active Components</div>
                             <div className="space-y-2">
                                {currentScene.visual_context.components.map((comp, idx) => (
                                    <div key={idx} className={`text-xs p-2 rounded bg-slate-800/50 border border-slate-700/30 ${activeActions.some(a => a.targets.includes(comp.name)) ? 'border-brand-500/50 bg-brand-900/20' : ''}`}>
                                        <div className="flex justify-between mb-1">
                                            <span className="font-mono text-[10px] text-slate-400">{comp.name}</span>
                                            <span className="text-[9px] bg-slate-700 px-1 rounded text-slate-300">{comp.type}</span>
                                        </div>
                                        {comp.type === 'MathTex' ? (
                                            <div className="text-brand-100 overflow-x-auto">
                                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{comp.content_specs}</ReactMarkdown>
                                            </div>
                                        ) : (
                                            <div className="text-slate-300 truncate">{comp.content_specs}</div>
                                        )}
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}
                </div>
            </div>

            {/* --- SEMANTIC SUBTITLES --- */}
            {currentLine && (
                <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 max-w-2xl w-full px-6 text-center pointer-events-none z-30">
                     <div className="inline-block bg-black/60 backdrop-blur-sm px-6 py-3 rounded-2xl shadow-lg border border-white/10 animate-in slide-in-from-bottom-2 fade-in duration-300">
                         <p className="text-lg md:text-xl font-medium text-white drop-shadow-md leading-relaxed">
                            <ReactMarkdown className="inline" components={{p: React.Fragment}}>{currentLine.text}</ReactMarkdown>
                         </p>
                     </div>
                </div>
            )}

            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                <path d={getSvgPath()} stroke="#0ea5e9" strokeWidth="3" fill="rgba(14, 165, 233, 0.1)" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-lg"/>
            </svg>
            {drawingPoints.length > 0 && <button onClick={clearDrawing} className="absolute top-4 right-4 z-30 bg-black/50 p-2 rounded-full pointer-events-auto hover:bg-black/70 transition-colors"><Eraser size={16} /></button>}
            
            {/* Live Indicator */}
            {isLiveActive && (
                <div className="absolute top-4 right-16 z-30 flex items-center gap-3 bg-slate-900/80 backdrop-blur px-4 py-2 rounded-full border border-slate-700">
                    <div className="flex items-center gap-1.5"><span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span><span className="text-xs font-bold text-white tracking-wide">LIVE</span></div>
                    <div className="flex items-end gap-0.5 h-4 w-12">{[0,1,2,3,4].map(i => <div key={i} className="w-2 bg-brand-500 rounded-sm transition-all" style={{height:`${Math.max(20, Math.min(100, micVolume*100*(1+i/2)))}%`}}></div>)}</div>
                </div>
            )}
          </div>

          {/* Controls */}
          <div className="h-16 bg-gradient-to-t from-black/90 to-transparent px-6 flex items-center gap-4 z-20 shrink-0">
             <button onClick={togglePlay} className="text-white hover:text-brand-400 transition-colors">{isPlaying ? <Pause size={24}/> : <Play size={24}/>}</button>
             <div className="flex-1 flex items-center gap-3">
                <span className="text-xs font-mono text-slate-300 w-10 text-right">{formatTime(currentTime)}</span>
                <input type="range" min="0" max={duration || 100} value={currentTime} onChange={handleSeek} className="flex-1 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:bg-brand-500 hover:[&::-webkit-slider-thumb]:bg-brand-400 transition-all"/>
                <span className="text-xs font-mono text-slate-300 w-10">{formatTime(duration)}</span>
             </div>
             <button onClick={toggleDrawingMode} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${mode === 'draw' ? 'bg-brand-600 text-white shadow-lg' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}>
                <BoxSelect size={18} /> {mode === 'draw' ? 'Active' : 'Draw'}
             </button>
          </div>
        </div>

        {/* Sidebar: Q&A */}
        <div className="w-[400px] bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl z-40 shrink-0 h-full max-h-screen">
           <div className="p-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur flex justify-between items-center shrink-0">
             <div>
                <h2 className="text-lg font-semibold flex items-center gap-2"><MessageSquare size={18} className="text-brand-400"/> {session?.videoName || "Session"}</h2>
             </div>
           </div>

           <div ref={chatContainerRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
             {chatHistory.length === 0 && <div className="text-center text-slate-500 mt-10 text-sm">Use <b>Draw</b> to circle an area on the video to ask specific questions.</div>}
             
             {chatHistory.map((msg) => (
               <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm transition-all ${msg.role === 'user' ? 'bg-brand-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'} ${msg.isVoice ? 'ring-2 ring-brand-400/30' : ''}`}>
                   
                   {/* Header for Voice/User messages */}
                   {msg.role === 'user' && msg.isVoice && <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 mb-1 flex items-center gap-1"><Activity size={10} className="animate-pulse" /> Live Voice</span>}
                   
                   {/* CONTENT RENDERING LOGIC */}
                   {typeof msg.content === 'string' ? (
                       // Standard Text / Voice Stream / Loading
                       <div className="markdown-body">
                           {(isLiveActive && msg.id === currentVoiceMessageIdRef.current) ? (
                               <div className="whitespace-pre-wrap font-sans">{msg.content}<span className="inline-block w-1.5 h-4 ml-1 bg-current align-middle animate-pulse"></span></div>
                           ) : (
                               <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.content}</ReactMarkdown>
                           )}
                       </div>
                   ) : (
                       // Structured Answer Card (Module 7 output)
                       <AnswerCard 
                           data={msg.content as AnswerCardData} 
                           onQuestionClick={(q) => handleTextQuery(q)}
                       />
                   )}
                 </div>
               </div>
             ))}
             {isLoading && <div className="flex justify-start"><div className="bg-slate-800 text-slate-400 rounded-2xl px-4 py-3 text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin"/> Analyzing context (ROI)...</div></div>}
             <div ref={chatEndRef} />
           </div>

           <div className="p-4 border-t border-slate-800 bg-slate-900 shrink-0">
             <div className="flex items-center gap-2 mb-2">
                <button onClick={toggleLiveMode} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${isLiveActive ? 'bg-red-500/10 text-red-500 border border-red-500/50' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                  {isLiveActive ? "Stop Voice Session" : <><Mic size={16} /> Live Voice Mode</>}
                </button>
             </div>
             <div className="relative">
               <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleTextQuery(inputText)} placeholder={isLiveActive ? "Speak now..." : "Ask a question about the video..."} className="w-full bg-slate-800 text-white rounded-lg pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none placeholder-slate-500" disabled={isLiveActive}/>
               <button onClick={() => handleTextQuery(inputText)} disabled={!inputText.trim() || isLiveActive} className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 text-brand-400 hover:text-brand-300 disabled:text-slate-600"><Send size={18} /></button>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerView;