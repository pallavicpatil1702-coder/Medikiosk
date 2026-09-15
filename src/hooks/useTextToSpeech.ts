import { useState, useEffect, useCallback, useRef } from 'react';

const getSpeechLocale = (lang: string) => {
  const map: Record<string, string> = {
    en: 'en-IN',
    hi: 'hi-IN',
    mr: 'mr-IN',
    bn: 'bn-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    gu: 'gu-IN',
    kn: 'kn-IN',
    ml: 'ml-IN',
  };
  return map[lang] || 'en-IN';
};

export function useTextToSpeech(lang: string = 'en') {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  
  // Track current utterance and audio element to ensure cleanup
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setSupported(false);
      return;
    }
    // Supported if either Audio or window.speechSynthesis is available
    const hasAudio = typeof Audio !== 'undefined';
    const hasSpeech = !!window.speechSynthesis;
    setSupported(hasAudio || hasSpeech);
  }, []);

  const cancel = useCallback(() => {
    // 1. Stop audio playback if active
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (e) {}
      audioRef.current = null;
    }

    // 2. Stop browser speech synthesis if active
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }

    setIsSpeaking(false);
  }, []);

  // Web Speech API fallback with intelligent voice matching
  const speakWithSpeechSynthesis = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setIsSpeaking(false);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const targetLocale = getSpeechLocale(lang);
      utterance.lang = targetLocale;
      utterance.rate = 0.9;
      utterance.pitch = 1.0;

      // Match voices
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Look for exact language match
        let matchedVoice = voices.find(v => v.lang.toLowerCase() === targetLocale.toLowerCase() || v.lang.toLowerCase().startsWith(lang.toLowerCase()));
        
        // If not found and language is Marathi or Gujarati, try Hindi voice (Devanagari script phonetic match)
        if (!matchedVoice && (lang === 'mr' || lang === 'gu')) {
          matchedVoice = voices.find(v => v.lang.toLowerCase().startsWith('hi'));
        }
        
        // If still not found, try any Indian English/Hindi voice
        if (!matchedVoice) {
          matchedVoice = voices.find(v => v.lang.toLowerCase().includes('in') || v.lang.toLowerCase().includes('india'));
        }

        if (matchedVoice) {
          utterance.voice = matchedVoice;
          utterance.lang = matchedVoice.lang;
        }
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error:', e);
        setIsSpeaking(false);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('SpeechSynthesis exception:', err);
      setIsSpeaking(false);
    }
  }, [lang]);

  const speak = useCallback((text: string) => {
    if (!text || !text.trim()) return;

    // Cancel any ongoing speech
    cancel();

    // Primary method: Use high-fidelity native TTS audio stream (/api/tts)
    // Works across all languages (Marathi, Bengali, Tamil, Telugu, Gujarati, Kannada, Malayalam, Hindi, English)
    // without requiring OS-level language packs to be installed.
    try {
      const ttsUrl = `/api/tts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(text.trim())}`;
      const audio = new Audio(ttsUrl);
      audioRef.current = audio;

      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        audioRef.current = null;
      };
      audio.onerror = (err) => {
        console.warn('Online TTS audio failed, falling back to browser SpeechSynthesis:', err);
        audioRef.current = null;
        speakWithSpeechSynthesis(text);
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Audio play was interrupted or blocked, falling back to SpeechSynthesis:', err);
          audioRef.current = null;
          speakWithSpeechSynthesis(text);
        });
      }
    } catch (err) {
      console.warn('Failed to initialize Audio, falling back to SpeechSynthesis:', err);
      speakWithSpeechSynthesis(text);
    }
  }, [lang, cancel, speakWithSpeechSynthesis]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    speak,
    cancel,
    isSpeaking,
    supported
  };
}
