import { useState, useCallback, useRef, useEffect } from 'react';
import { useWebSpeech } from './useWebSpeech';

export interface VoiceResult {
  originalTranscript: string;
  normalizedEnglishText: string;
  detectedLanguage: string;
  source: 'bhashini' | 'web-speech';
}

export function useBhashiniVoice(languageCode: string) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [normalizedText, setNormalizedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Fallback to Web Speech if Bhashini is not configured or fails
  const [useFallback, setUseFallback] = useState(false);
  const webSpeech = useWebSpeech(languageCode);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Keep transcript in sync if we are in fallback mode
  useEffect(() => {
    if (useFallback && webSpeech.transcript) {
      setTranscript(webSpeech.transcript);
      setNormalizedText(webSpeech.transcript); // Web Speech has no translation natively here
    }
  }, [useFallback, webSpeech.transcript]);

  useEffect(() => {
    if (useFallback && webSpeech.error) {
      setError(webSpeech.error);
    }
  }, [useFallback, webSpeech.error]);

  const startListening = useCallback(async () => {
    setError(null);
    setTranscript('');
    setNormalizedText('');
    
    if (useFallback) {
      webSpeech.startListening();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        setIsProcessing(true);
        
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64AudioMessage = reader.result as string;
            
            try {
              const res = await fetch('/api/bhashini/process-voice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  audioBase64: base64AudioMessage,
                  sourceLanguage: languageCode
                })
              });

              if (res.status === 503) {
                // BHASHINI_NOT_CONFIGURED -> Graceful Fallback
                console.warn('BHASHINI not configured, falling back to Web Speech API');
                setUseFallback(true);
                setError('Bhashini unavailable. Tap mic again to use local speech recognition.');
                setIsProcessing(false);
                return;
              }

              if (!res.ok) {
                throw new Error('Failed to process audio');
              }

              const data = await res.json();
              setTranscript(data.originalTranscript);
              setNormalizedText(data.normalizedEnglishText);
            } catch (err: any) {
              console.error('Bhashini API error:', err);
              setError('Failed to process speech. Tap mic again to use local speech recognition.');
              setUseFallback(true); // switch to fallback on any error
            } finally {
              setIsProcessing(false);
            }
          };
        } catch (err) {
          console.error('Audio processing error:', err);
          setError('Failed to process audio');
          setIsProcessing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Mic access error:', err);
      setError('Microphone access denied');
      // If mic denied, we can try fallback but it will probably also fail
      setUseFallback(true);
    }
  }, [languageCode, useFallback, webSpeech]);

  const stopListening = useCallback(() => {
    if (useFallback) {
      webSpeech.stopListening();
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      setIsRecording(false);
    }
  }, [useFallback, webSpeech]);

  const reset = useCallback(() => {
    setTranscript('');
    setNormalizedText('');
    setError(null);
    if (useFallback) {
      webSpeech.reset();
    }
  }, [useFallback, webSpeech]);

  return {
    isListening: useFallback ? webSpeech.isListening : isRecording,
    isProcessing,
    transcript,
    normalizedText,
    error,
    startListening,
    stopListening,
    reset,
    setTranscript,
    setNormalizedText,
    source: (useFallback ? 'web-speech' : 'bhashini') as 'bhashini' | 'web-speech'
  };
}
