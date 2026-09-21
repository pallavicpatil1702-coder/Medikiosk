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

    const targetLang = sessionData.language || sessionData.patient?.language || 'en';
    const langNames: Record<string, string> = {
      en: 'English',
      hi: 'Hindi',
      mr: 'Marathi',
      bn: 'Bengali',
      te: 'Telugu',
      ta: 'Tamil',
      gu: 'Gujarati',
      kn: 'Kannada',
      ml: 'Malayalam'
    };
    const targetLangName = langNames[targetLang] || 'English';

    // Build the payload for the LLM
    const payloadForAI = {
      targetLanguage: targetLangName,
      languageCode: targetLang,
      chiefComplaint: sessionData.chiefComplaint ? (normalizePhraseToEnglish(sessionData.chiefComplaint) || sessionData.chiefComplaint) : 'Not reported',
      originalChiefComplaint: sessionData.originalChiefComplaint || sessionData.chiefComplaint || 'Not reported',
      answers: (sessionData.answers || []).map(a => `${getEnglishQuestionText(a.questionId) || a.questionText || a.questionId}: ${a.answer} (Normalized: ${a.normalizedEnglishText || a.answer})`),
      knownFacts: (sessionData.knownFacts || []).map(f => `${getEnglishQuestionText(f.questionId) || f.questionId}: ${f.answer}`),
      bodyLocations: (sessionData.bodyLocations || []).map(l => `${l.name} (${l.view} ${l.side || ''})`),
      redFlags: (sessionData.redFlags || []).map(r => `${r.type}: ${r.description}`),
      extractedData: sessionData.extractedData || 'None',
    };

    console.log(`[API/PhysicianSummary] Generating summary for session ${sessionId} in ${targetLangName}...`);

    const prompt = `You are an expert clinical AI analyzing patient intake data.
The patient chose ${targetLangName} (${targetLang}) as their consultation language.

YOUR TASKS:
1. "patientSummary": Generate a clear, compassionate, and structured summary of the patient's condition WRITTEN ENTIRELY IN ${targetLangName}.
   - If Hindi, use natural, clean Hindi in Devanagari script.
   - If Marathi, use natural, clean Marathi in Devanagari script.
   - If English, use natural English.
   - Summarize the patient's chief complaint, duration, affected areas, and answers clearly for the patient to read.

2. "informationSentToDoctor": A patient-generated summary of the information transmitted to the healthcare professional, WRITTEN IN ${targetLangName}.
   - If Hindi, write in Hindi in Devanagari script.
   - If Marathi, write in Marathi in Devanagari script.
   - If English, write in English.

3. "clinicalHandoff": Convert the intake data into a concise, highly structured, strictly English clinical handoff summary formatted as bullet points for the attending physician.
   - MUST be in English for clinical safety.
   - Synthesize the intake into a scannable bulleted list communicating facts in 5-10 seconds.
   - Format:
     • Patient: [age/gender if available]
     • Chief Complaint: [complaint in English]
     • Duration / Onset: [information]
     • Affected Area: [Body Map location if available]
     • Key Symptoms: [important positive findings]
     • Relevant Negative Findings: [explicitly denied symptoms only]
     • Relevant History: [reported information]
     • Medications: [reported/extracted medicines]
     • Reports / Investigations: [actual OCR/report info]
     • Red Flags: [deterministic red flags]
     • Missing / Unknown: [clinically relevant missing info]

RULES:
1. "patientSummary" and "informationSentToDoctor" MUST BE IN ${targetLangName} (${targetLang}). Do NOT return them in English if ${targetLangName} is not English!
2. "clinicalHandoff" MUST BE IN English.
3. Do NOT invent diagnoses or prescriptions. Use only facts actually provided.
4. Output MUST be a valid JSON object matching the exact format below.

INPUT DATA:
${JSON.stringify(payloadForAI, null, 2)}

OUTPUT JSON FORMAT REQUIRED:
{
  "clinicalHandoff": "• Patient: ...\\n• Chief Complaint: ...",
  "patientSummary": "• ... [written in ${targetLangName}]",
  "informationSentToDoctor": "• ... [written in ${targetLangName}]"
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
    structuredSummary.language = targetLang;

    // Save to Firestore
    await sessionRef.update({
      structuredPhysicianSummary: structuredSummary,
      patientSummary: structuredSummary.patientSummary || structuredSummary.clinicalHandoff,
      informationSentToDoctor: structuredSummary.informationSentToDoctor || structuredSummary.patientSummary,
      language: targetLang,
      physicianSummaryStatus: 'generated'
    });

    console.log(`[API/PhysicianSummary] Successfully generated summary for session ${sessionId} in ${targetLangName}`);

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
