import type { PatientSession, AyurvedaReference } from '../types';
import { Groq } from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// The deterministic mapping rules
const AYURVEDA_RULES = [
  {
    term: "Amlapitta",
    termHindi: "अम्लपित्त",
    locations: ["upper abdomen", "epigastric", "chest", "stomach"],
    requiredSymptoms: ["burning", "sour", "acidic", "regurgitation", "acidity"],
    minSymptomsRequired: 1, // At least one of the above symptoms
    preventIfRedFlag: true
  },
  {
    term: "Sandhivata",
    termHindi: "संधिवात",
    locations: ["joints", "knee", "shoulder", "elbow", "wrist", "ankle"],
    requiredSymptoms: ["pain", "stiffness", "swelling", "crepitus"],
    minSymptomsRequired: 1,
    preventIfRedFlag: false
  },
  {
    term: "Jwara",
    termHindi: "ज्वर",
    locations: ["general body", "forehead", "head"],
    requiredSymptoms: ["fever", "temperature", "chills", "hot", "feverish"],
    minSymptomsRequired: 1,
    preventIfRedFlag: false
  },
  {
    term: "Kasa",
    termHindi: "कास",
    locations: ["chest", "throat"],
    requiredSymptoms: ["cough", "phlegm", "sputum", "khasi", "coughing"],
    minSymptomsRequired: 1,
    preventIfRedFlag: false
  },
  {
    term: "Vibandha",
    termHindi: "विबन्ध",
    locations: ["abdomen", "lower abdomen", "stomach", "bowel"],
    requiredSymptoms: ["constipation", "hard stool", "difficulty passing stool", "no motion"],
    minSymptomsRequired: 1,
    preventIfRedFlag: false
  },
  {
    term: "Daurbalya",
    termHindi: "दौर्बल्य",
    locations: ["general body"],
    requiredSymptoms: ["weakness", "fatigue", "tiredness", "exhaustion", "low energy"],
    minSymptomsRequired: 1,
    preventIfRedFlag: false
  }
];

export async function generateAyurvedaReferences(session: PatientSession): Promise<AyurvedaReference[]> {
  const references: AyurvedaReference[] = [];
  
  const hasUrgentRedFlag = session.redFlags && session.redFlags.some(rf => rf.severity === 'high');
  
  // Collect text context for Groq extraction
  const selectedLocations = session.bodyLocations?.map(l => l.name.toLowerCase()) || [];
  
  const textContextParts = [];
  if (session.chiefComplaint) textContextParts.push(`Chief Complaint: ${session.chiefComplaint}`);
  
  session.answers?.forEach(ans => {
    if (ans.answer && ans.answer.toLowerCase() !== 'unknown' && ans.answer.toLowerCase() !== 'not sure') {
      textContextParts.push(`Q: ${ans.questionText || ans.questionId} A: ${ans.answer}`);
    }
  });
  
  session.knownFacts?.forEach(ans => {
    textContextParts.push(`Reported Fact: ${ans.questionId} = ${ans.answer}`);
  });
  
  const textContext = textContextParts.join('\n');
  
  if (!textContext.trim() && selectedLocations.length === 0) {
    return references; // Nothing to map
  }

  // Use Groq for Language Normalization & Symptom Extraction ONLY
  const systemPrompt = `You are a clinical symptom extractor. 
Your task is to analyze the patient's reported information and extract explicitly reported symptoms and their affected body locations. 
Translate any multilingual text (Hindi, Marathi, etc.) into normalized English clinical terms.
Do NOT invent symptoms. Do NOT convert "Unknown" or "Not sure" into "No".
Do NOT output a diagnosis.

Output JSON format exactly:
{
  "extractedComplaints": [
    {
      "location": "string (e.g. chest, upper abdomen, knee, general body)",
      "symptoms": ["string (e.g. burning, pain, fever)"]
    }
  ]
}`;

  let extractedData: any = { extractedComplaints: [] };

  try {
    const response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Body Map Locations: ${selectedLocations.join(', ')}\n\nPatient Data:\n${textContext}` }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content || '{}';
    extractedData = JSON.parse(content);
  } catch (err) {
    console.error("Groq symptom extraction failed:", err);
    // If AI fails, we fallback to extremely basic string matching
    extractedData.extractedComplaints = [{
      location: selectedLocations.join(', '),
      symptoms: textContext.toLowerCase().split(/\W+/)
    }];
  }

  const complaints = extractedData.extractedComplaints || [];
  
  // Deterministic Mapping Rule Engine
  for (const rule of AYURVEDA_RULES) {
    // If rule says prevent on red flag, skip it completely if an urgent red flag exists.
    if (rule.preventIfRedFlag && hasUrgentRedFlag) {
      continue;
    }

    let isMatch = false;
    let matchedBasis: string[] = [];

    for (const complaint of complaints) {
      const complaintLoc = (complaint.location || '').toLowerCase();
      const complaintSyms = complaint.symptoms || [];

      // Check if location matches or if the rule applies to general body
      const locationMatch = rule.locations.some(loc => 
        complaintLoc.includes(loc) || selectedLocations.some(sl => sl.includes(loc))
      ) || rule.locations.includes("general body");

      if (locationMatch) {
        // Check if any required symptom is in the extracted symptoms
        const matchingSymptoms = complaintSyms.filter((sym: string) => 
          rule.requiredSymptoms.some(req => sym.toLowerCase().includes(req))
        );

        if (matchingSymptoms.length >= rule.minSymptomsRequired) {
          isMatch = true;
          matchedBasis.push(...matchingSymptoms);
        }
      }
    }

    // Also do a fallback check across all extracted text if symptoms are mentioned generally
    if (!isMatch) {
      const allSymptoms = complaints.flatMap((c: any) => c.symptoms || []);
      const matchingSymptoms = allSymptoms.filter((sym: string) => 
        rule.requiredSymptoms.some(req => sym.toLowerCase().includes(req))
      );
      
      const hasLocationMatch = selectedLocations.some(sl => rule.locations.some(rl => sl.includes(rl))) || rule.locations.includes("general body");
      
      if (matchingSymptoms.length >= rule.minSymptomsRequired && hasLocationMatch) {
         isMatch = true;
         matchedBasis.push(...matchingSymptoms);
      }
    }

    if (isMatch) {
      // Deduplicate matched basis
      matchedBasis = [...new Set(matchedBasis)];
      
      references.push({
        term: rule.term,
        termHindi: rule.termHindi,
        basis: matchedBasis,
        confidence: 'reference',
        status: 'unconfirmed'
      });
    }
  }

  return references;
}
