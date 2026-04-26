"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChatStore, usePropertyStore, useUserStore } from "@/lib/store";
import { AgentPropertySidebar } from "@/components/agent/agent-property-sidebar";
import { ChatMessageBubble } from "@/components/chat/chat-message-bubble";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Send,
  Bot,
  Loader2,
  Volume2,
  Square,
  Mic,
  MicOff,
} from "lucide-react";

type VoiceState = "idle" | "recording" | "transcribing";

function useVoiceRecorder(onTranscript: (text: string) => void) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (voiceState !== "idle") {
      stopRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 1000) {
          setVoiceState("idle");
          return;
        }

        setVoiceState("transcribing");
        try {
          const form = new FormData();
          form.append("audio", blob, "recording.webm");
          const res = await fetch("/api/stt", { method: "POST", body: form });
          if (!res.ok) throw new Error("STT failed");
          const data = (await res.json()) as { text: string };
          if (data.text.trim()) {
            onTranscript(data.text.trim());
          }
        } catch {
          // silently fail — user can retry
        } finally {
          setVoiceState("idle");
        }
      };

      recorder.start(250);
      setVoiceState("recording");
    } catch {
      setVoiceState("idle");
    }
  }, [voiceState, stopRecording, onTranscript]);

  const toggleRecording = useCallback(() => {
    if (voiceState === "recording") {
      stopRecording();
    } else if (voiceState === "idle") {
      startRecording();
    }
  }, [voiceState, startRecording, stopRecording]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return { voiceState, toggleRecording };
}

export default function AgentPage() {
  const { messages, isLoading, addMessage, setLoading } = useChatStore();
  const { properties, savedProperties, activeSearchSessionId, propertyMap, selectedPropertyId } =
    usePropertyStore();
  const { profile } = useUserStore();

  const [agentPropertyId, setAgentPropertyId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);
  const [ttsPlayingId, setTtsPlayingId] = useState<string | null>(null);
  const [ttsCache, setTtsCache] = useState<Record<string, string>>({});
  const lastMsgCountRef = useRef(messages.length);

  const selectedProperty = agentPropertyId ? propertyMap[agentPropertyId] ?? null : null;

  useEffect(() => {
    if (selectedPropertyId && propertyMap[selectedPropertyId]) {
      setAgentPropertyId(selectedPropertyId);
      return;
    }

    if (!selectedPropertyId && !agentPropertyId && properties.length > 0) {
      setAgentPropertyId(properties[0].id);
    }
  }, [agentPropertyId, properties, propertyMap, selectedPropertyId]);

  const sendMessage = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || isLoading) return;
      setInput("");

      addMessage({ role: "user", content });
      setLoading(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, { role: "user", content }],
            context: {
              searchSessionId: activeSearchSessionId,
              selectedPropertyId: agentPropertyId,
              savedPropertyIds: savedProperties.map((s) => s.propertyId),
              userPreferences: profile?.preferences,
              userName: profile?.name,
            },
          }),
        });

        if (!res.ok) throw new Error("Failed to get response");
        const data = await res.json();
        addMessage({ role: "assistant", content: data.message });
      } catch {
        addMessage({
          role: "assistant",
          content:
            "I'm having trouble connecting right now. Please check that your GEMINI_API_KEY or OPENAI_API_KEY is configured in .env.local, then try again.",
        });
      } finally {
        setLoading(false);
      }
    },
    [input, isLoading, messages, activeSearchSessionId, agentPropertyId, savedProperties, profile, addMessage, setLoading]
  );

  const handleVoiceTranscript = useCallback(
    (text: string) => {
      if (!agentPropertyId && properties.length > 0) {
        setAgentPropertyId(properties[0].id);
      }
      setAutoSpeak(true);
      sendMessage(text);
    },
    [agentPropertyId, properties, sendMessage]
  );

  const { voiceState, toggleRecording } = useVoiceRecorder(handleVoiceTranscript);

  async function playTTS(messageId: string, text: string) {
    if (!text.trim()) return;

    if (ttsPlayingId === messageId && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setTtsPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setTtsLoadingId(messageId);
    try {
      const cachedUrl = ttsCache[messageId];
      let url = cachedUrl;
      if (!url) {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error("TTS failed");
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        setTtsCache((prev) => ({ ...prev, [messageId]: url }));
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      setTtsPlayingId(messageId);
      audio.onended = () => {
        setTtsPlayingId((cur) => (cur === messageId ? null : cur));
      };
      await audio.play();
    } catch {
      setTtsPlayingId(null);
    } finally {
      setTtsLoadingId((cur) => (cur === messageId ? null : cur));
    }
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
      for (const url of Object.values(ttsCache)) URL.revokeObjectURL(url);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoSpeak) return;
    if (messages.length <= lastMsgCountRef.current) {
      lastMsgCountRef.current = messages.length;
      return;
    }
    lastMsgCountRef.current = messages.length;

    const last = messages[messages.length - 1];
    if (last?.role === "assistant") {
      setAutoSpeak(false);
      playTTS(last.id, last.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, autoSpeak]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const micBusy = voiceState !== "idle";

  function ChatComposer({ placeholder }: { placeholder: string }) {
    return (
      <div className="max-w-2xl mx-auto flex gap-2 items-end w-full">
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="resize-none min-h-11 max-h-32 flex-1"
          rows={1}
        />

        <Button
          onClick={toggleRecording}
          disabled={voiceState === "transcribing" || isLoading}
          variant={voiceState === "recording" ? "destructive" : "outline"}
          size="icon"
          className={cn("shrink-0 relative", voiceState === "recording" && "animate-pulse")}
          title={voiceState === "recording" ? "Stop recording" : "Record voice message"}
        >
          {voiceState === "transcribing" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : voiceState === "recording" ? (
            <MicOff className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </Button>

        <Button
          onClick={() => sendMessage()}
          disabled={!input.trim() || isLoading}
          size="icon"
          className="shrink-0"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden">
      <AgentPropertySidebar
        onSelectProperty={setAgentPropertyId}
        selectedPropertyId={agentPropertyId}
      />

      <div className="flex-1 min-h-0 flex flex-col min-w-0">
        {/* Header bar */}
        <div className="h-12 border-b border-border flex items-center justify-between px-5 bg-card/30 shrink-0">
          <p className="text-sm text-muted-foreground">
            {selectedProperty
              ? `Chatting about ${selectedProperty.location.address}`
              : "Select a property from the sidebar to start"}
          </p>
        </div>

        {!selectedProperty ? (
          /* ---- Empty state with active mic ---- */
          <div className="flex-1 flex flex-col items-center gap-5 px-6 pt-16">
            <button
              onClick={toggleRecording}
              disabled={voiceState === "transcribing"}
              className={cn(
                "relative w-28 h-28 rounded-2xl flex items-center justify-center transition-all focus:outline-none",
                voiceState === "recording"
                  ? "bg-red-500/20 border-2 border-red-500/60"
                  : voiceState === "transcribing"
                    ? "bg-primary/10 border border-primary/20 opacity-70 cursor-not-allowed"
                    : "bg-primary/10 border border-primary/20 hover:bg-primary/20 hover:border-primary/40 cursor-pointer"
              )}
            >
              {voiceState === "recording" && (
                <span className="absolute inset-0 rounded-2xl border-2 border-red-500/40 animate-ping" />
              )}
              {voiceState === "transcribing" ? (
                <Loader2 className="w-10 h-10 text-primary/70 animate-spin" />
              ) : voiceState === "recording" ? (
                <MicOff className="w-10 h-10 text-red-400" />
              ) : (
                <Mic className="w-10 h-10 text-primary/70" />
              )}
            </button>

            <div className="text-center space-y-1.5 max-w-xs">
              {voiceState === "recording" ? (
                <p className="text-sm text-red-400 font-medium animate-pulse">
                  Listening... tap to stop
                </p>
              ) : voiceState === "transcribing" ? (
                <p className="text-sm text-muted-foreground">
                  Transcribing your message...
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Tap the mic to speak, or select a property
                    <br />
                    from the sidebar to start a conversation.
                  </p>
                  <p className="text-[10px] text-muted-foreground/50">
                    Voice powered by ElevenLabs + Groq Whisper
                  </p>
                </>
              )}
            </div>

            <div className="w-full max-w-2xl pt-2">
              <ChatComposer placeholder="Ask about a property or market..." />
            </div>
          </div>
        ) : (
          /* ---- Chat area ---- */
          <>
            <ScrollArea className="min-h-0 flex-1 p-5" ref={scrollRef as React.RefObject<HTMLDivElement>}>
              <div className="space-y-4 max-w-2xl mx-auto">
                {messages.length === 0 && (
                  <div className="text-center py-12 space-y-3">
                    <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                      <Bot className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="text-base font-semibold">
                      Ask about {selectedProperty.location.address}
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      Type a question or tap the mic to ask with your voice.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto pt-3">
                      {[
                        "What's the deal score breakdown?",
                        "How does this compare to nearby homes?",
                        "What are the neighborhood risks?",
                        "Is this a good investment?",
                      ].map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => sendMessage(prompt)}
                          className="text-left px-3 py-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 text-xs text-muted-foreground hover:text-foreground transition-all"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                    <div className="pt-5">
                      <ChatComposer
                        placeholder={`Ask about ${selectedProperty.location.neighborhood}...`}
                      />
                    </div>
                  </div>
                )}

                {messages.map((message) => (
                  <ChatMessageBubble
                    key={message.id}
                    message={message}
                    renderAssistantFooter={(assistantMessage) => (
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            playTTS(assistantMessage.id, assistantMessage.content)
                          }
                          disabled={ttsLoadingId === assistantMessage.id}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] transition-colors hover:bg-muted/60",
                            ttsLoadingId === assistantMessage.id &&
                              "cursor-not-allowed opacity-70"
                          )}
                        >
                          {ttsLoadingId === assistantMessage.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : ttsPlayingId === assistantMessage.id ? (
                            <Square className="h-3 w-3" />
                          ) : (
                            <Volume2 className="h-3 w-3" />
                          )}
                          <span>
                            {ttsPlayingId === assistantMessage.id ? "Stop" : "Speak"}
                          </span>
                        </button>
                      </div>
                    )}
                  />
                ))}

                {isLoading && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="bg-card border border-border rounded-xl px-4 py-3">
                      <div className="flex gap-1.5 items-center">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Analyzing...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {messages.length > 0 && (
              <div className="border-t border-border bg-background/95 backdrop-blur p-4 shrink-0">
                <ChatComposer placeholder={`Ask about ${selectedProperty.location.neighborhood}...`} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
