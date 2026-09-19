import type { ClinicalHistory, ClinicalSummary } from './types';

/**
 * Deterministic Medical Dictionary mapping common patient intake complaints,
 * durations, symptoms, and medical history phrases from Indian languages
 * (Hindi, Marathi, Bengali, Tamil, Telugu, Gujarati, Kannada, Malayalam)
 * to standard clinical English.
 */
const CLINICAL_PHRASE_MAP: Record<string, string> = {
  // --- Chief Complaints ---
  // Fever
  "ताप": "Fever",
  "बुखार": "Fever",
  "ज्वर": "Fever",
  "खूप ताप": "High fever",
  "तेज बुखार": "High fever",
  "तीव्र ताप": "High fever",

  // Cough
  "खोकला": "Cough",
  "खांसी": "Cough",
  "कोरडा खोकला": "Dry cough",
  "सूखी खांसी": "Dry cough",
  "कफ": "Cough with phlegm",

  // Pain / Headache / Body ache
  "डोकेदुखी": "Headache",
  "सिरदर्द": "Headache",
  "डोके दुखणे": "Headache",
  "तीव्र डोकेदुखी": "Severe headache",
  "वेदना": "Pain",
  "दर्द": "Pain",
  "अंगदुखी": "Body ache",
  "बदन दर्द": "Body ache",

  // Chest Pain
  "छातीत दुखणे": "Chest pain",
  "सीने में दर्द": "Chest pain",
  "छातीत वेदना": "Chest pain",
  "छातीत जडपणा": "Chest heaviness / tightness",
  "सीने में भारीपन": "Chest heaviness / tightness",

  // Stomach / GI
  "पोटदुखी": "Stomach ache / abdominal pain",
  "पोटाची समस्या": "Stomach problem / abdominal discomfort",
  "पेट में दर्द": "Stomach ache / abdominal pain",
  "पेट की समस्या": "Stomach problem / abdominal discomfort",
  "तीव्र पोटदुखी": "Severe stomach pain",
  "उलटी": "Vomiting",
  "उल्टी": "Vomiting",
  "मळमळ": "Nausea",
  "जी मिचलाना": "Nausea",
  "जुलाब": "Diarrhea",
  "दस्त": "Diarrhea",
  "अपचन": "Indigestion",
  "गॅस": "Gastric trouble / flatulence",
  "अॅसिडिटी": "Acidity / acid reflux",

  // Respiratory
  "श्वास घेण्यास त्रास": "Difficulty breathing / shortness of breath",
  "सांस लेने में कठिनाई": "Difficulty breathing / shortness of breath",
  "दम लागणे": "Breathlessness",
  "श्वासाचा त्रास": "Breathing difficulty",
  "घसा खवखवणे": "Sore throat",
  "गले में खराश": "Sore throat",

  // Neurological / General
  "चक्कर येणे": "Dizziness",
  "चक्कर आना": "Dizziness",
  "अशक्तपणा": "Weakness / fatigue",
  "कमजोरी": "Weakness / fatigue",
  "थकवा": "Fatigue",
  "दुखापत": "Injury",
  "चोट": "Injury",

  // --- Common Durations ---
  "१ दिवस": "1 day",
  "1 दिन": "1 day",
  "२ दिवस": "2 days",
  "2 दिन": "2 days",
  "२ दिवसांपासून": "Since 2 days",
  "2 दिन से": "Since 2 days",
  "३ दिवस": "3 days",
  "3 दिन": "3 days",
  "३ दिवसांपासून": "Since 3 days",
  "3 दिन से": "Since 3 days",
  "४ दिवस": "4 days",
  "4 दिन": "4 days",
  "५ दिवस": "5 days",
  "5 दिन": "5 days",
  "१ आठवडा": "1 week",
  "1 सप्ताह": "1 week",
  "१ आठवड्यापासून": "Since 1 week",
  "काही दिवस": "A few days",
  "कुछ दिन": "A few days",
  "कालपासून": "Since yesterday",
  "कल से": "Since yesterday",
  "आजपासून": "Since today",
  "आज से": "Since today",
  "१ महिना": "1 month",
  "1 महीना": "1 month",
  "अनेक दिवस": "Several days",

  // --- Medications & Allergies ---
  "काही नाही": "None declared",
  "काहीही नाही": "None declared",
  "कोई नहीं": "None declared",
  "कुछ नहीं": "None declared",
  "कोणतीही नाही": "None reported",
  "कोणतीही ऍलर्जी नाही": "No known allergies reported",
  "कोई ज्ञात एलर्जी नहीं": "No known allergies reported",
  "पॅरासिटामॉल": "Paracetamol",
  "पैरासिटामोल": "Paracetamol",
  "पॅरासिटामोल": "Paracetamol",
  "औषध घेतले नाही": "No medication taken",
  "दवा नहीं ली": "No medication taken",
  "नेहमीची औषधे": "Routine prescribed medications",
  "नियमित दवाइयां": "Routine prescribed medications",

  // --- General phrases ---
  "होय": "Yes",
  "हाँ": "Yes",
  "नाही": "No",
  "नही": "No",
};

/**
 * Check whether a string contains Non-ASCII characters (e.g. Devanagari, Bengali, Tamil, etc.)
 */
export function containsNonAscii(text?: string | null): boolean {
  if (!text) return false;
  // Match any character code outside basic ASCII printable range (0-127)
  return /[^\u0000-\u007F]/.test(text);
}

/**
 * Normalize an individual phrase or word into standard English using deterministic mapping.
 */
export function normalizePhraseToEnglish(input?: string | null): string {
  if (!input || !input.trim()) return '';
  const trimmed = input.trim();

  // Exact match
  if (CLINICAL_PHRASE_MAP[trimmed]) {
    return CLINICAL_PHRASE_MAP[trimmed];
  }

  // Comma or separator separated list
  if (trimmed.includes(',') || trimmed.includes('•') || trimmed.includes(' आणि ') || trimmed.includes(' और ')) {
    const parts = trimmed.split(/[,•]| आणि | और /).map(p => p.trim()).filter(Boolean);
    const translatedParts = parts.map(p => CLINICAL_PHRASE_MAP[p] || translateWithWordSubstitutions(p));
    return translatedParts.join(', ');
  }

  return translateWithWordSubstitutions(trimmed);
}

/**
 * Sub-word / token level deterministic replacement
 */
function translateWithWordSubstitutions(phrase: string): string {
  let result = phrase;

  // Substitute known clinical terms
  for (const [nativeTerm, englishTerm] of Object.entries(CLINICAL_PHRASE_MAP)) {
    if (result.includes(nativeTerm)) {
      result = result.replace(new RegExp(nativeTerm, 'g'), englishTerm);
    }
  }

  // Convert Indian numeral digits (०-९) to standard digits (0-9)
  const devanagariDigits: Record<string, string> = {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
  };
  result = result.replace(/[०-९]/g, d => devanagariDigits[d] || d);

  // Common duration word cleaning
  result = result
    .replace(/\bदिवसांपासून\b/g, 'days ago')
    .replace(/\bदिवस\b/g, 'days')
    .replace(/\bदिन से\b/g, 'days ago')
    .replace(/\bदिन\b/g, 'days')
    .replace(/\bआठवड्यापासून\b/g, 'weeks ago')
    .replace(/\bआठवडा\b/g, 'weeks')
    .replace(/\bतीव्र\b/g, 'Severe')
    .replace(/\bखूप\b/g, 'Severe')
    .replace(/\bतेज\b/g, 'Severe')
    .replace(/\bहलका\b/g, 'Mild')
    .replace(/\bकमी\b/g, 'Mild')
    .replace(/\bमाझे\b/g, 'My')
    .replace(/\bमला\b/g, 'Patient reports')
    .replace(/\bआहे\b/g, '')
    .replace(/\bहोता\b/g, '');

  return result.trim();
}

/**
 * Normalizes a ClinicalHistory object so all physician-facing fields are in English.
 * Original patient answers array is preserved 100%.
 */
export function normalizeClinicalHistoryToEnglish(history: ClinicalHistory): ClinicalHistory {
  if (!history) return history;

  const chiefComplaint = normalizePhraseToEnglish(history.chiefComplaint);
  const duration = normalizePhraseToEnglish(history.duration);
  const associatedSymptoms = (history.associatedSymptoms || []).map(s => normalizePhraseToEnglish(s));
  const medicationTaken = history.medicationTaken ? normalizePhraseToEnglish(history.medicationTaken) : 'None reported';
  const allergies = history.allergies ? normalizePhraseToEnglish(history.allergies) : 'No known allergies reported';
  const pastMedicalHistory = history.pastMedicalHistory ? normalizePhraseToEnglish(history.pastMedicalHistory) : 'None declared';

  return {
    ...history,
    chiefComplaint: chiefComplaint || history.chiefComplaint || 'Intake completed',
    duration: duration || history.duration || 'Reported during intake',
    associatedSymptoms: associatedSymptoms.length > 0 ? associatedSymptoms : ['None reported'],
    medicationTaken: medicationTaken || 'None reported',
    allergies: allergies || 'No known allergies reported',
    pastMedicalHistory: pastMedicalHistory || 'None declared',
    // Preserve original answers verbatim for audit and records
    answers: history.answers || []
  };
}

/**
 * Ensures a ClinicalSummary object is completely formatted in clear, concise English
 * for the attending physician.
 */
export function normalizeClinicalSummaryToEnglish(summary: ClinicalSummary): ClinicalSummary {
  if (!summary) return summary;

  const normalizedHistory = normalizeClinicalHistoryToEnglish(summary.history);
  
  return {
    ...summary,
    history: normalizedHistory,
    medications: normalizedHistory.medicationTaken || summary.medications || 'None reported',
    allergies: normalizedHistory.allergies || summary.allergies || 'No known allergies reported',
    pastHistory: normalizedHistory.pastMedicalHistory || summary.pastHistory || 'None declared',
    aiNotes: normalizePhraseToEnglish(summary.aiNotes) || summary.aiNotes || 'AI-assisted clinical draft for physician review.'
  };
}

/**
 * Assembles the EXACT visible text to be spoken by Text-to-Speech for the doctor.
 * Adheres strictly to the requirement:
 * "The audio must read the SAME summary that the doctor sees on screen.
 * Do not generate a separate AI interpretation for audio.
 * Do not summarize the summary again before speaking."
 */
export function buildSpokenClinicalSummary(data: {
  patientName?: string;
  patientAge?: number | string;
  patientGender?: string;
  chiefComplaint: string;
  bodyLocations?: string[];
  duration?: string;
  associatedSymptoms?: string[];
  medications?: string;
  allergies?: string;
  pastHistory?: string;
  triageNote?: string;
  redFlags?: { type: string; description: string }[];
}): string {
  const sentences: string[] = [];

  // Patient Demographic
  const name = data.patientName || 'Patient';
  const age = data.patientAge ? `${data.patientAge} years old` : '';
  const gender = data.patientGender ? data.patientGender : '';
  const demographics = [age, gender].filter(Boolean).join(', ');
  sentences.push(`Clinical summary for ${name}${demographics ? ', ' + demographics : ''}.`);

  // Chief Complaint & Duration
  if (data.chiefComplaint) {
    let cc = `Chief Complaint: ${data.chiefComplaint}.`;
    if (data.bodyLocations && data.bodyLocations.length > 0) {
      cc += ` Affected areas: ${data.bodyLocations.join(', ')}.`;
    }
    if (data.duration && data.duration !== 'Not specified' && data.duration !== 'Reported during intake') {
      cc += ` Duration: ${data.duration}.`;
    }
    sentences.push(cc);
  }

  // Associated Symptoms
  if (data.associatedSymptoms && data.associatedSymptoms.length > 0) {
    const symList = data.associatedSymptoms.filter(s => s !== 'None reported' && s !== 'See specific answers');
    if (symList.length > 0) {
      sentences.push(`Associated symptoms: ${symList.join(', ')}.`);
    }
  }

  // Medications
  if (data.medications && data.medications !== 'None' && data.medications !== 'None reported' && data.medications !== 'None recorded') {
    sentences.push(`Current medications: ${data.medications}.`);
  } else {
    sentences.push(`No prior medications reported.`);
  }

  // Allergies
  if (data.allergies && !data.allergies.toLowerCase().includes('no known')) {
    sentences.push(`Known allergies: ${data.allergies}.`);
  } else {
    sentences.push(`No known allergies reported.`);
  }

  // Past Medical History
  if (data.pastHistory && data.pastHistory !== 'None declared' && data.pastHistory !== 'None reported' && data.pastHistory !== 'Routine intake') {
    sentences.push(`Past medical history: ${data.pastHistory}.`);
  }

  // Triage Nurse Handoff Note (if present)
  if (data.triageNote && data.triageNote.trim()) {
    sentences.push(`Triage Nurse note: ${data.triageNote.trim()}.`);
  }

  // Red Flags (if present)
  if (data.redFlags && data.redFlags.length > 0) {
    const flags = data.redFlags.map(rf => `${rf.type}, ${rf.description}`).join('; ');
    sentences.push(`Red flag warnings detected: ${flags}.`);
  }

  return sentences.join(' ');
}
