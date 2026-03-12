"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { DEFAULT_LIMITS } from "@/lib/limits";

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  onCancel: () => void;
  maxDuration?: number;
}

export function VoiceRecorder({
  onRecordingComplete,
  onCancel,
  maxDuration = DEFAULT_LIMITS.maxVoiceNoteDuration,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const remaining = Math.max(0, maxDuration - duration);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    stopTimer();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, [stopTimer]);

  // Start recording on mount
  useEffect(() => {
    let cancelled = false;

    async function startRecording() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
            ? "audio/ogg;codecs=opus"
            : undefined;

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        recorder.start();
        setIsRecording(true);
        setDuration(0);

        timerRef.current = setInterval(() => {
          setDuration((d) => d + 1);
        }, 1000);
      } catch {
        if (!cancelled) {
          setError("Microphone access denied");
        }
      }
    }

    startRecording();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [cleanup]);

  const handleStop = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;

    const currentDuration = duration;

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      cleanup();
      onRecordingComplete(blob, currentDuration);
    };

    recorder.stop();
    setIsRecording(false);
  }, [duration, cleanup, onRecordingComplete]);

  // Auto-stop when max duration is reached
  useEffect(() => {
    if (isRecording && duration >= maxDuration) {
      handleStop();
    }
  }, [duration, maxDuration, isRecording, handleStop]);

  const handleCancel = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.onstop = null;
      recorder.stop();
    }
    cleanup();
    onCancel();
  }, [cleanup, onCancel]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-red-50 px-4 py-3 dark:bg-red-900/20">
        <p className="flex-1 text-sm text-red-600 dark:text-red-400" data-testid="voice-error">
          {error}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
          data-testid="voice-error-dismiss"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl bg-zinc-50 px-4 py-3 dark:bg-zinc-800" data-testid="voice-recorder">
      {/* Recording indicator */}
      <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" data-testid="recording-indicator" />

      {/* Duration */}
      <span
        className={`font-mono text-sm ${
          remaining <= 5
            ? "text-red-500 dark:text-red-400"
            : "text-zinc-700 dark:text-zinc-300"
        }`}
        data-testid="recording-duration"
      >
        {formatTime(duration)}
      </span>

      {/* Remaining time */}
      <span
        className={`font-mono text-xs ${
          remaining <= 5
            ? "text-red-400 dark:text-red-300"
            : "text-zinc-400 dark:text-zinc-500"
        }`}
        data-testid="recording-remaining"
      >
        {remaining}s left
      </span>

      <div className="flex-1" />

      {/* Cancel button */}
      <button
        type="button"
        onClick={handleCancel}
        className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
        data-testid="voice-cancel"
      >
        Cancel
      </button>

      {/* Stop button */}
      <button
        type="button"
        onClick={handleStop}
        disabled={!isRecording}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600 disabled:opacity-50"
        data-testid="voice-stop"
        aria-label="Stop recording"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <rect x="6" y="6" width="8" height="8" rx="1" />
        </svg>
      </button>
    </div>
  );
}
