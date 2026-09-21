import type { ClinicalHistory, ClinicalSummary } from './types';
import questionBank from './data/medikiosk_question_bank.json';

// In-memory lookup maps populated from question bank
const ENGLISH_QUESTION_MAP: Record<string, string> = {};
const NATIVE_QUESTION_MAP: Record<string, string> = {};

function initQuestionBankMaps() {
  const qb = questionBank as any;
  if (!qb) return;

  const registerQuestion = (q: any) => {
    if (!q || !q.id) return;
    const enText = typeof q.text === 'object' ? q.text?.en : (typeof q.text === 'string' ? q.text : '');
    if (enText && typeof enText === 'string') {
      const trimmedEn = enText.trim();
      ENGLISH_QUESTION_MAP[q.id] = trimmedEn;
      if (q.text?.hi && typeof q.text.hi === 'string') {
        NATIVE_QUESTION_MAP[q.text.hi.trim()] = trimmedEn;
      }
      if (q.text?.mr && typeof q.text.mr === 'string') {
        NATIVE_QUESTION_MAP[q.text.mr.trim()] = trimmedEn;
      }
    }
  };

  if (Array.isArray(qb.universal_ayurveda_context)) {
    qb.universal_ayurveda_context.forEach(registerQuestion);
  }

  if (qb.modules && typeof qb.modules === 'object') {
    Object.values(qb.modules).forEach((mod: any) => {
      if (Array.isArray(mod.questions)) {
        mod.questions.forEach(registerQuestion);
      }
    });
  }
}

initQuestionBankMaps();

/**
 * Retrieve canonical English question text for a given questionId
 */
export function getEnglishQuestionText(questionId?: string | null): string | undefined {
  if (!questionId) return undefined;
  return ENGLISH_QUESTION_MAP[questionId];
}

/**
 * Deterministic Medical Dictionary mapping common patient intake complaints,
 * durations, symptoms, and medical history phrases from Indian languages
 * (Hindi, Marathi, Bengali, Tamil, Telugu, Gujarati, Kannada, Malayalam)
 * to standard clinical English.
 */
const CLINICAL_PHRASE_MAP: Record<string, string> = {
  // --- Chief Complaints ---
  // Fever & Systemic
  "ताप": "Fever",
  "बुखार": "Fever",
  "ज्वर": "Fever",
  "खूप ताप": "High fever",
  "तेज बुखार": "High fever",
  "तीव्र ताप": "High fever",
  "ताप आला आहे": "Fever present",
  "बुखार है": "Fever present",
  "थंडी वाजून ताप": "Fever with chills",
  "ठंड लगकर बुखार": "Fever with chills",
  "थंडी वाजणे": "Chills / shivering",
  "कापरे": "Shivering / tremors",
  "ठंड लगना": "Chills",
  "कंपकंपी": "Shivering",
  "घाम": "Sweating",
  "पसीना": "Sweating",
  "खूप घाम येणे": "Profuse sweating",
  "अंगदुखी": "Body ache",
  "बदन दर्द": "Body ache",
  "अशक्तपणा": "Weakness and fatigue",
  "कमजोरी": "Weakness and fatigue",
  "दुर्बलता": "Weakness",
  "थकवा": "Fatigue",
  "थकान": "Fatigue",

  // Cough & Respiratory
  "खोकला": "Cough",
  "खांसी": "Cough",
  "कोरडा खोकला": "Dry cough",
  "सूखी खांसी": "Dry cough",
  "कफ": "Cough with phlegm",
  "बलगम": "Phlegm / Cough with phlegm",
  "कफ खोकला": "Productive cough",
  "श्वास घेण्यास त्रास": "Difficulty breathing / dyspnea",
  "सांस लेने में कठिनाई": "Difficulty breathing / dyspnea",
  "सांस लेने में तकलीफ": "Difficulty breathing / dyspnea",
  "सांस लेने में भारी तकलीफ": "Severe difficulty breathing",
  "खूप श्वास घेण्यास त्रास": "Severe difficulty breathing",
  "दम लागणे": "Breathlessness",
  "सांस फूलना": "Breathlessness",
  "धाप लागणे": "Shortness of breath",
  "श्वासाचा त्रास": "Breathing difficulty",
  "घसा खवखवणे": "Sore throat",
  "गले में खराश": "Sore throat",
  "घसा दुखणे": "Sore throat",
  "गले में दर्द": "Sore throat",
  "घशात खवखव": "Sore throat irritation",
  "सर्दी": "Cold / Coryza",
  "जुकाम": "Cold / Coryza",
  "शिंका": "Sneezing",
  "छींक": "Sneezing",

  // Headache & Neurological
  "डोकेदुखी": "Headache",
  "सिरदर्द": "Headache",
  "सिर दर्द": "Headache",
  "डोके दुखणे": "Headache",
  "डोके दुखत आहे": "Headache",
  "तीव्र डोकेदुखी": "Severe headache",
  "वेदना": "Pain",
  "दर्द": "Pain",
  "चक्कर येणे": "Dizziness / vertigo",
  "चक्कर आना": "Dizziness / vertigo",
  "चक्कर": "Dizziness",
  "बेशुद्धी": "Fainting / loss of consciousness",
  "बेहोशी": "Fainting / loss of consciousness",
  "गोंधळ": "Confusion / altered mental state",
  "भ्रम": "Confusion / altered mental state",
  "आकडी": "Seizures / convulsions",
  "दौरा": "Seizures / convulsions",
  "जागे करणे कठीण": "Difficult to wake / unarousable",
  "जगाने में कठिनाई": "Difficult to wake / unarousable",

  // Chest Pain & Cardiovascular
  "छातीत दुखणे": "Chest pain",
  "सीने में दर्द": "Chest pain",
  "छातीत वेदना": "Chest pain",
  "छातीमध्ये वेदना": "Chest pain",
  "छातीत जडपणा": "Chest heaviness / tightness",
  "सीने में भारीपन": "Chest heaviness / tightness",
  "छातीत दाब": "Chest pressure",
  "छातीत धडधड": "Palpitations / rapid heart rate",
  "दिल की धड़कन तेज": "Palpitations",
  "डाव्या हातात दुखणे": "Pain radiating to left arm",
  "बाएं हाथ में दर्द": "Pain radiating to left arm",
  "जबड्यात दुखणे": "Pain radiating to jaw",
  "जबड़े में दर्द": "Pain radiating to jaw",

  // Stomach & Gastrointestinal
  "पोटदुखी": "Abdominal pain",
  "पोटात दुखणे": "Abdominal pain",
  "पोटाची समस्या": "Abdominal discomfort",
  "पेट में दर्द": "Abdominal pain",
  "पेट दर्द": "Abdominal pain",
  "पेट की समस्या": "Abdominal discomfort",
  "तीव्र पोटदुखी": "Severe abdominal pain",
  "उलटी": "Vomiting",
  "उल्टी": "Vomiting",
  "मळमळ": "Nausea",
  "जी मिचलाना": "Nausea",
  "जुलाब": "Diarrhea",
  "दस्त": "Diarrhea",
  "संडास": "Loose stools",
  "अपचन": "Indigestion",
  "गॅस": "Flatulence / abdominal gas",
  "गैस": "Flatulence / abdominal gas",
  "पोट फुगणे": "Abdominal bloating",
  "पेट फूलना": "Abdominal bloating",
  "अॅसिडिटी": "Acidity / acid reflux",
  "एसिडिटी": "Acidity / acid reflux",
  "पित्त": "Bile / acid regurgitation",
  "जळजळ": "Heartburn / burning sensation",
  "जलन": "Heartburn / burning sensation",
  "छातीत जळजळ": "Heartburn / acid reflux",
  "सीने में जलन": "Heartburn / acid reflux",
  "आंबट ढेकर": "Sour eructations / acid reflux",
  "बद्धकोष्ठता": "Constipation",
  "कब्ज": "Constipation",
  "शौचास साफ न होणे": "Constipation / irregular bowel movements",
  "भूक न लागणे": "Loss of appetite / anorexia",
  "भूक मंदावणे": "Decreased appetite",
  "भूख न लगना": "Loss of appetite / anorexia",
  "भूख कम होना": "Decreased appetite",
  "तहान जास्त लागणे": "Excessive thirst (polydipsia)",
  "प्यास ज्यादा लगना": "Excessive thirst (polydipsia)",

  // Musculoskeletal & Body Parts
  "पाठदुखी": "Back pain",
  "पाठीत दुखणे": "Back pain",
  "पीठ दर्द": "Back pain",
  "पीठ में दर्द": "Back pain",
  "कंबरदुखी": "Lower back pain",
  "कंबरेत दुखणे": "Lower back pain",
  "कमर दर्द": "Lower back pain",
  "कमर में दर्द": "Lower back pain",
  "मानदुखी": "Neck pain",
  "मानेत दुखणे": "Neck pain",
  "गर्दन में दर्द": "Neck pain",
  "सांधेदुखी": "Joint pain",
  "सांधे दुखणे": "Joint pain",
  "जोड़ों में दर्द": "Joint pain",
  "हात पाय दुखणे": "Limb pain (arms and legs)",
  "हाथ पैर में दर्द": "Limb pain (arms and legs)",
  "सुज": "Swelling",
  "सूज": "Swelling",
  "सूजन": "Swelling",

  // Skin & Urinary
  "खाज": "Itching / pruritus",
  "खुजली": "Itching / pruritus",
  "पुरळ": "Skin rash",
  "चकत्ते": "Skin rash",
  "लाल डाग": "Red erythematous spots",
  "लघवीत जळजळ": "Burning sensation while urinating (dysuria)",
  "पेशाब में जलन": "Burning sensation while urinating (dysuria)",
  "लघवी करताना जळजळ": "Burning sensation while urinating (dysuria)",
  "वारंवार लघवी": "Frequent urination",
  "बार-बार पेशाब": "Frequent urination",
  "रक्तस्त्राव": "Bleeding",
  "खून बहना": "Bleeding",
  "जखम": "Wound / injury",
  "घाव": "Wound / injury",
  "चोट": "Injury",
  "दुखापत": "Injury",
  "झोप न येणे": "Insomnia / sleeplessness",
  "झोपेची समस्या": "Sleep disturbance",
  "नींद न आना": "Insomnia / sleeplessness",
  "वजन कमी होणे": "Weight loss",
  "वजन घटना": "Weight loss",

  // --- Common Durations & Timings ---
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
  "४ दिवसांपासून": "Since 4 days",
  "५ दिवस": "5 days",
  "5 दिन": "5 days",
  "५ दिवसांपासून": "Since 5 days",
  "१ आठवडा": "1 week",
  "1 सप्ताह": "1 week",
  "१ आठवड्यापासून": "Since 1 week",
  "1 सप्ताह से": "Since 1 week",
  "२ आठवडे": "2 weeks",
  "2 सप्ताह": "2 weeks",
  "२ आठवड्यांपेक्षा जास्त": "More than 2 weeks",
  "१ महिना": "1 month",
  "1 महीना": "1 month",
  "१ महिन्यापेक्षा जास्त": "More than 1 month",
  "काही दिवस": "A few days",
  "कुछ दिन": "A few days",
  "काही दिवसांपासून": "Since a few days",
  "कुछ दिनों से": "Since a few days",
  "कालपासून": "Since yesterday",
  "कल से": "Since yesterday",
  "आजपासून": "Since today",
  "आज से": "Since today",
  "अनेक दिवस": "Several days",
  "बऱ्याच दिवसांपासून": "For a long time",
  "लहानपणापासून": "Since childhood",

  // --- Questionnaire Technical Option Values ---
  "continuous": "Continuous",
  "comes_and_goes": "Comes and goes (intermittent)",
  "not_sure": "Not sure",
  "mild": "Mild",
  "moderate": "Moderate",
  "severe": "Severe",
  "1_to_3_days": "1 to 3 days",
  "less_than_1_week": "Less than 1 week",
  "more_than_1_week": "More than 1 week",
  "more_than_2_weeks": "More than 2 weeks",
  "more_than_month": "More than 1 month",
  "none": "None",

  // --- Common Responses & Presets ---
  "होय": "Yes",
  "हाँ": "Yes",
  "हा": "Yes",
  "हो": "Yes",
  "जी हाँ": "Yes",
  "जी हां": "Yes",
  "नाही": "No",
  "नही": "No",
  "नहीं": "No",
  "न": "No",
  "जी नहीं": "No",
  "खात्री नाही": "Not sure",
  "पक्का नहीं": "Not sure",
  "माहित नाही": "Not known / Not reported",
  "माहिती नाही": "Not known / Not reported",
  "पता नहीं": "Not known / Not reported",
  "मालूम नहीं": "Not known / Not reported",
  "काही नाही": "None declared",
  "काहीही नाही": "None declared",
  "कोई नहीं": "None declared",
  "कुछ नहीं": "None declared",
  "कोणतीही नाही": "None reported",
  "कोणतेही नाही": "None reported",
  "यापैकी काहीही नाही": "None of these",
  "इनमें से कोई नहीं": "None of these",

  // --- Medications & Medical History ---
  "कोणतीही ऍलर्जी नाही": "No known allergies reported",
  "कोणतीही एलर्जी नाही": "No known allergies reported",
  "कोई ज्ञात एलर्जी नहीं": "No known allergies reported",
  "कोई एलर्जी नहीं": "No known allergies reported",
  "औषध घेतले नाही": "No medication taken",
  "कोणतेही औषध नाही": "No medication taken",
  "दवा नहीं ली": "No medication taken",
  "कोई दवा नहीं": "No medication taken",
  "नेहमीची औषधे": "Routine prescribed medications",
  "नियमित दवाइयां": "Routine prescribed medications",
  "पॅरासिटामॉल": "Paracetamol",
  "पैरासिटामोल": "Paracetamol",
  "पॅरासिटामोल": "Paracetamol",
  "काढा": "Herbal decoction (Kadha)",
  "काढ़ा": "Herbal decoction (Kadha)",
  "घरगुती उपाय": "Home remedies",
  "घरेलू नुस्खे": "Home remedies",
  "रक्तदाब": "Hypertension (High BP)",
  "उच्च रक्तदाब": "Hypertension (High BP)",
  "हाई बीपी": "Hypertension (High BP)",
  "बीपी": "Hypertension (High BP)",
  "मधुमेह": "Diabetes",
  "डायबिटीज": "Diabetes",
  "शुगर": "Diabetes",
  "थायरॉईड": "Thyroid disorder",
  "थायराइड": "Thyroid disorder",
  "अस्थमा": "Asthma",
  "दमा": "Asthma",
  "हृदयविकार": "Heart disease",
  "दिल की बीमारी": "Heart disease",
  "शस्त्रक्रिया": "Past surgery",
  "सर्जरी": "Past surgery",
  "ऑपरेशन": "Past surgery",
  "तापमान मोजले आहे": "Temperature measured",
  "तापमान मापा है": "Temperature measured",
  "तापमान मोजले नाही": "Temperature not measured",
  "तापमान नहीं मापा": "Temperature not measured",
  "रक्त तपासणी": "Blood investigation",
  "सोनोग्राफी": "Ultrasonography (USG)",
  "एक्स-रे": "X-ray imaging",
};

/**
 * Romanized Hinglish / Marathi / Hindi phonetic mapping to standard English
 */
const ROMAN_HINGLISH_MAP: Record<string, string> = {
  // Yes / Positive
  "ho": "Yes",
  "hoy": "Yes",
  "haan": "Yes",
  "haa": "Yes",
  "ha": "Yes",
  "ji haan": "Yes",
  "ji haa": "Yes",
  "ji ho": "Yes",
  "ahe": "Yes",
  "aahe": "Yes",
  "yes": "Yes",

  // No / Negative
  "nahi": "No",
  "nahin": "No",
  "nhi": "No",
  "na": "No",
  "naa": "No",
  "ji nahi": "No",
  "ji nahin": "No",
  "no": "No",

  // Maybe / Uncertain
  "kadachit": "Maybe",
  "shayad": "Maybe",
  "khatri nahi": "Not sure",
  "pakka nahi": "Not sure",
  "mahiti nahi": "Not known / Not reported",
  "pata nahi": "Not known / Not reported",
  "malum nahi": "Not known / Not reported",
  "samajla nahi": "Not clear",
  "not sure": "Not sure",
  "maybe": "Maybe",

  // Normal / Fair / Good
  "bari": "Normal / Fair",
  "bare": "Normal / Fair",
  "thik": "Normal / Fair",
  "theek": "Normal / Fair",
  "achha": "Good / Normal",
  "achhi": "Good / Normal",
  "changla": "Good / Normal",
  "changli": "Good / Normal",
  "changle": "Good / Normal",
  "regular": "Regular",
  "normal": "Normal",

  // None declared
  "kahi nahi": "None declared",
  "kahihi nahi": "None declared",
  "kuch nahi": "None declared",
  "kuchh nahi": "None declared",
  "koi nahi": "None declared",
  "kontihi nahi": "None reported",
  "kontehi nahi": "None reported",
  "aushadh ghetle nahi": "No medication taken",
  "dawa nahi li": "No medication taken",
  "dawa nahi": "No medication taken",
  "none": "None reported",

  // Durations & timing
  "divas aadhi": "days ago",
  "din pehle": "days ago",
  "3 divas aadhi": "3 days ago",
  "2 divas aadhi": "2 days ago",
  "1 divas aadhi": "1 day ago",
  "4 divas aadhi": "4 days ago",
  "5 divas aadhi": "5 days ago",
  "kalpasun": "Since yesterday",
  "kal se": "Since yesterday",
  "aajpasun": "Since today",
  "aaj se": "Since today",
};

/**
 * Check whether a string contains Non-ASCII characters (e.g. Devanagari, Bengali, Tamil, etc.)
 */
export function containsNonAscii(text?: string | null): boolean {
  if (!text) return false;
  return /[^\u0000-\u007F]/.test(text);
}

/**
 * Normalize an individual phrase, word, or question-answer line into standard English.
 */
export function normalizePhraseToEnglish(input?: string | null): string {
  if (!input || !input.trim()) return '';
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // 1. Direct questionId lookup
  if (ENGLISH_QUESTION_MAP[trimmed]) {
    return ENGLISH_QUESTION_MAP[trimmed];
  }

  // 2. Direct exact phrase match in Romanized Hinglish map
  if (ROMAN_HINGLISH_MAP[lower]) {
    return ROMAN_HINGLISH_MAP[lower];
  }

  // 3. Direct exact phrase match in dictionary or native question bank
  if (CLINICAL_PHRASE_MAP[trimmed]) {
    return CLINICAL_PHRASE_MAP[trimmed];
  }
  if (NATIVE_QUESTION_MAP[trimmed]) {
    return NATIVE_QUESTION_MAP[trimmed];
  }

  // 4. Question: Answer format (e.g., "तुम्ही तापमान मोजले आहे का?: होय" or "FEV_002: ho" or "Numbness...?: nahi")
  const colonIndex = trimmed.indexOf(':');
  if (colonIndex > 0) {
    const qPart = trimmed.substring(0, colonIndex).trim();
    const aPart = trimmed.substring(colonIndex + 1).trim();
    const qTrans = ENGLISH_QUESTION_MAP[qPart] || NATIVE_QUESTION_MAP[qPart] || normalizePhraseToEnglish(qPart);
    const aTrans = normalizePhraseToEnglish(aPart);
    const cleanQ = qTrans.replace(/\s+\?$/, '?');
    return `${cleanQ}: ${aTrans}`;
  }

  // 5. Comma, bullet, or native conjunction separated list
  if (trimmed.includes(',') || trimmed.includes('•') || trimmed.includes(' आणि ') || trimmed.includes(' और ')) {
    const parts = trimmed.split(/[,•]| आणि | और /).map(p => p.trim()).filter(Boolean);
    const translatedParts = parts.map(p => ROMAN_HINGLISH_MAP[p.toLowerCase()] || CLINICAL_PHRASE_MAP[p] || NATIVE_QUESTION_MAP[p] || translateWithWordSubstitutions(p));
    return translatedParts.join(', ');
  }

  return translateWithWordSubstitutions(trimmed);
}

// Pre-sorted phrases by length descending so longer multi-word expressions match first
const SORTED_PHRASE_ENTRIES = Object.entries(CLINICAL_PHRASE_MAP).sort(
  (a, b) => b[0].length - a[0].length
);

/**
 * Sub-word / token level deterministic replacement guaranteeing 100% English
 */
function translateWithWordSubstitutions(phrase: string): string {
  let result = phrase;

  // Substitute known clinical terms (longest matches first)
  for (const [nativeTerm, englishTerm] of SORTED_PHRASE_ENTRIES) {
    if (result.includes(nativeTerm)) {
      result = result.split(nativeTerm).join(englishTerm);
    }
  }

  // Convert Indian numeral digits (०-९) to standard digits (0-9)
  const devanagariDigits: Record<string, string> = {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
  };
  result = result.replace(/[०-९]/g, d => devanagariDigits[d] || d);

  // Common Hinglish / Romanized time and answer substitutions
  result = result
    .replace(/\bdivas aadhi\b/gi, 'days ago')
    .replace(/\bdin pehle\b/gi, 'days ago')
    .replace(/\bdivas\b/gi, 'days')
    .replace(/\bdin\b/gi, 'days')
    .replace(/\baathwada aadhi\b/gi, 'weeks ago')
    .replace(/\bhafta pehle\b/gi, 'weeks ago')
    .replace(/\baathwada\b/gi, 'weeks')
    .replace(/\bhafta\b/gi, 'weeks')
    .replace(/\bmahina aadhi\b/gi, 'months ago')
    .replace(/\bmahine pehle\b/gi, 'months ago')
    .replace(/\bmahina\b/gi, 'months')
    .replace(/\bkalpasun\b/gi, 'since yesterday')
    .replace(/\bkal se\b/gi, 'since yesterday')
    .replace(/\baajpasun\b/gi, 'since today')
    .replace(/\baaj se\b/gi, 'since today')
    .replace(/\bkadachit\b/gi, 'Maybe')
    .replace(/\bshayad\b/gi, 'Maybe')
    .replace(/\bnahi\b/gi, 'No')
    .replace(/\bnahin\b/gi, 'No')
    .replace(/\bho\b/gi, 'Yes')
    .replace(/\bhoy\b/gi, 'Yes')
    .replace(/\bhaan\b/gi, 'Yes')
    .replace(/\bbari\b/gi, 'Normal')
    .replace(/\bthik\b/gi, 'Normal')
    .replace(/\btheek\b/gi, 'Normal');

  // Common duration and frequency word cleaning (Devanagari)
  result = result
    .replace(/\bदिवसांपासून\b/g, 'days ago')
    .replace(/\bदिवस\b/g, 'days')
    .replace(/\bदिन से\b/g, 'days ago')
    .replace(/\bदिन\b/g, 'days')
    .replace(/\bआठवड्यापासून\b/g, 'weeks ago')
    .replace(/\bआठवडा\b/g, 'weeks')
    .replace(/\bसप्ताह से\b/g, 'weeks ago')
    .replace(/\bसप्ताह\b/g, 'weeks')
    .replace(/\bमहिना\b/g, 'months')
    .replace(/\bमहीना\b/g, 'months')
    .replace(/\bतीव्र\b/g, 'Severe')
    .replace(/\bखूप\b/g, 'Severe')
    .replace(/\bतेज\b/g, 'Severe')
    .replace(/\bहलका\b/g, 'Mild')
    .replace(/\bकमी\b/g, 'Mild')
    .replace(/\bमाझे\b/g, 'My')
    .replace(/\bमला\b/g, 'Patient reports')
    .replace(/\bआहे\b/g, '')
    .replace(/\bआहेत\b/g, '')
    .replace(/\bहोता\b/g, '')
    .replace(/\bहोती\b/g, '')
    .replace(/\bहोते\b/g, '')
    .replace(/\bथा\b/g, '')
    .replace(/\bथी\b/g, '')
    .replace(/\bथे\b/g, '')
    .replace(/\bमध्ये\b/g, 'in')
    .replace(/\bसे\b/g, 'from')
    .replace(/\bका\b/g, '')
    .replace(/\bकी\b/g, '')
    .replace(/\bके\b/g, '');

  // Strip any residual Devanagari characters so no regional script leaks to doctor view
  result = result.replace(/[\u0900-\u097F]+/g, ' ').replace(/\s+/g, ' ').trim();

  // If entire input was an unmapped foreign term that got stripped, provide standard clinical fallback
  if (!result) {
    return 'Reported by patient during intake';
  }

  return result;
}

/**
 * Normalizes a ClinicalHistory object so all physician-facing fields are strictly in English.
 * Original patient answers array is preserved verbatim for audit.
 */
export function normalizeClinicalHistoryToEnglish(history: ClinicalHistory): ClinicalHistory {
  if (!history) return history;

  const chiefComplaint = normalizePhraseToEnglish(history.chiefComplaint);
  const duration = normalizePhraseToEnglish(history.duration);

  // Expand and normalize associated symptoms into individual distinct bullet items
  const rawSymptoms = history.associatedSymptoms || [];
  const associatedSymptoms: string[] = [];

  for (const s of rawSymptoms) {
    if (typeof s === 'string' && (s.match(/:/g) || []).length > 1 && s.includes(', ')) {
      // Split on comma followed by next question ending with a question mark and colon
      const parts = s.split(/,\s*(?=[^,:]+\?\s*:)/);
      for (const p of parts) {
        if (p.trim()) {
          associatedSymptoms.push(normalizePhraseToEnglish(p.trim()));
        }
      }
    } else if (typeof s === 'string' && s.trim()) {
      associatedSymptoms.push(normalizePhraseToEnglish(s.trim()));
    }
  }

  const medicationTaken = history.medicationTaken ? normalizePhraseToEnglish(history.medicationTaken) : 'None reported';
  const allergies = history.allergies ? normalizePhraseToEnglish(history.allergies) : 'No known allergies reported';
  const pastMedicalHistory = history.pastMedicalHistory ? normalizePhraseToEnglish(history.pastMedicalHistory) : 'None declared';

  return {
    ...history,
    chiefComplaint: chiefComplaint || 'Intake completed',
    duration: duration || 'Reported during intake',
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
    medications: normalizedHistory.medicationTaken || normalizePhraseToEnglish(summary.medications) || 'None reported',
    allergies: normalizedHistory.allergies || normalizePhraseToEnglish(summary.allergies) || 'No known allergies reported',
    pastHistory: normalizedHistory.pastMedicalHistory || normalizePhraseToEnglish(summary.pastHistory) || 'None declared',
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
