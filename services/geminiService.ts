import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import { ChatMessage, AgentStage, AnswerCardData, ContextData, ContextTier, ContextualBundle, SelectionBox, LiveAnswerCardSummary, SemanticVideoData } from "../types";

// Check for API Key
const API_KEY = process.env.API_KEY;

export const isApiKeyAvailable = (): boolean => {
  return !!API_KEY;
};

// --- Tool Definitions ---
const liveAnswerCardSummaryFunctionDeclaration: FunctionDeclaration = {
  name: 'summarizeLiveResponse',
  parameters: {
    type: Type.OBJECT,
    description: 'Summarize the spoken explanation into a concise card.',
    properties: {
      title: { type: Type.STRING },
      key_points: { type: Type.ARRAY, items: { type: Type.STRING } },
      suggested_rewind_time: { 
          type: Type.NUMBER,
          description: 'An absolute timestamp in the video (in seconds) that is most relevant for rewinding to. Should be based on the provided visual context and conversation, not a relative value from the start of a clip.'
      }
    },
    required: ['title', 'key_points']
  }
};

// --- Types ---
export type LiveSessionUpdate = {
  text?: string;
  structuredData?: LiveAnswerCardSummary;
  isUser: boolean;
  messageId: string;
  isTurnComplete: boolean;
};

type LiveMessageCallback = (update: LiveSessionUpdate) => void;

// --- System Instructions ---
const VIDEO_TUTOR_SYSTEM_INSTRUCTION = `You are an expert AI tutor for video learning.
Your goal is to help users understand the video content by analyzing their queries in the context of the specific video moment.
Analyze the provided visual context (ROI), timestamp, and semantic scene data to provide accurate, concise, and helpful answers.
For text queries, always return a structured JSON response matching the AnswerCardData schema.
For live audio interactions, be conversational, brief, and encouraging.
If the user speaks a language other than English (e.g., Chinese), first provide an English translation of their query labeled 'Translation:', then answer in the user's language.`;

const MAX_ATTEMPTS = 3;
const INITIAL_BACKOFF_MS = 3000; // Increased to 3s for better quota recovery window

/**
 * Orchestrates the Q&A process by sending a query and context to Gemini.
 * Uses a tiered fallback system to handle the 429 Resource Exhausted errors.
 */
export const orchestrateQnA = async (
  query: string,
  context: ContextData,
  semanticData?: SemanticVideoData
): Promise<{ answer: AnswerCardData, finalTier: ContextTier }> => {
  
  // Extreme Fallback Strategy: Pro 3 -> Flash 3 -> Flash Stable -> Flash Lite Stable
  const modelsToTry = [
    'gemini-3-pro-preview', 
    'gemini-3-flash-preview', 
    'gemini-flash-latest', 
    'gemini-flash-lite-latest'
  ];
  
  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const ai = new GoogleGenAI({ apiKey: API_KEY || '' });
        
        const prompt = `
          User Query: ${query}
          Current Timestamp: ${context.timestamp}s
          Context Tier: ${context.currentTier}
          
          Video Semantic Data: ${JSON.stringify(semanticData)}
          Contextual Bundle: ${JSON.stringify(context.contextualBundle)}
        `;

        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction: VIDEO_TUTOR_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                answer: { type: Type.STRING },
                key_terms: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      term: { type: Type.STRING },
                      definition: { type: Type.STRING }
                    }
                  }
                },
                confidence: { type: Type.NUMBER },
                suggested_followups: { type: Type.ARRAY, items: { type: Type.STRING } },
                needs_more_context: { type: Type.BOOLEAN },
                suggested_context_tier: { type: Type.STRING },
                suggested_rewind_time: { 
                    type: Type.NUMBER,
                    description: 'An absolute timestamp in the video (in seconds) that is most relevant for rewinding to.'
                }
              },
              required: ['title', 'answer']
            }
          }
        });

        const text = response.text;
        const answer = JSON.parse(text || '{}');
        return {
            answer,
            finalTier: context.currentTier || ContextTier.S
        };
      } catch (e: any) {
        const errorStr = e.toString().toLowerCase();
        const isRateLimitError = errorStr.includes('429') || 
                                 errorStr.includes('resource_exhausted') || 
                                 errorStr.includes('quota');

        console.warn(`[GeminiService] ${modelName} (Attempt ${attempt}) failed:`, errorStr);

        if (isRateLimitError && attempt < MAX_ATTEMPTS) {
          // Add random jitter to prevent synchronized retries
          const jitter = Math.random() * 1000 - 500; 
          const backoffTime = (INITIAL_BACKOFF_MS * (2 ** (attempt - 1))) + jitter;
          console.log(`[GeminiService] Quota hit. Waiting ${Math.round(backoffTime)}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          continue; 
        } 
        
        if (isRateLimitError && modelName !== modelsToTry[modelsToTry.length - 1]) {
           console.log(`[GeminiService] Exhausted all retries for ${modelName}. Trying next model tier...`);
           break; // Move to next model in modelsToTry
        }

        if (!isRateLimitError || modelName === modelsToTry[modelsToTry.length - 1]) {
           throw new Error(isRateLimitError ? "RATE_LIMIT_EXCEEDED" : "API_ERROR");
        }
      }
    }
  }

  throw new Error("Failed to process request with all available models.");
};

// --- Audio Encoding/Decoding Helpers ---

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export class LiveSession {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null; 
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private onMessageCallback: LiveMessageCallback;
  private onCloseCallback: () => void;
  private currentInputMessageId: string | null = null;
  private currentModelMessageId: string | null = null;
  private inputAudioEnabled: boolean = false;

  constructor(
      onMessage: LiveMessageCallback,
      onClose?: () => void
  ) {
    this.onMessageCallback = onMessage;
    this.onCloseCallback = onClose || (() => {});
    this.ai = new GoogleGenAI({ apiKey: API_KEY || '' });
  }

  public getCurrentInputMessageId(): string {
    if (!this.currentInputMessageId) {
        this.currentInputMessageId = Date.now().toString();
    }
    return this.currentInputMessageId;
  }

  async connect(systemInstruction: string = VIDEO_TUTOR_SYSTEM_INSTRUCTION) {
    if (!API_KEY) throw new Error("No API Key");

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.outputAudioContext = new AudioContextClass({ sampleRate: 24000 });
    this.outputAnalyser = this.outputAudioContext.createAnalyser();
    this.outputAnalyser.fftSize = 256;
    this.outputAnalyser.connect(this.outputAudioContext.destination);

    this.inputAudioContext = new AudioContextClass({ sampleRate: 16000 });
    this.inputAnalyser = this.inputAudioContext.createAnalyser();
    this.inputAnalyser.fftSize = 256;

    if (this.outputAudioContext.state === 'suspended') await this.outputAudioContext.resume();
    if (this.inputAudioContext.state === 'suspended') await this.inputAudioContext.resume();

    this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true } 
    });

    this.sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          this.inputAudioEnabled = false;
          this.startAudioStream();
        },
        onmessage: (message: LiveServerMessage) => this.handleMessage(message),
        onclose: () => {
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
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
        },
        systemInstruction: systemInstruction,
        inputAudioTranscription: {}, 
        tools: [{ functionDeclarations: [liveAnswerCardSummaryFunctionDeclaration] }]
      },
    });

    await this.sessionPromise;
  }

  private async handleMessage(message: LiveServerMessage) {
    if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
        const base64EncodedAudioString = message.serverContent.modelTurn.parts[0].inlineData.data;
        if (this.outputAudioContext) {
            this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
            const audioBuffer = await decodeAudioData(
                decode(base64EncodedAudioString),
                this.outputAudioContext,
                24000,
                1
            );
            const source = this.outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.outputAnalyser!);
            source.start(this.nextStartTime);
            this.nextStartTime += audioBuffer.duration;
            this.sources.add(source);
            source.onended = () => this.sources.delete(source);
        }
    }

    const serverContent = message.serverContent;
    if (serverContent) {
        if (serverContent.inputTranscription) {
            this.onMessageCallback({
                text: serverContent.inputTranscription.text,
                isUser: true,
                messageId: this.getCurrentInputMessageId(),
                isTurnComplete: false
            });
        }

        if (serverContent.modelTurn) {
            for (const part of serverContent.modelTurn.parts) {
                if (part.text) {
                    if (!this.currentModelMessageId) {
                        this.currentModelMessageId = Date.now().toString();
                    }
                    this.onMessageCallback({
                        text: part.text,
                        isUser: false,
                        messageId: this.currentModelMessageId,
                        isTurnComplete: false
                    });
                }
            }
        }

        if (serverContent.turnComplete) {
            this.onMessageCallback({
                isUser: true, 
                messageId: this.getCurrentInputMessageId(),
                isTurnComplete: true,
                text: ''
            });
            this.currentInputMessageId = null; 
            
            if (this.currentModelMessageId) {
                 this.onMessageCallback({
                    isUser: false,
                    messageId: this.currentModelMessageId,
                    isTurnComplete: true,
                    text: ''
                });
                this.currentModelMessageId = null;
            }
        }
    }

    if (message.toolCall) {
      for (const fc of message.toolCall.functionCalls) {
        if (fc.name === 'summarizeLiveResponse') {
          if (!this.currentModelMessageId) {
              this.currentModelMessageId = Date.now().toString();
          }
          this.onMessageCallback({
              structuredData: fc.args as unknown as LiveAnswerCardSummary,
              isUser: false,
              messageId: this.currentModelMessageId,
              isTurnComplete: true 
          });

          this.sessionPromise?.then(session => {
            session.sendToolResponse({
              functionResponses: {
                id: fc.id,
                name: fc.name,
                response: { result: "Displaying summary card to user." }
              }
            });
          });
        }
      }
    }
  }

  private startAudioStream() {
    if (!this.inputAudioContext || !this.mediaStream) return;
    
    const source = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
    const processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e) => {
        if (!this.inputAudioEnabled) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = this.createBlob(inputData);
        this.sessionPromise?.then(session => {
            session.sendRealtimeInput({ media: pcmBlob });
        });
    };
    
    source.connect(this.inputAnalyser!);
    source.connect(processor);
    processor.connect(this.inputAudioContext.destination);
    
    this.processor = processor;
    this.source = source;
  }

  private createBlob(data: Float32Array): { data: string, mimeType: string } {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
  }

  public startInputAudio() {
    this.inputAudioEnabled = true;
  }

  public stopInputAudio() {
    this.inputAudioEnabled = false;
  }

  public getOutputVolume(): number {
    if (!this.outputAnalyser) return 0;
    const data = new Uint8Array(this.outputAnalyser.frequencyBinCount);
    this.outputAnalyser.getByteFrequencyData(data);
    return data.reduce((a, b) => a + b, 0) / data.length / 255;
  }

  public getInputVolume(): number {
    if (!this.inputAnalyser) return 0;
    const data = new Uint8Array(this.inputAnalyser.frequencyBinCount);
    this.inputAnalyser.getByteFrequencyData(data);
    return data.reduce((a, b) => a + b, 0) / data.length / 255;
  }

  public sendImage(base64: string) {
    this.sessionPromise?.then(session => {
        session.sendRealtimeInput({
            media: {
                mimeType: 'image/jpeg',
                data: base64
            }
        });
    });
  }

  private cleanup() {
    this.mediaStream?.getTracks().forEach(t => t.stop());
    if (this.processor) { 
        try { this.processor.disconnect(); } catch (e) {} 
    }
    if (this.source) { 
        try { this.source.disconnect(); } catch (e) {} 
    }
    this.sources.forEach(s => {
      try { s.stop(); } catch(e) {}
    });
    this.sources.clear();
    
    if (this.inputAudioContext && this.inputAudioContext.state !== 'closed') {
        this.inputAudioContext.close().catch(e => console.warn("Error closing input context", e));
    }
    if (this.outputAudioContext && this.outputAudioContext.state !== 'closed') {
        this.outputAudioContext.close().catch(e => console.warn("Error closing output context", e));
    }
  }

  public disconnect() {
    this.cleanup();
  }
}