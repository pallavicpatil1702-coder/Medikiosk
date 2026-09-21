// @ts-ignore
const pdfParseModule = require('pdf-parse');
import Tesseract from 'tesseract.js';

export async function extractTextFromFileBuffer(buffer: Buffer, mimeType: string): Promise<string | null> {
  console.log('[ocrEngine] Starting OCR extraction for mimeType:', mimeType);
  console.log('[ocrEngine] Buffer size:', buffer.length, 'bytes');
  try {
    if (mimeType === 'application/pdf') {
      console.log('[ocrEngine] Attempting PDF text extraction...');
      let text = '';
      if (typeof pdfParseModule === 'function') {
        const data = await pdfParseModule(buffer);
        text = data?.text || '';
      } else if (pdfParseModule?.PDFParse) {
        const parser = new pdfParseModule.PDFParse({ data: buffer });
        await parser.load();
        const result = await parser.getText();
        text = typeof result === 'string' ? result : (result?.text || '');
        await parser.destroy();
      } else if (pdfParseModule?.default && typeof pdfParseModule.default === 'function') {
        const data = await pdfParseModule.default(buffer);
        text = data?.text || '';
      }

      console.log('[ocrEngine] PDF extraction returned text length:', text.trim().length);
      if (text.trim().length > 0) {
        return text.trim();
      }
    } else if (mimeType.startsWith('image/')) {
      console.log('[ocrEngine] Attempting Tesseract OCR for image...');
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
