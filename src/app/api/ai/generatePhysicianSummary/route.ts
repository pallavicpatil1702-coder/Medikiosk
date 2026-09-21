import { NextResponse } from 'next/server';
import { getApps, initializeApp, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import Groq from 'groq-sdk';
import type { PatientSession, StructuredPhysicianSummary } from '@/lib/types';
import { normalizePhraseToEnglish, getEnglishQuestionText } from '@/lib/clinicalSummaryTranslator';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'missing',
});

function getAdminFirestore() {
  if (getApps().length > 0) {
    return getFirestore(getApps()[0]);
  }
  const app = initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'medikiosk-df39e',
  });
  return getFirestore(app);
}

export async function POST(req: Request) {
  let sessionId: string | null = null;
  
  try {
    const body = await req.json();
    sessionId = body.sessionId;

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'missing') {
      console.error('[API/PhysicianSummary] Missing GROQ_API_KEY');
      return NextResponse.json({ error: 'Missing GROQ_API_KEY' }, { status: 500 });
    }

    const db = getAdminFirestore();
    const sessionRef = db.collection('patientSessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sessionData = sessionDoc.data() as PatientSession;

    // Do not regenerate if already generated
    if (sessionData.physicianSummaryStatus === 'generated' && sessionData.structuredPhysicianSummary) {
      return NextResponse.json({ summary: sessionData.structuredPhysicianSummary });
    }

    // Build the payload for the LLM with English question lookups and normalized texts
    const payloadForAI = {
      chiefComplaint: sessionData.chiefComplaint ? (normalizePhraseToEnglish(sessionData.chiefComplaint) || sessionData.chiefComplaint) : 'Not reported',
      answers: (sessionData.answers || []).map(a => `${getEnglishQuestionText(a.questionId) || a.questionText || a.questionId}: ${a.normalizedEnglishText || a.answer}`),
      knownFacts: (sessionData.knownFacts || []).map(f => `${getEnglishQuestionText(f.questionId) || f.questionId}: ${f.normalizedEnglishText || f.answer}`),
      bodyLocations: (sessionData.bodyLocations || []).map(l => `${l.name} (${l.view} ${l.side || ''})`),
      redFlags: (sessionData.redFlags || []).map(r => `${r.type}: ${r.description}`),
      extractedData: sessionData.extractedData || 'None',
    };

    console.log(`[API/PhysicianSummary] Generating summary for session ${sessionId}...`);

    const prompt = `You are an expert physician reviewing patient intake data. Your job is to convert the raw patient intake data (often in regional Indian languages like Hindi or Marathi) into a concise, highly structured, strictly English clinical handoff summary formatted as bullet points.

PURPOSE: INFORMATION COMPRESSION
The goal is to synthesize the entire intake into a scannable bulleted list that communicates the important facts in 5-10 seconds.

RULES:
1. MUST ALWAYS be 100% English. Translate any Hindi/Marathi/etc. into accurate English medical meaning.
2. Example: "pata nahi", "mahiti nahi", "don't know" -> "Unknown" or "Not reported". NEVER convert to "No". "No" must only be used when explicitly denied.
3. Do NOT generate a paragraph. Do NOT create a question-answer transcript. Keep bullets short and clinically meaningful.
4. Combine related answers into one bullet. Do NOT repeat the same information in multiple bullets.
5. Do NOT invent information. Do NOT diagnose or prescribe. Do NOT infer disease, severity, cause, treatment, prognosis, or missing symptoms.
6. Use only facts actually provided. Use Body Map locations only from bodyLocations. Use OCR only from extractedData. Use red flags only from the provided deterministic redFlags list.
7. Omit empty/unimportant sections rather than filling the screen with "Not reported". Use "Not reported" or "Unknown" only when clinically relevant.
8. Output MUST be a valid JSON object matching the exact key requested. Do NOT output markdown formatting outside the JSON object.

INPUT DATA:
${JSON.stringify(payloadForAI, null, 2)}

OUTPUT JSON FORMAT REQUIRED:
{
  "clinicalHandoff": "• Patient: [age/gender if actually available]\\n• Chief Complaint: [actual complaint]\\n• Duration / Onset: [actual information]\\n• Affected Area: [actual Body Map location, if available]\\n• Key Symptoms: [important positive findings]\\n• Relevant Negative Findings: [important explicitly denied symptoms only]\\n• Relevant History: [only reported information]\\n• Medications: [only reported/extracted information]\\n• Reports / Investigations: [only actual OCR/report information]\\n• Red Flags: [only deterministic red flags]\\n• Missing / Unknown: [only clinically relevant missing information]"
}
`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.1-8b-instant', // Use a smart model for reliable JSON & translation
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const aiContent = completion.choices[0]?.message?.content;
    if (!aiContent) {
      throw new Error('Groq returned empty content');
    }

    const structuredSummary: StructuredPhysicianSummary = JSON.parse(aiContent);

    // Save to Firestore
    await sessionRef.update({
      structuredPhysicianSummary: structuredSummary,
      physicianSummaryStatus: 'generated'
    });

    console.log(`[API/PhysicianSummary] Successfully generated summary for session ${sessionId}`);

    return NextResponse.json({ summary: structuredSummary });

  } catch (error: any) {
    console.error('[API/PhysicianSummary] Error:', error);
    
    if (sessionId) {
      try {
        const db = getAdminFirestore();
        await db.collection('patientSessions').doc(sessionId).update({
          physicianSummaryStatus: 'failed',
          updatedAt: new Date().toISOString()
        });
      } catch (updateErr) {
        console.error('[API/PhysicianSummary] Failed to update error status:', updateErr);
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to generate summary', details: error.message },
      { status: 500 }
    );
  }
}
