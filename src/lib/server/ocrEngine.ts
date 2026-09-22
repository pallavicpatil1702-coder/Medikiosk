// @ts-ignore
const pdfParseModule = require('pdf-parse');
import Tesseract from 'tesseract.js';

/**
 * Detect file kind from buffer magic bytes to guard against incorrect MIME types.
 */
function detectKindFromBuffer(buffer: Buffer): 'pdf' | 'image' | 'unknown' {
  if (!buffer || buffer.length < 4) return 'unknown';

  // PDF: %PDF (0x25, 0x50, 0x44, 0x46)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'pdf';
  }

  // PNG: 0x89, 0x50, 0x4E, 0x47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image';
  }

  // JPEG: 0xFF, 0xD8, 0xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image';
  }

  // WebP: RIFF ... WEBP
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image';
  }

  return 'unknown';
}

/**
 * Extracts readable clinical text from a document buffer (PDF or Image).
 * Supports both digital text PDFs and scanned (image-based) PDFs.
 */
export async function extractTextFromFileBuffer(buffer: Buffer, mimeType: string): Promise<string | null> {
  const normalizedMime = (mimeType || '').toLowerCase().split(';')[0].trim();
  const detectedKind = detectKindFromBuffer(buffer);

  console.log('[ocrEngine] Starting extraction | MIME:', normalizedMime, '| Detected Kind:', detectedKind, '| Buffer bytes:', buffer.length);

  const isPdf = normalizedMime === 'application/pdf' || detectedKind === 'pdf';
  const isImage = normalizedMime.startsWith('image/') || detectedKind === 'image';

  try {
    if (isPdf) {
      console.log('[ocrEngine] Processing PDF document...');
      let parser: any = null;

      try {
        if (pdfParseModule?.PDFParse) {
          parser = new pdfParseModule.PDFParse({ data: buffer });
        } else if (typeof pdfParseModule === 'function') {
          try {
            parser = new pdfParseModule({ data: buffer });
          } catch (_) {
            // function might be traditional parser
          }
        }

        // --- STEP 1: Attempt digital text extraction ---
        let rawText = '';
        if (parser && typeof parser.load === 'function' && typeof parser.getText === 'function') {
          await parser.load();
          const textResult = await parser.getText();
          rawText = typeof textResult === 'string' ? textResult : (textResult?.text || '');
        } else if (typeof pdfParseModule === 'function') {
          const data = await pdfParseModule(buffer);
          rawText = data?.text || '';
        }

        // Clean pagination and artifact markers (e.g. "-- 1 of 1 --")
        const cleanDigitalText = rawText.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '').trim();
        console.log('[ocrEngine] Digital text length:', cleanDigitalText.length);

        if (cleanDigitalText.length > 25) {
          console.log('[ocrEngine] Found valid digital text stream in PDF.');
          return cleanDigitalText;
        }

        // --- STEP 2: Scanned PDF fallback (Image-to-OCR) ---
        console.log('[ocrEngine] PDF has no embedded digital text. Initiating scanned PDF OCR flow...');
        let ocrResults: string[] = [];

        if (parser && typeof parser.getScreenshot === 'function') {
          try {
            console.log('[ocrEngine] Rendering PDF pages via getScreenshot...');
            const screenshotResult = await parser.getScreenshot({ imageBuffer: true, scale: 2.0 });
            const pages = screenshotResult?.pages || [];
            console.log(`[ocrEngine] Rendered ${pages.length} page(s) for OCR.`);

            // Process up to 4 pages to balance accuracy and execution time
            const maxPages = Math.min(pages.length, 4);
            for (let i = 0; i < maxPages; i++) {
              const page = pages[i];
              if (page?.data && page.data.length > 0) {
                const pageBuf = Buffer.from(page.data);
                console.log(`[ocrEngine] Running Tesseract on page ${i + 1}/${maxPages} (${pageBuf.length} bytes)...`);
                try {
                  const { data } = await Tesseract.recognize(pageBuf, 'eng');
                  if (data?.text && data.text.trim().length > 0) {
                    ocrResults.push(data.text.trim());
                  }
                } catch (tessPageErr) {
                  console.warn(`[ocrEngine] Tesseract error on page ${i + 1}:`, tessPageErr);
                }
              }
            }
          } catch (screenshotErr) {
            console.warn('[ocrEngine] getScreenshot encountered an issue, trying getImage fallback:', screenshotErr);
          }
        }

        // If screenshots yielded no text, attempt extracting raw embedded images
        if (ocrResults.length === 0 && parser && typeof parser.getImage === 'function') {
          try {
            console.log('[ocrEngine] Attempting embedded image extraction via getImage...');
            const imgResult = await parser.getImage({ imageBuffer: true });
            const pages = imgResult?.pages || [];
            for (const page of pages) {
              const images = page?.images || [];
              for (const img of images) {
                if (img?.data && img.data.length > 0) {
                  const imgBuf = Buffer.from(img.data);
                  try {
                    const { data } = await Tesseract.recognize(imgBuf, 'eng');
                    if (data?.text && data.text.trim().length > 0) {
                      ocrResults.push(data.text.trim());
                    }
                  } catch (tessImgErr) {
                    console.warn('[ocrEngine] Tesseract error on embedded image:', tessImgErr);
                  }
                }
              }
            }
          } catch (imgErr) {
            console.warn('[ocrEngine] getImage fallback error:', imgErr);
          }
        }

        if (ocrResults.length > 0) {
          const combinedOcr = ocrResults.join('\n\n---\n\n').trim();
          console.log('[ocrEngine] Scanned PDF OCR succeeded. Combined text length:', combinedOcr.length);
          return combinedOcr;
        }

        // If digital text had some characters (even under threshold), return it rather than nothing
        if (cleanDigitalText.length > 0) {
          return cleanDigitalText;
        }

      } finally {
        if (parser && typeof parser.destroy === 'function') {
          try {
            await parser.destroy();
          } catch (_) {}
        }
      }

      return null;
    }

    if (isImage) {
      if (buffer.length < 32) {
        console.warn('[ocrEngine] Image buffer too small (< 32 bytes).');
        return null;
      }
      console.log('[ocrEngine] Running Tesseract OCR on image document...');
      try {
        const { data } = await Tesseract.recognize(buffer, 'eng');
        const text = data?.text?.trim() || '';
        console.log('[ocrEngine] Image OCR completed. Text length:', text.length);
        return text.length > 0 ? text : null;
      } catch (imgErr) {
        console.warn('[ocrEngine] Tesseract image OCR failed on buffer:', imgErr);
        return null;
      }
    }

    console.warn('[ocrEngine] Unsupported format for extraction:', normalizedMime);
    return null;
  } catch (error) {
    console.error('[ocrEngine] Extraction pipeline error:', error);
    return null;
  }
}

