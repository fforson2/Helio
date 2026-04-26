"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User } from "lucide-react";
import { ChatMessage } from "@/types/session";
import { cn } from "@/lib/utils";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  onDownloadImage?: (url: string, caption: string) => void;
  downloadImageLabel?: string;
  renderAssistantFooter?: (message: ChatMessage) => React.ReactNode;
}

export function ChatMessageBubble({
  message,
  onDownloadImage,
  downloadImageLabel = "Download attachment",
  renderAssistantFooter,
}: ChatMessageBubbleProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  return (
    <div
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-card"
        )}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-3.5 w-3.5 text-primary" />
        )}
      </div>

      <div
        className={cn(
          "max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-card"
        )}
      >
        {message.imageUrl && onDownloadImage ? (
          <div className="mb-2 -mx-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.imageUrl}
              alt={message.imageCaption ?? "Attached image"}
              className="max-w-full rounded-lg border border-border"
            />
            <button
              onClick={() =>
                onDownloadImage(
                  message.imageUrl!,
                  message.imageCaption ?? "helio-attachment"
                )
              }
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium transition-colors hover:bg-secondary"
            >
              {downloadImageLabel}
            </button>
          </div>
        ) : null}

        {isAssistant ? (
          <div className="prose prose-sm prose-invert max-w-none break-words prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-pre:my-2 prose-pre:overflow-x-auto prose-code:before:content-none prose-code:after:content-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="whitespace-pre-wrap">{message.content}</div>
        )}

        {isAssistant && renderAssistantFooter ? renderAssistantFooter(message) : null}

        <div
          className={cn(
            "mt-1.5 text-[10px]",
            isUser ? "text-primary-foreground/60" : "text-muted-foreground"
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}
