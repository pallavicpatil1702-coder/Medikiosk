import Groq from 'groq-sdk';
import 'dotenv/config';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function runTest() {
  const payloadForAI = {
    chiefComplaint: 'तीव्र ताप आणि डोकेदुखी (Fever and headache)',
    answers: [
      'Have you taken any medicine?: pata nahi',
      'Does it hurt when you breathe?: Yes',
      'Any past medical history?: No',
      'Describe the pain: mala don divasapasun chhatit traas ahe (chest pain)',
      'Fever temperature?: 103F'
    ],
    knownFacts: [
      'fever: 103F'
    ],
    bodyLocations: [
      'Chest (front midline)',
      'Head (front bilateral)'
    ],
    redFlags: [
      'High Fever Alert: Temperature over 101F',
      'Chest Pain Alert: Patient reported chest pain'
    ],
    extractedData: 'Lab Report: Hemoglobin 12g/dL, WBC 15000'
  };

  const prompt = `You are an expert physician reviewing patient intake data. Your job is to convert the raw patient intake data (often in regional Indian languages like Hindi or Marathi) into a highly structured, strictly English clinical summary.

RULES:
1. MUST ALWAYS be 100% English. Translate any Hindi/Marathi/etc. into accurate English medical meaning.
2. Example: "pata nahi" -> "Unknown / Not reported", NOT "No".
3. Do NOT invent, infer, or hallucinate diagnoses, medicines, durations, or symptoms. If it's missing or unanswered, explicitly state "Not reported".
4. Output MUST be a valid JSON object matching the exact keys requested.

INPUT DATA:
${JSON.stringify(payloadForAI, null, 2)}

OUTPUT JSON FORMAT REQUIRED:
{
  "chiefComplaint": "string",
  "durationOnset": "string",
  "affectedArea": "string",
  "associatedSymptoms": ["string", "string"],
  "relevantHistory": "string",
  "patientReportedAnswers": [{"question": "string", "answer": "string (translated to English)"}],
  "reportsInvestigations": "string",
  "medicines": "string",
  "redFlags": ["string"],
  "missingUnknownInformation": ["string"]
}
`;

  console.log('Sending request to Groq...');
  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama3-70b-8192',
    temperature: 0.1,
    response_format: { type: 'json_object' }
  });

  console.log(completion.choices[0]?.message?.content);
}

runTest();
