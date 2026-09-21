import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { extractTextFromFileBuffer } from '@/lib/server/ocrEngine';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'missing',
});

// For Next.js App Router API
export async function POST(req: NextRequest) {
  try {
    console.log('[API/extract] POST request received');
    if (!process.env.GROQ_API_KEY) {
      console.error('[API/extract] Missing GROQ_API_KEY');
      return NextResponse.json({ error: 'Missing GROQ_API_KEY server configuration.' }, { status: 500 });
    }

    const body = await req.json();
    const { downloadUrl, dataUrl, mimeType } = body;
    console.log('[API/extract] MimeType:', mimeType, '| hasDownloadUrl:', !!downloadUrl, '| hasDataUrl:', !!dataUrl);

    if (!mimeType) {
      return NextResponse.json({ error: 'MIME type is required.' }, { status: 400 });
    }

    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(mimeType)) {
      return NextResponse.json({ error: 'Unsupported file type.' }, { status: 400 });
    }

    let buffer: Buffer;

    if (downloadUrl) {
      // Authenticated flow: Fetch from Firebase Storage
      console.log('[API/extract] Fetching from downloadUrl...', downloadUrl);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const res = await fetch(downloadUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        console.error('[API/extract] Failed to fetch downloadUrl. Status:', res.status);
        return NextResponse.json({ error: 'Failed to download file from storage.' }, { status: 500 });
      }
      const arrayBuffer = await res.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else if (dataUrl) {
      // Demo flow: Base64
      console.log('[API/extract] Processing Base64 dataUrl...');
      const base64Data = dataUrl.split(',')[1];
      if (!base64Data) {
        return NextResponse.json({ error: 'Invalid dataUrl format.' }, { status: 400 });
      }
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    // --- 1. OCR TEXT EXTRACTION BOUNDARY ---
    console.log('[API/extract] Starting OCR...');
    const extractedText = await extractTextFromFileBuffer(buffer, mimeType);

    if (!extractedText || extractedText.trim().length === 0) {
      console.log('[API/extract] OCR returned empty or null. Returning empty extraction state.');
      // Return empty extraction state if OCR fails or text is empty
      return NextResponse.json({
        data: {
          tests: [],
          medicines: [],
          confidence: 'low',
          source: 'OCR unavailable',
        },
      });
    }

    console.log('[API/extract] OCR Success. Extracted length:', extractedText.length);
    console.log('[API/extract] First 100 chars of OCR:', extractedText.substring(0, 100).replace(/\n/g, ' '));

    // --- 2. GROQ AI STRUCTURING LAYER ---
    const systemPrompt = `You are a strict data structuring assistant. Your task is to extract structured clinical data from the provided medical report OCR text.
STRICT EXTRACTION RULES:
- Extract ONLY information visibly present in the report/OCR text.
- Provide a concise 1-2 sentence clinical summary of the key findings in "summary".
- Never invent missing values.
- Never infer a medical condition.
- Never diagnose.
- Never recommend treatment.
- Never prescribe medicine.
- Never convert an absent value into a guessed value.
- Preserve units exactly where possible.
- Preserve reference ranges exactly where available.
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
      "flag": "High/Low/Abnormal or null"
    }
  ],
  "medicines": ["Medicine 1", "Medicine 2"],
  "confidence": "high" | "medium" | "low"
}`;

    let aiResult: any = null;

    try {
      console.log('[API/extract] Starting Groq request...');
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract the following OCR text:\n\n${extractedText}` }
        ],
        model: 'groq/compound',
        response_format: { type: 'json_object' },
        temperature: 0,
      });

      console.log('[API/extract] Groq request completed. Status/Finish Reason:', completion.choices[0]?.finish_reason);

      const aiResultStr = completion.choices[0]?.message?.content;
      if (aiResultStr) {
        // Safely extract JSON in case the model wraps it in markdown
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
        aiResult.source = 'Groq-assisted extraction';
      }
    } catch (aiErr: any) {
      console.warn('[API/extract] Groq AI parsing failed or rate-limited, running regex fallback on OCR text:', aiErr?.message);
    }

    // Fallback: If AI structuring was unavailable or produced no tests, attempt regex extraction on OCR text
    if (!aiResult || (!aiResult.tests?.length && !aiResult.medicines?.length)) {
      const fallbackTests: Array<{ name: string; value: string; unit: string; referenceRange: string; flag: string | null }> = [];
      const lines = extractedText.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        const testMatch = trimmed.match(/^([A-Za-z0-9\s\-_/]+)[:\-]\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%μuLmgdLkg]+)?(?:\s*\((.*?)\))?/);
        if (testMatch && testMatch[1].length < 35) {
          fallbackTests.push({
            name: testMatch[1].trim(),
            value: testMatch[2].trim(),
            unit: testMatch[3]?.trim() || '',
            referenceRange: testMatch[4]?.trim() || '',
            flag: null
          });
        }
      }

      aiResult = {
        reportDate: aiResult?.reportDate || null,
        summary: fallbackTests.length > 0 
          ? `Extracted ${fallbackTests.length} test parameter(s) from document: ${fallbackTests.map(t => `${t.name}: ${t.value} ${t.unit}`).join(', ')}`
          : 'Report uploaded and OCR parsed successfully.',
        tests: fallbackTests,
        medicines: [],
        confidence: fallbackTests.length > 0 ? 'medium' : 'low',
        source: 'OCR-assisted extraction'
      };
    }

    if (!aiResult.summary) {
      if (aiResult.tests && aiResult.tests.length > 0) {
        aiResult.summary = `Extracted ${aiResult.tests.length} laboratory test(s): ${aiResult.tests.map((t: any) => `${t.name} (${t.value} ${t.unit || ''})`).join(', ')}.`;
      } else {
        aiResult.summary = 'Medical document archived with verified OCR capture.';
      }
    }

    aiResult.rawText = extractedText;

    console.log('[API/extract] Final Extraction Result:', { testsCount: aiResult.tests?.length, hasSummary: !!aiResult.summary });
    return NextResponse.json({ data: aiResult });

  } catch (error: any) {
    console.error('[API/extract] Extraction API Error CATCH BLOCK:', error.message || error);
    if (error.stack) console.error(error.stack);
    
    // Write the exact error to a file for debugging
    try {
      require('fs').writeFileSync('scratch/last-api-error.txt', error.stack || error.message || JSON.stringify(error));
    } catch (e) {}

    // Handle Rate Limit gracefully
    if (error?.status === 429) {
      return NextResponse.json({
        error: 'AI Provider Rate Limit exceeded. Please try again later.',
        data: {
          tests: [],
          medicines: [],
          confidence: 'low',
          source: 'Rate limited',
        }
      }, { status: 429 });
    }

    // Handle API errors explicitly
    if (error?.status) {
      return NextResponse.json({ 
        error: `AI Service Error (${error.status}): ${error.message || 'Unknown error'}` 
      }, { status: 500 });
    }

    return NextResponse.json({ error: 'Internal server error during extraction.' }, { status: 500 });
  }
}
