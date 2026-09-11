import { useState, useCallback, useRef, useEffect } from 'react';

export function useWebSpeech(languageCode: string) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);

    const mapLangToLocale = (lang: string) => {
        const map: Record<string, string> = {
            'en': 'en-IN',
            'hi': 'hi-IN',
            'mr': 'mr-IN',
            'bn': 'bn-IN',
            'ta': 'ta-IN',
            'te': 'te-IN',
            'gu': 'gu-IN',
            'kn': 'kn-IN',
            'ml': 'ml-IN',
        };
        return map[lang] || 'en-US';
    };

    // Clean up recognition on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {
                    // Ignore errors on unmount
                }
            }
        };
    }, []);

    const startListening = useCallback(() => {
        setError(null);
        setTranscript('');
        
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setError("Speech recognition not supported in this browser");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = mapLangToLocale(languageCode);
        recognition.continuous = false;
        recognition.interimResults = true; // Set to true to show live text if needed
        
        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onresult = (event: any) => {
            let currentTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                currentTranscript += event.results[i][0].transcript;
            }
            setTranscript(currentTranscript);
        };

        recognition.onerror = (event: any) => {
            if (event.error === 'not-allowed') {
                setError("Microphone permission denied");
            } else if (event.error === 'no-speech') {
                setError("No speech detected. Please try again.");
            } else {
                setError("Speech recognition error");
            }
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        
        try {
            recognition.start();
        } catch (e) {
            setError("Speech recognition error");
            setIsListening(false);
        }
    }, [languageCode]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                // ignore
            }
        }
        setIsListening(false);
    }, []);

    const reset = useCallback(() => {
        setTranscript('');
        setError(null);
    }, []);

    return {
        isListening,
        transcript,
        error,
        startListening,
        stopListening,
        reset,
        setTranscript
    };
}
