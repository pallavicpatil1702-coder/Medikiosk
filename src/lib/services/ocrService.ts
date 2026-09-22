import { ExtractedClinicalData, MedicalDocument } from '../types';

export async function extractFromReport(
  document: MedicalDocument
): Promise<{ data: ExtractedClinicalData; error?: string; warning?: string }> {
  try {
    if (!document.downloadUrl && !document.dataUrl) {
      return {
        data: {
          tests: [],
          medicines: [],
          confidence: 'low',
          source: 'Missing document content',
          summary: 'No document content available for extraction.',
        },
        error: 'Report has neither a cloud storage URL nor local image data.',
      };
    }

    const payload = {
      downloadUrl: document.downloadUrl,
      dataUrl: document.dataUrl,
      mimeType: document.fileType || 'application/pdf',
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
          error: 'AI extraction is currently busy or rate-limited. Please try again in a moment.',
        };
      }
      console.error('Server extraction error:', result.error);
      return {
        data: {
          tests: [],
          medicines: [],
          confidence: 'low',
          source: 'Extraction failed',
          summary: result.error || 'Failed to extract data from the report.',
        },
        error: result.error || 'Failed to extract data from the report.',
      };
    }

    return {
      data: result.data,
      warning: result.warning,
    };
  } catch (error: any) {
    console.error('OCR Service Error:', error);
    return {
      data: {
        tests: [],
        medicines: [],
        confidence: 'low',
        source: 'Network error',
        summary: 'Network error occurred during document extraction.',
      },
      error: error?.message || 'Network error occurred during extraction.',
    };
  }
}

