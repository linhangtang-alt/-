import { GoogleGenAI, LiveServerMessage, Modality, Type, Schema, GenerateContentResponse } from "@google/genai";
import { ChatMessage, AgentStage, AnswerCardData } from "../types";

// Check for API Key
const API_KEY = process.env.API_KEY;

export const isApiKeyAvailable = (): boolean => {
  return !!API_KEY;
};

// --- Resilience Helper ---
async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseDelay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    // Retry on 5xx server errors or network-related XHR errors
    const isNetworkOrServerError = 
      (error.status && error.status >= 500) || 
      (error.message && (
        error.message.includes('xhr error') || 
        error.message.includes('fetch failed') ||
        error.message.includes('Rpc failed')
      ));

    if (retries > 0 && isNetworkOrServerError) {
      console.warn(`API Error (${error.message}). Retrying in ${baseDelay}ms... (Attempts left: ${retries})`);
      await new Promise(resolve => setTimeout(resolve, baseDelay));
      return withRetry(fn, retries - 1, baseDelay * 2);
    }
    throw error;
  }
}

// --- Module 7: Answer Packaging Schema ---
const answerCardSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "A short, relevant title for the answer based on the visual element selected." },
    answer: { type: Type.STRING, description: "The direct educational explanation in English. Use Markdown/LaTeX." },
    key_terms: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          term: { type: Type.STRING },
          definition: { type: Type.STRING }
        }
      },
      description: "Definitions of 1-3 complex technical terms used in the answer."
    },
    suggested_followups: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2-3 relevant follow-up questions the user might ask next."
    }
  },
  required: ["title", "answer"]
};

// --- Pipeline Agents Service (Backend Simulation) ---

export const generatePipelineAssets = async (
  fileName: string, 
  stage: AgentStage,
  previousContext: string = ""
): Promise<string> => {
  if (!API_KEY) return "Simulation: API Key missing.";

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const model = "gemini-3-flash-preview";

  let systemPrompt = "";
  let userPrompt = "";

  switch (stage) {
    case AgentStage.SCRIPT:
      systemPrompt = `You are the Script Agent (Module 3). 
      Input: A topic based on the filename "${fileName}".
      Output: A structured educational video script outline inspired by 3blue1brown.
      Format: Markdown with sections (Intro, Concept, visual cues).`;
      userPrompt = `Generate a 3-minute video script outline for: ${fileName}`;
      break;

    case AgentStage.VISUAL_PLAN:
      systemPrompt = `You are the Visual Planner Agent (Module 6).
      Input: A script outline.
      Output: A visual plan mapping script sections to visual geometries (Matrices, Graphs, 3D Surfaces).`;
      userPrompt = `Based on this script, describe the visual scenes:\n${previousContext}`;
      break;

    case AgentStage.CODE_GEN:
      systemPrompt = `You are the Manim Code Generator Agent (Module 9).
      Input: Visual description.
      Output: Python code using the Manim library to render the scene.
      Constraint: Write valid Python code.`;
      userPrompt = `Generate Manim Python code for this scene:\n${previousContext.slice(0, 500)}...`;
      break;
      
    default:
      return "";
  }

  try {
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model,
      contents: { role: 'user', parts: [{ text: userPrompt }] },
      config: { systemInstruction: systemPrompt }
    }));
    return response.text || "";
  } catch (e) {
    console.error(`Agent ${stage} failed`, e);
    return `[System Error] Could not generate ${stage}. Please try again.`;
  }
};

// --- Player Q&A Service (Module 6: Q&A Orchestrator) ---

export const generateStructuredResponse = async (
  prompt: string,
  history: ChatMessage[],
  context?: { selection: any, timestamp: number, image?: string }
): Promise<AnswerCardData> => {
  if (!API_KEY) {
    return {
      title: "API Key Missing",
      answer: "Please configure your API Key to use the InsightStream Q&A agents.",
      suggested_followups: ["How do I get an API key?"]
    };
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  // 1. Context Policy (Module 5) - "S" Tier by default (Image + Roi + Timestamp)
  const parts: any[] = [];

  if (context?.image) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: context.image
      }
    });
  }

  let fullPrompt = `User Question: "${prompt}"`;
  
  if (context) {
    fullPrompt = `
    [Context - Timestamp: ${context.timestamp.toFixed(2)}s]
    [Context - Selection ROI: ${JSON.stringify(context.selection)}]
    
    ${fullPrompt}
    `;
  }

  parts.push({ text: fullPrompt });

  try {
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { role: 'user', parts: parts },
      config: {
        systemInstruction: `You are the Q&A Orchestrator Agent (Module 6) for InsightStream.
        
        Role: Explain educational concepts in videos (3blue1brown style) based on user selection.
        
        Rules:
        1. Analyze the image and the red/blue selection box (if present).
        2. Identify the mathematical symbol, graph, or object selected.
        3. Explain it clearly in English. Use LaTeX for math.
        4. Populate the JSON response strictly.`,
        responseMimeType: "application/json",
        responseSchema: answerCardSchema
      }
    }));

    const jsonText = response.text || "{}";
    try {
      return JSON.parse(jsonText) as AnswerCardData;
    } catch (parseError) {
      console.error("JSON Parse Error", parseError);
      return {
        title: "Parsing Error",
        answer: response.text || "Raw output received.",
        is_voice_stream: false
      };
    }

  } catch (error: any) {
    console.error("Gemini Q&A Error:", error);
    const errorMsg = error.message || "Unknown error";
    return {
      title: "Connection Error",
      answer: `Failed to reach the reasoning engine. (${errorMsg})`,
    };
  }
};

// --- Live API Service (Voice) - Optimized for Low Latency ---

export class LiveSession {
  private ai: GoogleGenAI;
  private session: any; 
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private onMessageCallback: (text: string, isUser: boolean) => void;
  private onVolumeCallback: (volume: number) => void;

  constructor(
      onMessage: (text: string, isUser: boolean) => void, 
      onVolume?: (volume: number) => void
  ) {
    this.onMessageCallback = onMessage;
    this.onVolumeCallback = onVolume || (() => {});
    this.ai = new GoogleGenAI({ apiKey: API_KEY || '' });
  }

  async connect() {
    if (!API_KEY) throw new Error("No API Key");

    // 1. Output Context: 24kHz (Matches Gemini's Native Output)
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.outputAudioContext = new AudioContextClass({ sampleRate: 24000 });
    
    // 2. Input Context: 16kHz (Matches Gemini's Required Input)
    this.inputAudioContext = new AudioContextClass({ sampleRate: 16000 });

    if (this.outputAudioContext.state === 'suspended') await this.outputAudioContext.resume();
    if (this.inputAudioContext.state === 'suspended') await this.inputAudioContext.resume();

    // 3. Get User Media with Echo Cancellation
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        } 
    });

    const sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          console.log("Live Session Opened");
          this.startAudioStream(sessionPromise);
        },
        onmessage: (message: LiveServerMessage) => this.handleMessage(message),
        onclose: () => console.log("Live Session Closed"),
        onerror: (e) => console.error("Live Session Error", e),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        systemInstruction: `You are InsightStream AI.
        1. Speak EXACTLY like a human tutor.
        2. Detect the user's language and respond in that language.
        3. Be concise.`,
        inputAudioTranscription: {},
        outputAudioTranscription: {}, 
      },
    });

    this.session = sessionPromise;
  }

  public sendImage(base64Data: string) {
    if (!this.session) return;
    this.session.then((session: any) => {
        try {
            session.sendRealtimeInput({
                media: {
                    mimeType: "image/jpeg",
                    data: base64Data
                }
            });
        } catch(e) {
            console.error("Error sending image frame", e);
        }
    });
  }

  private startAudioStream(sessionPromise: Promise<any>) {
    if (!this.inputAudioContext || !this.mediaStream) return;
    
    this.source = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
    
    this.processor = this.inputAudioContext.createScriptProcessor(2048, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        let sum = 0;
        for (let i = 0; i < inputData.length; i += 4) {
            sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / (inputData.length / 4));
        this.onVolumeCallback(rms);

        const pcmBase64 = this.float32ToInt16Base64(inputData);

        sessionPromise.then((session) => {
            session.sendRealtimeInput({ 
                media: {
                    mimeType: 'audio/pcm;rate=16000',
                    data: pcmBase64
                }
            });
        });
    };

    this.source.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private float32ToInt16Base64(float32: Float32Array): string {
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      let binary = '';
      const bytes = new Uint8Array(int16.buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
  }

  private async handleMessage(message: LiveServerMessage) {
    if (message.serverContent?.inputTranscription?.text) {
        this.onMessageCallback(message.serverContent.inputTranscription.text, true);
    }
    if (message.serverContent?.outputTranscription?.text) {
        this.onMessageCallback(message.serverContent.outputTranscription.text, false);
    }

    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext) {
        const currentTime = this.outputAudioContext.currentTime;
        if (this.nextStartTime < currentTime) {
            this.nextStartTime = currentTime;
        }

        try {
            const binaryString = atob(base64Audio);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const dataInt16 = new Int16Array(bytes.buffer);
            
            const buffer = this.outputAudioContext.createBuffer(1, dataInt16.length, 24000);
            const channelData = buffer.getChannelData(0);
            for(let i=0; i<channelData.length; i++) {
                channelData[i] = dataInt16[i] / 32768.0;
            }

            const source = this.outputAudioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(this.outputAudioContext.destination);
            
            source.start(this.nextStartTime);
            this.nextStartTime += buffer.duration;
            this.sources.add(source);
            
            source.onended = () => this.sources.delete(source);
        } catch (e) {
            console.error("Audio Decode Error", e);
        }
    }
    
    if (message.serverContent?.interrupted) {
        this.sources.forEach(s => {
            try { s.stop(); } catch(e) {}
        });
        this.sources.clear();
        this.nextStartTime = 0;
    }
  }

  disconnect() {
    if (this.processor) {
        this.processor.disconnect();
        this.processor.onaudioprocess = null;
    }
    if (this.source) {
        this.source.disconnect();
    }
    if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (this.inputAudioContext && this.inputAudioContext.state !== 'closed') {
      this.inputAudioContext.close();
    }
    if (this.outputAudioContext && this.outputAudioContext.state !== 'closed') {
      this.outputAudioContext.close();
    }
    this.sources.clear();
  }
}