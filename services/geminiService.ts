import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { ChatMessage } from "../types";

// Check for API Key
const API_KEY = process.env.API_KEY;

export const isApiKeyAvailable = (): boolean => {
  return !!API_KEY;
};

// --- Text/Vision Chat Service ---

export const generateTextResponse = async (
  prompt: string,
  history: ChatMessage[],
  context?: { selection: any, timestamp: number, image?: string }
): Promise<string> => {
  if (!API_KEY) return "Simulation Mode: API Key missing. Please provide a key to use real Gemini models.";

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  // Construct content parts
  const parts: any[] = [];

  // 1. Add Image if available (Multimodal)
  if (context?.image) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: context.image // Base64 string
      }
    });
  }

  // 2. Add Text Prompt with Context Metadata
  let textPrompt = `[User Question]: ${prompt}`;
  
  if (context) {
    textPrompt = `
    [Context Info]
    Video Timestamp: ${context.timestamp}s
    User Selection Coordinates: ${JSON.stringify(context.selection || "None")}
    
    ${textPrompt}
    `;
  }
  
  parts.push({ text: textPrompt });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: parts }, 
      config: {
        systemInstruction: `You are InsightStream AI, an expert educational assistant inspired by 3blue1brown.
        
        Guidelines:
        1. **DIRECT ANSWER ONLY.** Do NOT use greetings, pleasantries, or intro phrases.
        2. Start directly with the mathematical derivation, concept explanation, or data analysis.
        3. **FORMATTING IS CRITICAL:**
           - Use **LaTeX** for ALL mathematical formulas.
           - Enclose inline formulas with single dollar signs: $ E = mc^2 $
           - Enclose block formulas with double dollar signs: $$ \\int_{a}^{b} x^2 dx $$
           - Use **Bold** for key terms.
           - Use bullet points for steps.
        4. If the user provides an image with a red box, explain ONLY what is inside that red box.
        5. Be concise, encouraging, and mathematically precise.`
      }
    });
    return response.text || "I couldn't generate a response.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error communicating with Gemini API.";
  }
};

// --- Live API Service (Voice) ---

export class LiveSession {
  private ai: GoogleGenAI;
  private session: any; // Type is technically Promise<LiveSession> or LiveSession depending on state
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private onMessageCallback: (text: string, isUser: boolean) => void;

  constructor(onMessage: (text: string, isUser: boolean) => void) {
    this.onMessageCallback = onMessage;
    this.ai = new GoogleGenAI({ apiKey: API_KEY || '' });
  }

  async connect() {
    if (!API_KEY) throw new Error("No API Key");

    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          console.log("Live Session Opened");
          this.startAudioStream(stream, sessionPromise);
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
        systemInstruction: 'You are InsightStream AI. You are a video tutor. You can see the video stream and red selection boxes the user draws. When a user selects an area, they expect you to explain what is inside that area immediately or answer their spoken question about it.',
        inputAudioTranscription: {}, // Enable transcription to show in UI
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

  private startAudioStream(stream: MediaStream, sessionPromise: Promise<any>) {
    if (!this.inputAudioContext) return;
    
    const source = this.inputAudioContext.createMediaStreamSource(stream);
    // Use ScriptProcessor for demo purposes (AudioWorklet is better for prod but more complex to setup in single file)
    const scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    
    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
        const pcmBlob = this.createBlob(inputData);
        sessionPromise.then((session) => {
            session.sendRealtimeInput({ media: pcmBlob });
        });
    };

    source.connect(scriptProcessor);
    scriptProcessor.connect(this.inputAudioContext.destination);
  }

  private createBlob(data: Float32Array) {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    const uint8 = new Uint8Array(int16.buffer);
    
    // Manual base64 encode
    let binary = '';
    const len = uint8.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8[i]);
    }
    const base64 = btoa(binary);

    return {
        data: base64,
        mimeType: 'audio/pcm;rate=16000',
    };
  }

  private async handleMessage(message: LiveServerMessage) {
    // Handle Transcriptions
    if (message.serverContent?.inputTranscription?.text) {
        this.onMessageCallback(message.serverContent.inputTranscription.text, true);
    }
    if (message.serverContent?.outputTranscription?.text) {
        this.onMessageCallback(message.serverContent.outputTranscription.text, false);
    }

    // Handle Audio
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext) {
        this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
        
        // Decode
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Convert to AudioBuffer
        const dataInt16 = new Int16Array(bytes.buffer);
        const buffer = this.outputAudioContext.createBuffer(1, dataInt16.length, 24000);
        const channelData = buffer.getChannelData(0);
        for(let i=0; i<channelData.length; i++) {
            channelData[i] = dataInt16[i] / 32768.0;
        }

        const source = this.outputAudioContext.createBufferSource();
        source.buffer = buffer;
        const gainNode = this.outputAudioContext.createGain();
        source.connect(gainNode);
        gainNode.connect(this.outputAudioContext.destination);
        
        source.start(this.nextStartTime);
        this.nextStartTime += buffer.duration;
        this.sources.add(source);
        
        source.onended = () => this.sources.delete(source);
    }
    
    if (message.serverContent?.interrupted) {
        this.sources.forEach(s => s.stop());
        this.sources.clear();
        this.nextStartTime = 0;
    }
  }

  disconnect() {
    // There is no explicit disconnect on the session object in the preview SDK, 
    // usually handled by closing audio contexts or navigation.
    if (this.inputAudioContext) this.inputAudioContext.close();
    if (this.outputAudioContext) this.outputAudioContext.close();
  }
}