// @ts-ignore
const pdfParse = require('pdf-parse');
import Tesseract from 'tesseract.js';

export async function extractTextFromFileBuffer(buffer: Buffer, mimeType: string): Promise<string | null> {
  console.log('[ocrEngine] Starting OCR extraction for mimeType:', mimeType);
  console.log('[ocrEngine] Buffer size:', buffer.length, 'bytes');
  try {
    if (mimeType === 'application/pdf') {
      console.log('[ocrEngine] Attempting pdfParse...');
      const data = await pdfParse(buffer);
      console.log('[ocrEngine] pdfParse returned data. text length:', data?.text?.length || 0);
      if (data && data.text && data.text.trim().length > 0) {
        return data.text.trim();
      }
    } else if (mimeType.startsWith('image/')) {
      console.log('[ocrEngine] Attempting Tesseract...');
      const { data } = await Tesseract.recognize(buffer, 'eng');
      console.log('[ocrEngine] Tesseract returned data. text length:', data?.text?.length || 0);
      if (data && data.text && data.text.trim().length > 0) {
        return data.text.trim();
      }
    } else {
      console.log('[ocrEngine] Unsupported mimeType for OCR:', mimeType);
    }
    return null;
  } catch (error) {
    console.error('[ocrEngine] OCR Engine Error:', error);
    return null;
  }
}
