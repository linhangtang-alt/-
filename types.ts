
export enum AppView {
  GENERATOR = 'GENERATOR',
  PLAYER = 'PLAYER'
}

export enum PipelineStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export enum AgentStage {
  INGEST = 'Ingest & Normalize',
  KNOWLEDGE = 'Knowledge Graph',
  SCRIPT = 'Script Agent',
  VISUAL_PLAN = 'Visual Planner',
  MOTION = 'Motion Designer',
  CODE_GEN = 'Manim Compiler',
  RENDER = 'Final Render',
  ERROR = 'Error'
}

export interface AgentLog {
  id: string;
  stage: AgentStage;
  message: string;
  timestamp: number;
  status: 'info' | 'success' | 'warning';
}

export interface SelectionBox {
  x: number;
  y: number;
  width: number;
  // Fix: Add 'height' property to SelectionBox interface
  height: number; 
}

// Stage 5: Context Tiers
export enum ContextTier {
  S = 'S', // Small: current frame + ROI, t +/- 5s clip, current +/- 1 script line
  M = 'M', // Medium: current frame + ROI, t +/- 10s clip, current +/- 2 script lines
  L = 'L', // Large: current frame + ROI, t +/- 20s clip, current +/- 3 script lines
}

// Represents the pre-calculated context bundle for a specific tier
export interface ContextualBundle {
  tier: ContextTier;
  clipRange: { start: number; end: number };
  scriptWindow: string;
}

// Context data passed to the AI model
export interface ContextData {
  selection?: SelectionBox;
  timestamp: number;
  image?: string; // Base64 annotated image (common across tiers for now)
  currentTier?: ContextTier; // The tier for the current specific API call
  contextualBundle?: ContextualBundle; // The specific bundle being sent for this call
}

// Module 7: Answer Packaging Agent Structure
export interface AnswerCardData {
  title: string;
  answer: string;
  key_terms?: Array<{term: string, definition: string}>;
  confidence?: number; // Added for Stage 7
  suggested_followups?: string[];
  is_voice_stream?: boolean; // For Live API fallback
  // Stage 5: Context Policy feedback
  needs_more_context?: boolean;
  suggested_context_tier?: ContextTier;
  suggested_rewind_time?: number; // Added for Stage 7
}

// Stage 8: Live Answer Summary for Function Calling
export interface LiveAnswerCardSummary {
  title: string;
  key_points: string[]; // Simpler list of strings for live summary
  suggested_rewind_time?: number;
}


export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string | AnswerCardData; // Can be string (Voice) or Structured Card (Text)
  timestamp: number;
  isVoice?: boolean;
  videoTimestamp?: number; // Capture specific video time when message was sent
  contextualImage?: string; // Base64 image with ROI drawn, for user message display
  contextualClipRange?: { start: number; end: number }; // Time range for clip, for user message display
  contextualScriptWindow?: string; // Relevant script lines at query time, for user message display
  contextTierUsed?: ContextTier; // Stage 5: The final context tier used for this query
}

export interface VideoMetadata {
  id: string;
  title: string;
  url: string;
  duration: number;
}

export interface GeneratedArtifacts {
  script?: string;
  visualPlan?: string;
  manimCode?: string;
}

// --- Semantic Scene Data Types ---

export interface VisualComponent {
  name: string;
  type: 'ScatterPoints' | 'LinePlot' | 'MathTex' | 'Text' | 'Shape' | 'Arrow' | 'Axes2D' | 'CalloutBox';
  region: string;
  content_specs: string;
}

export interface SceneAction {
  action_id: string;
  type: 'enter' | 'transform' | 'draw' | 'emphasis' | 'value_update' | 'move';
  targets: string[];
  description: string;
  track: string;
  layer: number;
  start_s: number;
  duration_s: number;
}

export interface ScriptLine {
  line_id: string;
  text: string;
  start_s: number;
  end_s: number;
}

export interface SceneData {
  scene_id: string;
  start_time: number;
  end_time: number;
  visual_context: {
    layout: {
      strategy_name: string;
      description: string;
      regions: Array<{ name: string; bounds: string; purpose: string }>;
    };
    frame_description: string;
    components: VisualComponent[];
  };
  lines: ScriptLine[];
  actions: SceneAction[];
}

export interface SemanticVideoData {
  meta: {
    project_id: string;
    language: string;
    version: string;
  };
  scenes: SceneData[];
}

export interface SavedSession {
  id: string;
  videoFile?: File; // Optional now, as we might rely on videoUrl
  videoUrl?: string; // URL from backend
  videoName: string;
  thumbnail?: string;
  timestamp: number;
  chatHistory: ChatMessage[];
  lastAccessed: number;
  artifacts?: GeneratedArtifacts;
  semanticData?: SemanticVideoData; // Backend generated scene data
}
