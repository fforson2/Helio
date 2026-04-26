"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Box, Loader2, Orbit, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SketchfabTourViewProps {
  uid: string;
  addressLine: string;
  description: string;
  archetype?: string;
  reason?: string;
  narrationAudioUrl?: string;
  narrationLoading?: boolean;
  narrationError?: string | null;
  className?: string;
}

function formatArchetypeLabel(archetype?: string) {
  if (!archetype) return "Home model";
  return archetype
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function SketchfabTourView({
  uid,
  addressLine,
  description,
  archetype,
  reason,
  narrationAudioUrl,
  narrationLoading = false,
  narrationError = null,
  className,
}: SketchfabTourViewProps) {
  const [narrationEnabled, setNarrationEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const embedUrl = useMemo(() => {
    const params = new URLSearchParams({
      autostart: "1",
      ui_theme: "dark",
      ui_controls: "1",
      ui_infos: "0",
      ui_watermark_link: "0",
      ui_hint: "1",
      camera: "0",
      scrollwheel: "1",
      preload: "1",
    });
    return `https://sketchfab.com/models/${uid}/embed?${params.toString()}`;
  }, [uid]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (!narrationAudioUrl) return;

    const audio = new Audio(narrationAudioUrl);
    audio.preload = "auto";
    audioRef.current = audio;

    if (narrationEnabled) {
      audio.play().catch(() => {});
    }

    return () => {
      audio.pause();
      audio.currentTime = 0;
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
    };
  }, [narrationAudioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (narrationEnabled) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [narrationEnabled]);

  function restartNarration() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    if (narrationEnabled) {
      audio.play().catch(() => {});
    }
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="relative flex-1 min-h-0 max-h-[min(54vh,28rem)] overflow-hidden rounded-xl border border-border/40 bg-[#111]">
        <iframe
          title={`Sketchfab tour for ${addressLine}`}
          src={embedUrl}
          allow="autoplay; fullscreen; xr-spatial-tracking"
          allowFullScreen
          className="h-full w-full border-0"
        />

        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded bg-sky-600/90 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          <Orbit className="w-3 h-3" />
          Sketchfab
        </div>
        <div className="absolute top-2 left-2 z-10 rounded bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white/85 backdrop-blur-sm">
          {formatArchetypeLabel(archetype)}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => window.open(`https://sketchfab.com/models/${uid}`, "_blank", "noopener,noreferrer")}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Open model
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={restartNarration}
          disabled={!narrationAudioUrl}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Replay voiceover
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setNarrationEnabled((current) => !current)}
          disabled={!narrationAudioUrl}
        >
          {narrationEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          {narrationEnabled ? "Mute narration" : "Play narration"}
        </Button>
        <div className="ml-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Box className="w-3.5 h-3.5" />
          <span>Interactive prefab home viewer</span>
          <span className="opacity-40">·</span>
          <span>{formatArchetypeLabel(archetype)}</span>
          <span className="opacity-40">·</span>
          <span>Orbit, zoom, and inspect</span>
        </div>
        {description && (
          <p className="ml-auto max-w-[38%] truncate text-[11px] italic text-muted-foreground/40">
            {description}
          </p>
        )}
      </div>

      {narrationLoading ? (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/50 bg-card/40 px-3 py-2 text-[11px] text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <p>Generating ElevenLabs voiceover for this tour...</p>
        </div>
      ) : null}

      {narrationError ? (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-100">
          <AlertCircle className="mt-0.5 w-3.5 h-3.5 shrink-0" />
          <p>{narrationError}</p>
        </div>
      ) : null}

      {reason ? (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-border/50 bg-card/40 px-3 py-2 text-[11px] text-muted-foreground">
          <AlertCircle className="mt-0.5 w-3.5 h-3.5 shrink-0" />
          <p>{reason}</p>
        </div>
      ) : null}
    </div>
  );
}
