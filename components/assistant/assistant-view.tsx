"use client";

import { useState, useRef, useEffect } from "react";
import { useChatStore, usePropertyStore, useUserStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Send, Sparkles, Bot, User, MapPin, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/format";

const QUICK_PROMPTS = [
  "Which property has the best deal score?",
  "Compare the top 2 properties for a family with kids",
  "What are the risks I should know about?",
  "Which neighborhood is best for commuting?",
  "What's the best value for under $1.5M?",
];

export function AssistantView() {
  const { messages, isLoading, addMessage, setLoading } = useChatStore();
  const { properties, savedProperties } = usePropertyStore();
  const { profile } = useUserStore();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || isLoading) return;
    setInput("");

    addMessage({ role: "user", content });

    setLoading(true);
    try {
      const savedProps = savedProperties
        .map((s) => properties.find((p) => p.id === s.propertyId))
        .filter(Boolean);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content }],
          context: {
            properties: properties.slice(0, 8),
            savedProperties: savedProps,
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
          "I'm having trouble connecting right now. Please check that your OPENAI_API_KEY or GROQ_API_KEY is configured in .env.local, then try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Helio AI</h2>
          <p className="text-xs text-muted-foreground">
            Ask anything about properties, neighborhoods, or deals
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-muted-foreground">Ready</span>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef as React.RefObject<HTMLDivElement>}>
        <div className="space-y-4 max-w-3xl mx-auto">
          {messages.length === 0 && (
            <div className="space-y-6">
              {/* Welcome */}
              <div className="text-center py-8 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold">
                  Hi{profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}! I'm Helio AI
                </h3>
                <p className="text-muted-foreground max-w-sm mx-auto text-sm">
                  I know every property in your search, your preferences, and the U.S. market. Ask me anything.
                </p>
              </div>

              {/* Property context pills */}
              {properties.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground text-center">
                    I'm tracking {properties.length} properties
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {properties.slice(0, 4).map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary border border-border text-xs"
                      >
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{p.location.neighborhood}</span>
                        <span className="font-medium">{formatPrice(p.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick prompts */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center">Try asking:</p>
                <div className="grid grid-cols-1 gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="text-left px-4 py-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 text-sm transition-all group"
                    >
                      <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                        {prompt}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border"
                )}
              >
                {message.role === "user" ? (
                  <User className="w-3.5 h-3.5" />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-primary" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border"
                )}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                <div
                  className={cn(
                    "text-[10px] mt-1.5",
                    message.role === "user"
                      ? "text-primary-foreground/60"
                      : "text-muted-foreground"
                  )}
                >
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
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

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about any property, neighborhood, or deal..."
            className="resize-none min-h-11 max-h-32 flex-1"
            rows={1}
          />
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
        <p className="text-center text-[10px] text-muted-foreground mt-2">
          Powered by AI · Add OPENAI_API_KEY or GROQ_API_KEY to .env.local
        </p>
      </div>
    </div>
  );
}
