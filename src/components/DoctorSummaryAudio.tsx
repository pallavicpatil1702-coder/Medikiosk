"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, Play, Pause, Square, AlertCircle, Sparkles, Gauge } from 'lucide-react';

interface DoctorSummaryAudioProps {
  /** The exact visible English summary text to be read aloud */
  textToSpeak: string;
  /** Unique ID of current patient/session to cancel audio when switching */
  patientId: string;
  /** Patient name for display/context */
  patientName?: string;
}

export default function DoctorSummaryAudio({
  textToSpeak,
  patientId,
  patientName
}: DoctorSummaryAudioProps) {
  const [playbackState, setPlaybackState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [speed, setSpeed] = useState<number>(1.0);
  const [supported, setSupported] = useState<boolean>(true);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const textRef = useRef<string>(textToSpeak);
  const speedRef = useRef<number>(speed);

  // Keep refs in sync
  useEffect(() => {
    textRef.current = textToSpeak;
  }, [textToSpeak]);

  useEffect(() => {
    speedRef.current = speed;
    if (utteranceRef.current) {
      utteranceRef.current.rate = speed;
    }
  }, [speed]);

  // Check browser SpeechSynthesis support on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setSupported(false);
    }
  }, []);

  // Stop any active speech immediately if the doctor selects a different patient
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlaybackState('idle');
    utteranceRef.current = null;
  }, [patientId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Cancel / Stop helper
  const handleStop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlaybackState('idle');
    utteranceRef.current = null;
  }, []);

  // Play from start
  const handlePlay = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // 1. Cancel any active or pending speech
    window.speechSynthesis.cancel();

    const cleanText = textRef.current?.trim();
    if (!cleanText) return;

    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = speedRef.current;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';

      // Pick an English voice (prefer Indian English or standard natural English)
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const preferredVoice = 
          voices.find(v => v.lang === 'en-IN') ||
          voices.find(v => v.lang.includes('en-GB')) ||
          voices.find(v => v.lang.includes('en-US')) ||
          voices.find(v => v.lang.startsWith('en'));
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      }

      utterance.onstart = () => {
        setPlaybackState('playing');
      };

      utterance.onpause = () => {
        setPlaybackState('paused');
      };

      utterance.onresume = () => {
        setPlaybackState('playing');
      };

      utterance.onend = () => {
        setPlaybackState('idle');
        utteranceRef.current = null;
      };

      utterance.onerror = (e) => {
        // 'interrupted' or 'canceled' are normal when stop/pause is clicked
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          console.warn('[DoctorSummaryAudio] Speech error:', e.error);
        }
        setPlaybackState('idle');
        utteranceRef.current = null;
      };

      utteranceRef.current = utterance;
      setPlaybackState('playing');
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('[DoctorSummaryAudio] Failed to speak summary:', err);
      setPlaybackState('idle');
    }
  }, []);

  // Pause
  const handlePause = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    try {
      window.speechSynthesis.pause();
      setPlaybackState('paused');
    } catch (e) {
      console.warn('[DoctorSummaryAudio] Pause error:', e);
    }
  }, []);

  // Resume
  const handleResume = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setPlaybackState('playing');
      } else {
        // Fallback: If browser lost utterance state, restart from current text
        handlePlay();
      }
    } catch (e) {
      console.warn('[DoctorSummaryAudio] Resume error:', e);
      handlePlay();
    }
  }, [handlePlay]);

  // Handle speed change
  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    // If currently playing, restart with new speed seamlessly
    if (playbackState === 'playing') {
      window.speechSynthesis.cancel();
      setTimeout(() => {
        speedRef.current = newSpeed;
        handlePlay();
      }, 50);
    }
  };

  if (!supported) {
    return null; // Gracefully degrade if browser doesn't have Web Speech
  }

  return (
    <div className="rounded-2xl bg-[#fbf9f4] border border-[#ded5c2] p-4 shadow-xs">
      {/* Top Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Play/Pause/Resume/Stop Controls */}
        <div className="flex items-center gap-2">
          {playbackState === 'idle' && (
            <button
              onClick={handlePlay}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#234e32] hover:bg-[#1a3b26] text-white text-xs font-bold shadow-sm transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#234e32]/30"
              aria-label="Listen to Summary"
            >
              <Volume2 size={16} className="text-white" />
              <span>🔊 Listen to Summary</span>
            </button>
          )}

          {playbackState === 'playing' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePause}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#6f4827] hover:bg-[#59391e] text-white text-xs font-bold shadow-sm transition active:scale-95"
                aria-label="Pause Speech"
              >
                <Pause size={15} />
                <span>Pause</span>
              </button>

              <button
                onClick={handleStop}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#f4efe4] hover:bg-[#eae3d2] text-[#4d2f19] border border-[#ded5c2] text-xs font-bold transition active:scale-95"
                aria-label="Stop Speech"
              >
                <Square size={14} className="fill-current text-[#b91c1c]" />
                <span>Stop</span>
              </button>

              {/* Animated audio indicator bars */}
              <div className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg bg-[#e4ede1] text-[#234e32]">
                <span className="w-1 h-3.5 bg-[#234e32] rounded-full animate-pulse" />
                <span className="w-1 h-5 bg-[#234e32] rounded-full animate-pulse delay-75" />
                <span className="w-1 h-2.5 bg-[#234e32] rounded-full animate-pulse delay-150" />
                <span className="text-[10px] font-bold ml-1">Speaking</span>
              </div>
            </div>
          )}

          {playbackState === 'paused' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleResume}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#234e32] hover:bg-[#1a3b26] text-white text-xs font-bold shadow-sm transition active:scale-95"
                aria-label="Resume Speech"
              >
                <Play size={15} className="fill-current" />
                <span>Resume</span>
              </button>

              <button
                onClick={handleStop}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#f4efe4] hover:bg-[#eae3d2] text-[#4d2f19] border border-[#ded5c2] text-xs font-bold transition active:scale-95"
                aria-label="Stop Speech"
              >
                <Square size={14} className="fill-current text-[#b91c1c]" />
                <span>Stop</span>
              </button>

              <span className="text-[10px] font-bold text-[#6f4827] bg-[#f8f0e5] border border-[#e8dac8] px-2 py-1 rounded-md">
                Paused
              </span>
            </div>
          )}
        </div>

        {/* Right: Speech Speed Controls (0.75x, 1x, 1.25x) */}
        <div className="flex items-center gap-1.5 bg-[#f4efe4] border border-[#ded5c2] p-1 rounded-xl">
          <span className="text-[10px] font-bold text-[#6e7d70] px-1.5 flex items-center gap-1">
            <Gauge size={12} /> Speed:
          </span>
          {[0.75, 1.0, 1.25].map((rate) => (
            <button
              key={rate}
              onClick={() => handleSpeedChange(rate)}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition ${
                speed === rate
                  ? 'bg-[#234e32] text-white shadow-xs'
                  : 'text-[#4d2f19] hover:bg-[#eae3d2]'
              }`}
              aria-label={`Speech speed ${rate}x`}
            >
              {rate === 1.0 ? '1x' : `${rate}x`}
            </button>
          ))}
        </div>
      </div>

      {/* Safety & Clinical Boundary Notice */}
      <div className="mt-2.5 pt-2 border-t border-[#ded5c2]/60 flex items-center justify-between gap-2 text-[11px] text-[#6b7c6e]">
        <div className="flex items-center gap-1.5">
          <AlertCircle size={13} className="text-[#6f4827] shrink-0" />
          <span className="font-semibold text-[#57493a]">
            AI-assisted draft — Review and confirm before clinical decision.
          </span>
        </div>
        <span className="hidden sm:inline-block text-[10px] text-[#829277] italic">
          Accessibility audio • Does not prescribe or diagnose
        </span>
      </div>
    </div>
  );
}
