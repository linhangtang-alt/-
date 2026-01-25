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
  height: number;
}

// Module 7: Answer Packaging Agent Structure
export interface AnswerCardData {
  title: string;
  answer: string;
  key_terms?: Array<{term: string, definition: string}>;
  confidence?: number;
  suggested_followups?: string[];
  is_voice_stream?: boolean; // For Live API fallback
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string | AnswerCardData; // Can be string (Voice) or Structured Card (Text)
  timestamp: number;
  isVoice?: boolean;
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