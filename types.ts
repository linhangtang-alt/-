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
  SCRIPT = 'Script Generation',
  VISUAL_PLAN = 'Visual Planner',
  MOTION = 'Motion Designer',
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

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  isVoice?: boolean;
}

export interface VideoMetadata {
  id: string;
  title: string;
  url: string;
  duration: number;
}