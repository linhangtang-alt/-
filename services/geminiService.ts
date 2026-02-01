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
        error.message.includes('Rpc failed') ||
        error.message.includes('NetworkError')
      ));

    if (retries > 0 && isNetworkOrServerError) {
      console.warn(`API Error (${error.message}). Retrying in ${baseDelay}ms... (Attempts left: ${retries})`);
      await new Promise(resolve => setTimeout(resolve, baseDelay));
      return withRetry(fn, retries - 1, baseDelay * 2);
    }
    
    // Provide a more helpful error if it looks like a block
    if (error.message && (error.message.includes('xhr error') || error.message.includes('Rpc failed'))) {
        console.error("Connection Blocked: This error often indicates an AdBlocker or Firewall is preventing access to Google AI services.");
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
    
    // Check specifically for the xhr error 6
    if (errorMsg.includes("xhr error") || errorMsg.includes("code: 6")) {
        return {
            title: "Network Error",
            answer: "Unable to connect to Google AI services. This is often caused by AdBlockers or privacy extensions. Please pause them and try again.",
        };
    }

    return {
      title: "Connection Error",
      answer: `Failed to reach the reasoning engine. (${errorMsg})`,
    };
  }
};

// --- Live API Service (Voice) - Optimized for Low Latency ---

// Helper to base64 encode
function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to base64 decode
function base64ToArrayBuffer(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

export class LiveSession {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null; // For visualization
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private onMessageCallback: (text: string, isUser: boolean) => void;
  private onVolumeCallback: (volume: number) => void;
  private onCloseCallback: () => void;

  constructor(
      onMessage: (text: string, isUser: boolean) => void, 
      onVolume?: (volume: number) => void,
      onClose?: () => void
  ) {
    this.onMessageCallback = onMessage;
    this.onVolumeCallback = onVolume || (() => {});
    this.onCloseCallback = onClose || (() => {});
    this.ai = new GoogleGenAI({ apiKey: API_KEY || '' });
  }

  async connect(systemInstruction: string = "You are a helpful AI tutor.") {
    if (!API_KEY) throw new Error("No API Key");

    // 1. Output Context: 24kHz (Matches Gemini's Native Output for high quality)
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.outputAudioContext = new AudioContextClass({ sampleRate: 24000 });
    
    // Create Analyser for visualization
    this.analyser = this.outputAudioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.5;
    this.analyser.connect(this.outputAudioContext.destination);

    // 2. Input Context: 16kHz (Matches Gemini's Required Input)
    // We explicitly request 16kHz to avoid resampling artifacts if possible.
    this.inputAudioContext = new AudioContextClass({ sampleRate: 16000 });

    // Resume contexts if suspended (browser requirement for autoplay)
    if (this.outputAudioContext.state === 'suspended') await this.outputAudioContext.resume();
    if (this.inputAudioContext.state === 'suspended') await this.inputAudioContext.resume();

    // 3. Get User Media with Echo Cancellation
    // We request sampleRate 16000 from the hardware as well.
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
            channelCount: 1,
            sampleRate: 16000, 
            echoCancellation: true,
            noiseSuppression: true,
        } 
    });

    // 4. Connect to Gemini Live
    // NOTE: Using the "gemini-2.5-flash-native-audio-preview-12-2025" model as required for Live API
    this.sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          console.log("Live Session Opened");
          this.startAudioStream();
        },
        onmessage: (message: LiveServerMessage) => this.handleMessage(message),
        onclose: () => {
             console.log("Live Session Closed");
             this.cleanup();
             this.onCloseCallback();
        },
        onerror: (e) => {
             console.error("Live Session Error", e);
             this.cleanup();
             this.onCloseCallback();
        },
      },
      config: {
        responseModalities: [Modality.AUDIO], // MUST be AUDIO for Live API
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        systemInstruction: { parts: [{ text: systemInstruction }] },
        inputAudioTranscription: {}, // Request transcription of user speech
        outputAudioTranscription: {}, // Request transcription of model speech
      },
    });

    await this.sessionPromise;
  }

  public sendImage(base64Data: string) {
    if (!this.sessionPromise) return;
    // Always use the promise to send data to avoid race conditions
    this.sessionPromise.then((session: any) => {
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

  // Poll for current output volume (0.0 to 1.0) for UI visualization
  public getOutputVolume(): number {
    if (!this.analyser) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    return average / 255; // Normalize to 0-1
  }

  private startAudioStream() {
    if (!this.inputAudioContext || !this.mediaStream || !this.sessionPromise) return;
    
    this.source = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
    
    // Use ScriptProcessor for wide browser support without external files
    // Buffer size 4096 gives ~256ms latency at 16kHz
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
        if (!this.sessionPromise) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate Volume (RMS) for visualizer (User Input)
        let sum = 0;
        for (let i = 0; i < inputData.length; i += 4) {
            sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / (inputData.length / 4));
        this.onVolumeCallback(rms);

        // Convert Float32 to Int16 PCM for Gemini
        const pcmBase64 = this.createPcmData(inputData);

        // Send to Gemini via the promise to ensure session is ready
        this.sessionPromise.then((session) => {
            try {
                session.sendRealtimeInput({ 
                    media: {
                        mimeType: 'audio/pcm;rate=16000',
                        data: pcmBase64
                    }
                });
            } catch(e) {
                console.error("Error sending audio chunk", e);
            }
        });
    };

    this.source.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  // Converts Float32Array (Web Audio API default) to 16-bit PCM Base64 string
  // Gemini expects Little Endian 16-bit PCM
  private createPcmData(data: Float32Array): string {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        // Clamp between -1 and 1 and scale to 16-bit signed integer range
        const s = Math.max(-1, Math.min(1, data[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return arrayBufferToBase64(int16.buffer);
  }

  private async handleMessage(message: LiveServerMessage) {
    // 1. Handle Transcriptions (Text Update)
    if (message.serverContent?.inputTranscription?.text) {
        this.onMessageCallback(message.serverContent.inputTranscription.text, true);
    }
    if (message.serverContent?.outputTranscription?.text) {
        this.onMessageCallback(message.serverContent.outputTranscription.text, false);
    }

    // 2. Handle Audio Output (PCM Playback)
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext && this.analyser) {
        try {
            // Decode Base64 to ArrayBuffer
            const audioDataBuffer = base64ToArrayBuffer(base64Audio);
            
            // Convert Raw PCM to AudioBuffer
            const audioBuffer = this.pcmToAudioBuffer(audioDataBuffer, this.outputAudioContext);

            // Schedule Playback (Gapless)
            const currentTime = this.outputAudioContext.currentTime;
            
            // If nextStartTime is in the past (underrun), reset it to now to avoid skipping
            if (this.nextStartTime < currentTime) {
                this.nextStartTime = currentTime;
            }

            const source = this.outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            
            // Connect to Analyser (Visualizer) then to Destination (Speakers)
            source.connect(this.analyser);
            
            source.start(this.nextStartTime);
            this.nextStartTime += audioBuffer.duration;
            
            this.sources.add(source);
            source.onended = () => this.sources.delete(source);
        } catch (e) {
            console.error("Audio Decode Error", e);
        }
    }
    
    // 3. Handle Interruption (User spoke, model should stop)
    if (message.serverContent?.interrupted) {
        this.sources.forEach(s => {
            try { s.stop(); } catch(e) {}
        });
        this.sources.clear();
        this.nextStartTime = 0;
    }
  }

  // Custom PCM decoder: Converts 16-bit Little Endian PCM -> AudioBuffer
  private pcmToAudioBuffer(buffer: ArrayBuffer, ctx: AudioContext): AudioBuffer {
    const dataInt16 = new Int16Array(buffer);
    const float32 = new Float32Array(dataInt16.length);
    
    for (let i = 0; i < dataInt16.length; i++) {
        float32[i] = dataInt16[i] / 32768.0;
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000); // Output is 24kHz
    audioBuffer.getChannelData(0).set(float32);
    return audioBuffer;
  }

  disconnect() {
    // Send close frame to server if connected
    if (this.sessionPromise) {
        this.sessionPromise.then((s: any) => {
             try { s.close(); } catch(e) { console.warn("Session already closed"); }
        });
    }
    this.cleanup();
  }

  private cleanup() {
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
    this.sessionPromise = null;
    this.analyser = null;
  }
}