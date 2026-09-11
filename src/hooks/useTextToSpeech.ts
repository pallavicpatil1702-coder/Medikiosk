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
  
  // Track current utterance to ensure cleanup
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setSupported(false);
    }
  }, []);

  const cancel = useCallback(() => {
    if (supported && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [supported]);

  const speak = useCallback((text: string) => {
    if (!supported || !window.speechSynthesis) return;

    // Cancel any ongoing speech
    cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getSpeechLocale(lang);
    
    // Slight adjustments for better clarity on Indian locales if available
    utterance.rate = 0.9;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    
    // Handle both end and error states to reset the speaking indicator
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [lang, supported, cancel]);

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
