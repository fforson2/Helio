"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { Sparkles } from "lucide-react";

const HELIO_ENTRY_EVENT = "helio:play-entry-animation";
const ANIMATION_DURATION_MS = 850;

export function triggerHelioEntryAnimation() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HELIO_ENTRY_EVENT));
}

export function HelioEntryAnimation() {
  const [visible, setVisible] = useState(false);
  const [sequence, setSequence] = useState(0);
  const timeoutRef = useRef<number | null>(null);

  const play = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    setSequence((current) => current + 1);
    setVisible(true);
    timeoutRef.current = window.setTimeout(() => {
      setVisible(false);
      timeoutRef.current = null;
    }, ANIMATION_DURATION_MS);
  }, []);

  useEffect(() => {
    play();

    function handlePlay() {
      play();
    }

    window.addEventListener(HELIO_ENTRY_EVENT, handlePlay);
    return () => {
      window.removeEventListener(HELIO_ENTRY_EVENT, handlePlay);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [play]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key={sequence}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[200] overflow-hidden bg-[#08090d]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2, ease: "easeInOut" } }}
        >
          <motion.div
            className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.2),_transparent_34%),radial-gradient(circle_at_bottom,_rgba(139,92,246,0.24),_transparent_36%)]"
            initial={{ opacity: 0.45, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1.06 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />

          <motion.div
            className="absolute inset-x-[-10%] top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-amber-300/70 to-transparent"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1.1, opacity: [0, 1, 0.35] }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          />

          <motion.div
            className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-violet-300/65 to-transparent"
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1.1, opacity: [0, 0.9, 0.25] }}
            transition={{ duration: 0.45, delay: 0.08, ease: "easeOut" }}
          />

          <div className="absolute inset-0 opacity-30">
            {Array.from({ length: 6 }).map((_, index) => (
              <motion.div
                key={index}
                className="absolute left-0 h-px w-full bg-gradient-to-r from-transparent via-white/30 to-transparent"
                style={{ top: `${18 + index * 12}%` }}
                initial={{ x: "-16%", opacity: 0 }}
                animate={{ x: "12%", opacity: [0, 0.5, 0] }}
                transition={{
                  duration: 0.55,
                  delay: index * 0.04,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              className="relative flex h-36 w-36 items-center justify-center rounded-[2rem] border border-white/12 bg-white/6 shadow-[0_0_120px_rgba(251,191,36,0.16)] backdrop-blur-xl"
              initial={{ scale: 0.72, rotate: -14, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                className="absolute inset-3 rounded-[1.5rem] border border-amber-300/20"
                initial={{ opacity: 0, scale: 0.86 }}
                animate={{ opacity: [0, 1, 0.45], scale: 1.08 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
              />
              <motion.div
                className="absolute -top-5 -right-5 rounded-full border border-white/12 bg-amber-300/12 p-2 text-amber-200"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, y: [0, -5, 0] }}
                transition={{ duration: 0.45, delay: 0.18 }}
              >
                <Sparkles className="h-4 w-4" />
              </motion.div>
              <motion.div
                className="absolute -bottom-4 -left-4 h-10 w-10 rounded-full bg-violet-400/18 blur-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.1, 0.55, 0.2], scale: [0.8, 1.15, 1] }}
                transition={{ duration: 0.65 }}
              />
              <div className="relative flex flex-col items-center gap-2">
                <motion.div
                  className="relative h-16 w-16 overflow-hidden rounded-2xl shadow-[0_10px_35px_rgba(93,210,255,0.28)] ring-1 ring-cyan-300/25"
                  initial={{ y: 16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.35, delay: 0.08, ease: "easeOut" }}
                >
                  <Image
                    src="/helio-mark-clean.png"
                    alt="Helio logo"
                    fill
                    sizes="64px"
                    className="object-cover"
                    priority
                  />
                </motion.div>
                <motion.div
                  className="text-center"
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.32, delay: 0.14, ease: "easeOut" }}
                >
                  <div className="text-sm font-semibold tracking-[0.45em] text-white/92">
                    HELIO
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.28em] text-white/45">
                    Real Estate OS
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
