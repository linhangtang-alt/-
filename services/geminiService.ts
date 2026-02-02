import { GoogleGenAI, LiveServerMessage, Modality, Type, Schema, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import { ChatMessage, AgentStage, AnswerCardData, ContextData, ContextTier, ContextualBundle, SelectionBox, LiveAnswerCardSummary } from "../types";

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
    confidence: { type: Type.NUMBER, description: "A confidence score from 0.0 to 1.0 indicating how certain the model is about its answer given the provided context. Default to 0.7 if not specified by model." }, // Added for Stage 7
    suggested_followups: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2-3 relevant follow-up questions the user might ask next."
    },
    // Stage 5: Context Policy feedback
    needs_more_context: { type: Type.BOOLEAN, description: "Set to true if the model needs more contextual information (e.g., longer clip, more script) to provide a better answer." },
    suggested_context_tier: { type: Type.STRING, enum: Object.values(ContextTier), description: "If needs_more_context is true, suggest the next context tier (M or L) that would be helpful." },
    suggested_rewind_time: { type: Type.NUMBER, description: "An optional timestamp (in seconds) in the video that the user might want to revisit for more context on the answer." } // Added for Stage 7
  },
  required: ["title", "answer"]
};

// --- Stage 8: Live Answer Summary Function Declaration ---
const liveAnswerCardSummarySchema: Schema = {
  type: Type.OBJECT,
  description: 'Summarize the spoken response by extracting key points and a suggested rewind time.',
  properties: {
    title: { type: Type.STRING, description: 'A brief title for the response summary.' },
    key_points: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2-3 very concise key takeaways or points from the explanation.'
    },
    suggested_rewind_time: {
      type: Type.NUMBER,
      description: 'An optional timestamp (in seconds) in the video that the user might want to revisit for more context on the answer just given. Only if directly relevant to the current answer.'
    }
  },
  required: ['title', 'key_points'],
};

const liveAnswerCardSummaryFunctionDeclaration: FunctionDeclaration = {
  name: 'summarizeLiveResponse',
  parameters: liveAnswerCardSummarySchema,
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

// Helper function to execute a single Q&A API call
const executeQnA = async (
  prompt: string,
  history: ChatMessage[], // Full chat history for conversational context
  image?: string,
  selection?: SelectionBox,
  timestamp?: number,
  contextualBundle?: ContextualBundle // Specific bundle for this call
): Promise<AnswerCardData> => {
  if (!API_KEY) {
    return {
      title: "API Key Missing",
      answer: "Please configure your API Key to use the InsightStream Q&A agents.",
      suggested_followups: ["How do I get an API key?"],
      needs_more_context: false,
      confidence: 0, // Default for missing key
    };
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  // Prepare conversational history for Gemini's generateContent
  const contents: any[] = [];

  // Add previous chat history (user and model turns)
  history.forEach(msg => {
    // Only include text content from previous turns for conversational flow
    if (typeof msg.content === 'string') {
        contents.push({
            role: msg.role,
            parts: [{ text: msg.content }]
        });
    } else if (typeof msg.content === 'object' && 'answer' in msg.content && msg.content.answer) { // If it's an AnswerCardData, use its 'answer' field
        contents.push({
            role: msg.role,
            parts: [{ text: msg.content.answer }]
        });
    }
  });

  // Construct the current turn's content, including multimodal context
  const currentTurnParts: any[] = [];

  if (image) {
    currentTurnParts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: image
      }
    });
  }

  let currentPromptText = `User Question: "${prompt}"`;
  
  if (timestamp !== undefined) {
    currentPromptText = `
    [Context - Timestamp: ${timestamp.toFixed(2)}s]
    ${selection ? `[Context - Selection ROI: ${JSON.stringify(selection)}]` : ''}
    ${contextualBundle?.clipRange ? `[Context - Clip Range (Tier ${contextualBundle.tier}): ${contextualBundle.clipRange.start.toFixed(2)}s to ${contextualBundle.clipRange.end.toFixed(2)}s]` : ''}
    ${contextualBundle?.scriptWindow ? `[Context - Relevant Script (Tier ${contextualBundle.tier}):\n${contextualBundle.scriptWindow}]` : ''}
    
    ${currentPromptText}
    `;
  }
  currentTurnParts.push({ text: currentPromptText });
  contents.push({ role: 'user', parts: currentTurnParts });

  try {
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents, // Use the constructed contents array
      config: {
        systemInstruction: `You are the Q&A Orchestrator Agent (Module 6) for InsightStream.
        
        Role: Explain educational concepts in videos (3blue1brown style) based on user selection, current video context (timestamp, clip range), and relevant script. You are participating in a multi-turn conversation. All your responses MUST be in English.

        Rules:
        1. Analyze the image and the red/blue selection box (if present) for the current turn.
        2. Identify the mathematical symbol, graph, or object selected.
        3. Explain it clearly in English, referencing the provided script context if relevant.
        4. Use LaTeX for math.
        5. Populate the JSON response strictly.
        6. Provide a 'confidence' score (0.0 to 1.0) for your answer. Higher for clear, direct answers from context.
        7. If you can suggest a specific timestamp (in seconds) that the user might want to revisit for more context on the answer, include it as 'suggested_rewind_time'.
        8. If you feel you need more surrounding video/script context to give a comprehensive answer, set 'needs_more_context' to true and suggest a higher tier (M or L).`,
        responseMimeType: "application/json",
        responseSchema: answerCardSchema
      }
    }));

    const jsonText = response.text || "{}";
    try {
      const parsedResponse = JSON.parse(jsonText) as AnswerCardData;
      // Provide a default confidence if the model doesn't supply one, to avoid UI issues
      if (parsedResponse.confidence === undefined || parsedResponse.confidence === null) {
          parsedResponse.confidence = 0.7; 
      }
      return parsedResponse;
    } catch (parseError) {
      console.error("JSON Parse Error", parseError);
      return {
        title: "Parsing Error",
        answer: response.text || "Raw output received.",
        is_voice_stream: false,
        needs_more_context: false,
        confidence: 0,
      };
    }

  } catch (error: any) {
    console.error("Gemini Q&A Error:", error);
    const errorMsg = error.message || "Unknown error";
    
    if (errorMsg.includes("xhr error") && errorMsg.includes("code: 6")) {
        return {
            title: "Connection Blocked",
            answer: "Cannot connect to Google AI services. This often indicates an AdBlocker, privacy extension, or firewall is blocking the connection. Please disable them for this site and try again.",
            needs_more_context: false,
            confidence: 0,
        };
    }

    return {
      title: "Connection Error",
      answer: `Failed to reach the reasoning engine. (${errorMsg})`,
      needs_more_context: false,
      confidence: 0,
    };
  }
};

// Stage 5: Context Policy Orchestrator
export const orchestrateQnA = async (
  prompt: string,
  history: ChatMessage[],
  commonContext: { image?: string; selection?: SelectionBox; timestamp: number },
  allContextBundles: Record<ContextTier, ContextualBundle>,
  currentTier: ContextTier = ContextTier.S,
  retryCount = 0
): Promise<{ answer: AnswerCardData; finalTier: ContextTier }> => {
  console.log(`[Context Policy] Attempting Q&A with Tier ${currentTier} (Retry ${retryCount})`);

  const bundle = allContextBundles[currentTier];
  if (!bundle) {
    console.error(`[Context Policy] No bundle found for tier ${currentTier}`);
    return {
      answer: { title: "Context Error", answer: `No context bundle for tier ${currentTier}`, confidence: 0 },
      finalTier: currentTier
    };
  }

  const answer = await executeQnA(
    prompt,
    history,
    commonContext.image,
    commonContext.selection,
    commonContext.timestamp,
    bundle
  );

  if (answer.needs_more_context && currentTier !== ContextTier.L && retryCount < 2) { // Max 2 retries (S -> M -> L)
    const nextTier: ContextTier = 
      answer.suggested_context_tier && Object.values(ContextTier).indexOf(answer.suggested_context_tier) > Object.values(ContextTier).indexOf(currentTier)
      ? answer.suggested_context_tier
      : (currentTier === ContextTier.S ? ContextTier.M : ContextTier.L);

    console.warn(`[Context Policy] Model requested more context. Upgrading from Tier ${currentTier} to ${nextTier}...`);
    return orchestrateQnA(prompt, history, commonContext, allContextBundles, nextTier, retryCount + 1);
  }

  return { answer, finalTier: currentTier };
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

// Define the signature for the LiveSession's message callback
interface LiveMessageCallback {
  (params: {
    text?: string; // Streaming text chunks
    structuredData?: AnswerCardData; // Final structured summary
    isUser: boolean;
    messageId: string; // ID of the message being updated/created
    isTurnComplete?: boolean; // Indicates if this chunk completes a user/model turn
  }): void;
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
  private onMessageCallback: LiveMessageCallback; // Use new interface
  private onCloseCallback: () => void;
  private currentModelMessageId: string | null = null; // Track current model's voice message ID for updates
  private currentInputMessageId: string | null = null; // Changed: Dynamic ID for user's live input, resets on turn complete
  private currentInputTranscription: string = ''; // Accumulate user's input transcript
  private currentOutputTranscription: string = ''; // Accumulate model's output transcript
  private inputAudioEnabled: boolean = false; // New state to control audio sending

  constructor(
      onMessage: LiveMessageCallback, // Use new interface
      onClose?: () => void
  ) {
    this.onMessageCallback = onMessage;
    this.onCloseCallback = onClose || (() => {});
    this.ai = new GoogleGenAI({ apiKey: API_KEY || '' });
  }

  // Helper to safely get or create the input message ID
  public getCurrentInputMessageId(): string {
    if (!this.currentInputMessageId) {
        this.currentInputMessageId = Date.now().toString();
    }
    return this.currentInputMessageId;
  }

  async connect(systemInstruction: string = "You are a helpful AI tutor.") {
    if (!API_KEY) throw new Error("No API Key");

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    
    // 1. Output Context: 24kHz
    this.outputAudioContext = new AudioContextClass({ sampleRate: 24000 });
    this.outputAnalyser = this.outputAudioContext.createAnalyser();
    this.outputAnalyser.fftSize = 256;
    this.outputAnalyser.smoothingTimeConstant = 0.5;
    this.outputAnalyser.connect(this.outputAudioContext.destination);

    // 2. Input Context: 16kHz
    this.inputAudioContext = new AudioContextClass({ sampleRate: 16000 });
    this.inputAnalyser = this.inputAudioContext.createAnalyser();
    this.inputAnalyser.fftSize = 256;
    this.inputAnalyser.smoothingTimeConstant = 0.5;
    // Do NOT connect inputAnalyser to destination (that would cause self-echo)

    if (this.outputAudioContext.state === 'suspended') await this.outputAudioContext.resume();
    if (this.inputAudioContext.state === 'suspended') await this.inputAudioContext.resume();

    // 3. Get User Media
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
            channelCount: 1,
            sampleRate: 16000, 
            echoCancellation: true,
            noiseSuppression: true,
        } 
    });

    // 4. Connect to Gemini Live
    this.sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          console.log("Live Session Opened");
          this.startAudioStream();
          this.inputAudioEnabled = false; // Initialize to not send audio until PTT
        },
        onmessage: (message: LiveServerMessage) => this.handleMessage(message),
        onclose: () => {
             console.log("Live Session Closed");
             this.cleanup();
             this.onCloseCallback();
        },
        onerror: (e) => {
             console.error("Live Session Error", e);
             // Provide specific error message for connection issues
             const errorMsg = e.error?.message || "Unknown error";
             if (errorMsg.includes("xhr error") || errorMsg.includes("Rpc failed") || errorMsg.includes("code: 6")) {
                alert("Failed to connect to Gemini Live. This often indicates an AdBlocker, privacy extension, or firewall is blocking the connection. Please disable them for this site and try again.");
             } else {
                alert(`Failed to connect to Gemini Live: ${errorMsg}. Please try again.`);
             }
             this.cleanup();
             this.onCloseCallback();
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        // Change: Pass as direct string, SDK handles content wrapping
        systemInstruction: systemInstruction,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [{ functionDeclarations: [liveAnswerCardSummaryFunctionDeclaration] }] // Integrate function calling
      },
    });

    await this.sessionPromise;
  }

  public sendImage(base64Data: string) {
    if (!this.sessionPromise) return;
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

  public startInputAudio() {
    this.inputAudioEnabled = true;
  }

  public stopInputAudio() {
    this.inputAudioEnabled = false;
  }

  // Poll for output volume (AI speaking)
  public getOutputVolume(): number {
    return this.getVolumeFromAnalyser(this.outputAnalyser);
  }

  // Poll for input volume (User speaking)
  public getInputVolume(): number {
    // Only return input volume if audio is actively being sent
    return this.inputAudioEnabled ? this.getVolumeFromAnalyser(this.inputAnalyser) : 0;
  }

  private getVolumeFromAnalyser(analyser: AnalyserNode | null): number {
    if (!analyser) return 0;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    return average / 255;
  }

  private startAudioStream() {
    if (!this.inputAudioContext || !this.mediaStream || !this.sessionPromise) return;
    
    this.source = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
    
    // Connect Source -> Analyser (for visualization)
    if (this.inputAnalyser) {
        this.source.connect(this.inputAnalyser);
    }

    // Connect Source -> Processor (for sending to Gemini)
    // Buffer size 4096 gives ~256ms latency at 16kHz
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
        if (!this.sessionPromise || !this.inputAudioEnabled) return; // Only send if enabled
        
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBase64 = this.createPcmData(inputData);

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

  private createPcmData(data: Float32Array): string {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        const s = Math.max(-1, Math.min(1, data[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return arrayBufferToBase64(int16.buffer);
  }

  private async handleMessage(message: LiveServerMessage) {
    if (message.serverContent?.inputTranscription?.text) {
        const text = message.serverContent.inputTranscription.text;
        this.currentInputTranscription += text;
        // Check if we have an active input message ID, if not create one
        if (!this.currentInputMessageId) {
            this.currentInputMessageId = Date.now().toString();
        }
        // Update both the preview (via text) and the chat history (using the consistent messageId)
        this.onMessageCallback({ text, isUser: true, messageId: this.currentInputMessageId }); 
    }
    
    if (message.serverContent?.outputTranscription?.text) {
        const text = message.serverContent.outputTranscription.text;
        this.currentOutputTranscription += text;
        if (!this.currentModelMessageId) {
            this.currentModelMessageId = Date.now().toString(); // Assign a new ID if not already tracking
        }
        this.onMessageCallback({ text, isUser: false, messageId: this.currentModelMessageId });
    }

    // Handle Function Calls from Live API (for structured summaries)
    if (message.toolCall && this.currentModelMessageId) {
        for (const fc of message.toolCall.functionCalls) {
            if (fc.name === 'summarizeLiveResponse') {
                const summary: LiveAnswerCardSummary = fc.args as LiveAnswerCardSummary;
                
                // Construct AnswerCardData from the summary
                const structuredData: AnswerCardData = {
                    title: summary.title,
                    answer: summary.key_points.join('\n- '), // Convert key points to markdown list
                    key_terms: summary.key_points.map(kp => ({ term: kp, definition: kp })), // Duplicate for key_terms list
                    confidence: 0.8, // Default confidence for live summary
                    is_voice_stream: true,
                    suggested_rewind_time: summary.suggested_rewind_time,
                    // No needs_more_context or suggested_context_tier for live summary
                };

                // Send structured data to the UI, replacing the current model message
                this.onMessageCallback({ 
                    structuredData, 
                    isUser: false, 
                    messageId: this.currentModelMessageId,
                    isTurnComplete: true // Indicate turn complete when structured data arrives
                });
                this.currentModelMessageId = null; // Reset for next turn
                this.currentOutputTranscription = ''; // Clear accumulated transcription
            }
        }
    }
    
    // Process model's audio output
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext && this.outputAnalyser) {
        try {
            const audioDataBuffer = base64ToArrayBuffer(base64Audio);
            const audioBuffer = this.pcmToAudioBuffer(audioDataBuffer, this.outputAudioContext);
            const currentTime = this.outputAudioContext.currentTime;
            
            if (this.nextStartTime < currentTime) {
                this.nextStartTime = currentTime;
            }

            const source = this.outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.outputAnalyser);
            source.start(this.nextStartTime);
            this.nextStartTime += audioBuffer.duration;
            
            this.sources.add(source);
            source.onended = () => this.sources.delete(source);
        } catch (e) {
            console.error("Audio Decode Error", e);
        }
    }
    
    if (message.serverContent?.interrupted) {
        // If an interruption occurs (e.g., user speaks over model), stop current playback
        this.sources.forEach(s => {
            try { s.stop(); } catch(e) {}
        });
        this.sources.clear();
        this.nextStartTime = 0;
        // Also clear any ongoing model transcription
        this.currentOutputTranscription = '';
        this.currentModelMessageId = null;
    }

    // Turn complete for transcription - if no tool call, finalize as plain text
    if (message.serverContent?.turnComplete) {
      if (this.currentInputTranscription) {
        // Finalize user input (it might not have a dedicated 'turnComplete' on its own)
        if (this.currentInputMessageId) {
            this.onMessageCallback({
              text: this.currentInputTranscription,
              isUser: true,
              messageId: this.currentInputMessageId, 
              isTurnComplete: true,
            });
        }
        this.currentInputTranscription = '';
        this.currentInputMessageId = null; // RESET ID to force new bubble next time
      }

      // If a model turn completed and no structured summary was sent via toolCall,
      // finalize the accumulated transcription as a plain text message.
      if (this.currentOutputTranscription && this.currentModelMessageId) {
        this.onMessageCallback({
          text: this.currentOutputTranscription,
          isUser: false,
          messageId: this.currentModelMessageId,
          isTurnComplete: true,
        });
        this.currentModelMessageId = null;
        this.currentOutputTranscription = '';
      }
    }
  }

  private pcmToAudioBuffer(buffer: ArrayBuffer, ctx: AudioContext): AudioBuffer {
    const dataInt16 = new Int16Array(buffer);
    const float32 = new Float32Array(dataInt16.length);
    
    for (let i = 0; i < dataInt16.length; i++) {
        float32[i] = dataInt16[i] / 32768.0;
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000); 
    audioBuffer.getChannelData(0).set(float32);
    return audioBuffer;
  }

  disconnect() {
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
    this.outputAnalyser = null;
    this.inputAnalyser = null;
    this.currentModelMessageId = null;
    this.currentInputMessageId = null;
    this.currentInputTranscription = '';
    this.currentOutputTranscription = '';
    this.inputAudioEnabled = false; // Reset PTT state
  }
}