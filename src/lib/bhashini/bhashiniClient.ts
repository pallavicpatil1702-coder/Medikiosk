export interface BhashiniResult {
  originalTranscript: string;
  normalizedEnglishText: string;
  detectedLanguage: string;
}

export class BhashiniClient {
  private userId: string;
  private apiKey: string;
  private pipelineId: string;
  private apiUrl: string;

  constructor() {
    this.userId = process.env.BHASHINI_USER_ID || '';
    this.apiKey = process.env.BHASHINI_API_KEY || '';
    this.pipelineId = process.env.BHASHINI_PIPELINE_ID || '';
    this.apiUrl = process.env.BHASHINI_API_URL || 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';
  }

  isConfigured(): boolean {
    // If not configured, we will automatically fallback to Web Speech
    return !!(this.userId && this.apiKey);
  }

  /**
   * Mock processing for testing without real credentials
   */
  private getMockResponse(sourceLanguage: string): BhashiniResult {
    // Return a mock normalized string just to test the pipeline without hitting real API
    return {
      originalTranscript: `(Mock Bhashini) ${sourceLanguage} speech detected`,
      normalizedEnglishText: "Patient reports mild pain in the right shoulder.",
      detectedLanguage: sourceLanguage
    };
  }

  /**
   * Process voice via BHASHINI ASR + Translation Pipeline
   */
  async processVoice(audioBase64: string, sourceLanguage: string): Promise<BhashiniResult> {
    if (!this.isConfigured()) {
      if (process.env.BHASHINI_MOCK_MODE === 'true') {
        // Delay to simulate network
        await new Promise(resolve => setTimeout(resolve, 1500));
        return this.getMockResponse(sourceLanguage);
      }
      throw new Error('BHASHINI_NOT_CONFIGURED');
    }

    try {
      // Standard ULCA Compute Pipeline Request
      const payload = {
        pipelineTasks: [
          {
            taskType: "asr",
            config: {
              language: {
                sourceLanguage: sourceLanguage
              },
              audioFormat: "wav", // We assume webm or wav depending on MediaRecorder
              samplingRate: 16000
            }
          },
          {
            taskType: "translation",
            config: {
              language: {
                sourceLanguage: sourceLanguage,
                targetLanguage: "en"
              }
            }
          }
        ],
        pipelineRequestConfig: {
          pipelineId: "64392f96daac500b55c543cd" // Standard Bhashini Meghdoot pipeline ID
        },
        inputData: {
          audio: [
            {
              audioContent: audioBase64.replace(/^data:audio\/\w+;base64,/, "") // strip prefix if present
            }
          ]
        }
      };

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey // Only the Inference Key is needed for auth
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Bhashini API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Parse ULCA response (mock extraction logic depending on exact Dhruva structure)
      // Usually output is in pipelineResponse[1].output[0].target for translation
      // and pipelineResponse[0].output[0].source for ASR transcript
      const asrOutput = data?.pipelineResponse?.[0]?.output?.[0]?.source || '';
      const translationOutput = data?.pipelineResponse?.[1]?.output?.[0]?.target || '';

      if (!asrOutput) {
        throw new Error('Bhashini returned empty ASR transcript');
      }

      return {
        originalTranscript: asrOutput,
        normalizedEnglishText: translationOutput || asrOutput,
        detectedLanguage: sourceLanguage
      };
    } catch (error) {
      console.error('[BhashiniClient] Process Voice Error:', error);
      throw error;
    }
  }
}

export const bhashiniClient = new BhashiniClient();
