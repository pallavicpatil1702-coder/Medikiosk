import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { extractTextFromFileBuffer } from '@/lib/server/ocrEngine';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'missing',
});

/**
 * Deterministic fallback parser to structure clinical laboratory tests and medications
 * from OCR text if Groq is unavailable, rate-limited, or fails to parse.
 */
function extractClinicalDataViaRegex(text: string) {
  const tests: Array<{ name: string; value: string; unit: string; referenceRange: string; flag: string | null }> = [];
  const medicines: string[] = [];
  const lines = text.split('\n');

  // Detect explicit report date
  let reportDate: string | null = null;
  const dateMatch = text.match(/(?:date|collected|reported|test date)[:\s]*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{2,4})/i);
  if (dateMatch) {
    reportDate = dateMatch[1].trim();
  }

  const ignoredKeywords = new Set([
    'age', 'page', 'phone', 'contact', 'id', 'date', 'ref', 'dr', 'time', 'sl',
    'no', 'patient', 'name', 'sex', 'gender', 'sample', 'barcode', 'mrn', 'bill',
    'specimen', 'lab', 'hospital', 'clinic', 'referred', 'consultant', 'status'
  ]);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;

    // Check medicine pattern first: "Tab Paracetamol 650mg"
    const medMatch = trimmed.match(/^(?:Tab|Cap|Syp|Inj|Tablet|Capsule|Syrup)\.?\s+([A-Za-z0-9\-]+(?:\s+[0-9]+(?:\s*mg|\s*g|\s*ml)?)?)/i);
    if (medMatch) {
      medicines.push(trimmed);
      continue;
    }

    // Check lab test line patterns:
    // Pattern 1: "Hemoglobin : 13.5 g/dL (12.0 - 15.0)" or "Hemoglobin: 13.5 g/dL"
    // Pattern 2: "Hemoglobin 13.5 g/dL 12.0 - 15.0"
    const m1 = trimmed.match(/^([A-Za-z0-9\s\-_/()]+?)[:\t]\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%μuLmgdLkg\^]+)?(?:\s*[\(\[]?(.*?)[\]\)]?)?$/);
    const m2 = !m1 ? trimmed.match(/^([A-Za-z\s\-_/()]{3,35})\s+([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%μuLmgdLkg\^]+)?(?:\s+([0-9]+(?:\.[0-9]+)?\s*[-–]\s*[0-9]+(?:\.[0-9]+)?))?/) : null;

    const match = m1 || m2;
    if (match) {
      const rawName = match[1].trim();
      const value = match[2].trim();
      const unit = (match[3] || '').trim();
      let refRange = (match[4] || '').replace(/[()\[\]]/g, '').trim();

      const lowerName = rawName.toLowerCase();
      // Avoid headers and non-clinical metadata
      if (
        !ignoredKeywords.has(lowerName) &&
        !lowerName.startsWith('tab ') &&
        !lowerName.startsWith('cap ') &&
        !lowerName.startsWith('syp ') &&
        rawName.length >= 2 &&
        rawName.length <= 40
      ) {
        let flag: string | null = null;
        if (refRange) {
          const rangeBounds = refRange.match(/([0-9]+(?:\.[0-9]+)?)\s*[-–]\s*([0-9]+(?:\.[0-9]+)?)/);
          if (rangeBounds) {
            const numVal = parseFloat(value);
            const low = parseFloat(rangeBounds[1]);
            const high = parseFloat(rangeBounds[2]);
            if (!isNaN(numVal) && !isNaN(low) && !isNaN(high)) {
              if (numVal < low) flag = 'Low';
              else if (numVal > high) flag = 'High';
            }
          }
        }
        tests.push({
          name: rawName,
          value,
          unit,
          referenceRange: refRange,
          flag,
        });
      }
    }
  }

  return { reportDate, tests, medicines: Array.from(new Set(medicines)) };
}

// For Next.js App Router API
export async function POST(req: NextRequest) {
  try {
    console.log('[API/extract] POST request received');

    const body = await req.json();
    const { downloadUrl, dataUrl, mimeType } = body;
    console.log('[API/extract] MimeType:', mimeType, '| hasDownloadUrl:', !!downloadUrl, '| hasDataUrl:', !!dataUrl);

    if (!mimeType) {
      return NextResponse.json({ error: 'MIME type is required.' }, { status: 400 });
    }

    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    const normalizedMime = mimeType.toLowerCase().split(';')[0].trim();
    if (!validTypes.includes(normalizedMime)) {
      return NextResponse.json({ error: 'Unsupported file type. Please upload a PDF, JPG, or PNG report.' }, { status: 400 });
    }

    let buffer: Buffer;

    if (downloadUrl) {
      // Authenticated flow: Fetch from Firebase Storage with resilient 25s timeout
      console.log('[API/extract] Fetching report from downloadUrl...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      try {
        const res = await fetch(downloadUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) {
          console.error('[API/extract] Failed to fetch downloadUrl. Status:', res.status);
          return NextResponse.json({ error: 'Failed to download report from cloud storage. File may be expired or inaccessible.' }, { status: 502 });
        }
        const arrayBuffer = await res.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        console.error('[API/extract] Fetch error:', fetchErr?.message);
        if (fetchErr.name === 'AbortError') {
          return NextResponse.json({ error: 'Download from storage timed out. Please check network and retry.' }, { status: 504 });
        }
        return NextResponse.json({ error: 'Could not retrieve report from storage.' }, { status: 502 });
      }
    } else if (dataUrl) {
      // Demo / Kiosk fallback: Base64
      console.log('[API/extract] Processing Base64 dataUrl...');
      const base64Data = dataUrl.split(',')[1];
      if (!base64Data) {
        return NextResponse.json({ error: 'Invalid dataUrl format.' }, { status: 400 });
      }
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      return NextResponse.json({ error: 'No report file provided for extraction.' }, { status: 400 });
    }

    // --- 1. OCR TEXT EXTRACTION BOUNDARY ---
    console.log('[API/extract] Starting OCR pipeline...');
    const extractedText = await extractTextFromFileBuffer(buffer, normalizedMime);

    if (!extractedText || extractedText.trim().length === 0) {
      console.log('[API/extract] OCR found no readable text. Returning explicit non-empty status.');
      return NextResponse.json({
        data: {
          tests: [],
          medicines: [],
          confidence: 'low',
          source: 'No readable text detected',
          summary: 'No readable text or laboratory test parameters could be detected from this document. Please verify the report scan is clear and upright.',
          rawText: '',
        },
        warning: 'No readable text was detected from the uploaded document.',
      });
    }

    console.log('[API/extract] OCR Success. Extracted length:', extractedText.length);
    console.log('[API/extract] First 120 chars of OCR:', extractedText.substring(0, 120).replace(/\n/g, ' '));

    // --- 2. STRUCTURING LAYER (GROQ AI WITH REGEX FALLBACK) ---
    let aiResult: any = null;

    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'missing') {
      const systemPrompt = `You are a strict clinical data structuring assistant. Your task is to extract structured laboratory test data and medicines from the provided medical report OCR text.
STRICT EXTRACTION RULES:
- Extract ONLY information visibly present in the report/OCR text.
- Provide a concise 1-2 sentence factual clinical summary of the key test findings in "summary".
- Never invent missing values.
- Never infer a medical condition.
- Never diagnose.
- Never recommend treatment.
- Never prescribe medicine.
- Never convert an absent value into a guessed value.
- Preserve units exactly where possible.
- Preserve reference ranges exactly where available.
- If reference range is present and value is numeric, set flag to "High", "Low", or null.
- If a field is not present, leave it empty/null.
- Only include medicines if explicitly present in the source.
- Only include reportDate if explicitly visible in the source.
- Do not confuse upload date with report date.

Output JSON exactly matching this structure:
{
  "reportDate": "DD MMM YYYY" | null,
  "summary": "1-2 sentence factual summary of key findings" | null,
  "tests": [
    {
      "name": "Test Name",
      "value": "Test Value",
      "unit": "Unit if present",
      "referenceRange": "Reference range if present",
      "flag": "High" | "Low" | "Abnormal" | null
    }
  ],
  "medicines": ["Medicine 1", "Medicine 2"],
  "confidence": "high" | "medium" | "low"
}`;

      try {
        console.log('[API/extract] Starting Groq structuring request...');
        const completion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Extract clinical data from this OCR text:\n\n${extractedText.substring(0, 8000)}` }
          ],
          model: 'groq/compound',
          response_format: { type: 'json_object' },
          temperature: 0,
        });

        const aiResultStr = completion.choices[0]?.message?.content;
        if (aiResultStr) {
          let jsonStr = aiResultStr;
          const jsonMatch = aiResultStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
          if (jsonMatch && jsonMatch[1]) {
            jsonStr = jsonMatch[1];
          } else {
            const braceIndex = aiResultStr.indexOf('{');
            if (braceIndex >= 0) {
              jsonStr = aiResultStr.substring(braceIndex);
              const lastBraceIndex = jsonStr.lastIndexOf('}');
              if (lastBraceIndex >= 0) {
                jsonStr = jsonStr.substring(0, lastBraceIndex + 1);
              }
            }
          }
          aiResult = JSON.parse(jsonStr);
          aiResult.source = 'Groq AI structured extraction';
        }
      } catch (aiErr: any) {
        console.warn('[API/extract] Groq AI parsing failed or unavailable, running regex clinical parser:', aiErr?.message);
      }
    }

    // --- 3. REGEX FALLBACK IF AI PRODUCED NO TESTS ---
    if (!aiResult || (!aiResult.tests?.length && !aiResult.medicines?.length)) {
      console.log('[API/extract] Executing deterministic regex clinical parser on OCR text...');
      const regexParsed = extractClinicalDataViaRegex(extractedText);

      aiResult = {
        reportDate: regexParsed.reportDate || aiResult?.reportDate || null,
        summary: regexParsed.tests.length > 0
          ? `Extracted ${regexParsed.tests.length} laboratory test parameter(s): ${regexParsed.tests.slice(0, 5).map(t => `${t.name}: ${t.value} ${t.unit}`).join(', ')}${regexParsed.tests.length > 5 ? '...' : ''}`
          : 'Document OCR processed successfully. Clinical findings archived.',
        tests: regexParsed.tests,
        medicines: regexParsed.medicines,
        confidence: regexParsed.tests.length > 0 ? 'medium' : 'low',
        source: 'OCR extraction with deterministic parsing'
      };
    }

    // Ensure summary is informative and strictly clinical
    if (!aiResult.summary) {
      if (aiResult.tests && aiResult.tests.length > 0) {
        aiResult.summary = `Extracted ${aiResult.tests.length} laboratory test parameter(s): ${aiResult.tests.slice(0, 5).map((t: any) => `${t.name} (${t.value} ${t.unit || ''})`).join(', ')}.`;
      } else {
        aiResult.summary = 'Medical report processed and archived.';
      }
    }

    aiResult.rawText = extractedText;

    console.log('[API/extract] Extraction completed successfully:', {
      testsCount: aiResult.tests?.length || 0,
      medicinesCount: aiResult.medicines?.length || 0,
      hasSummary: !!aiResult.summary
    });

    return NextResponse.json({ data: aiResult });

  } catch (error: any) {
    console.error('[API/extract] Extraction API Catch Block Error:', error?.message || error);
    if (error?.stack) console.error(error.stack);

    // Handle Rate Limit gracefully
    if (error?.status === 429) {
      return NextResponse.json({
        error: 'AI Provider Rate Limit exceeded. Please try again in a moment.',
        data: {
          tests: [],
          medicines: [],
          confidence: 'low',
          source: 'Rate limited',
          summary: 'AI extraction service is currently busy. Please retry in a moment.'
        }
      }, { status: 429 });
    }

    return NextResponse.json({
      error: 'An error occurred during medical report extraction.',
      details: error?.message || 'Unknown extraction error'
    }, { status: 500 });
  }
}

