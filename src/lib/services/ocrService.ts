import { ExtractedClinicalData, MedicalDocument } from '../types';

export async function extractFromReport(document: MedicalDocument): Promise<{ data: ExtractedClinicalData; error?: string }> {
  try {
    const payload = {
      downloadUrl: document.downloadUrl,
      dataUrl: document.dataUrl,
      mimeType: document.fileType,
    };

    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (!res.ok) {
      if (res.status === 429) {
        return {
          data: result.data || { tests: [], medicines: [], confidence: 'low', source: 'Rate limited' },
          error: 'AI extraction is currently rate-limited. Please try again later.',
        };
      }
      console.error('Server extraction error:', result.error);
      return {
        data: { tests: [], medicines: [], confidence: 'low', source: 'Error' },
        error: result.error || 'Failed to extract data from the report.',
      };
    }

    return { data: result.data };
  } catch (error) {
    console.error('OCR Service Error:', error);
    return {
      data: { tests: [], medicines: [], confidence: 'low', source: 'Network error' },
      error: 'Network error occurred during extraction.',
    };
  }
}
