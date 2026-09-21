import { Answer, ClinicalHistory } from '@/lib/types';
import { normalizePhraseToEnglish, getEnglishQuestionText } from '@/lib/clinicalSummaryTranslator';

// Known question IDs for key clinical fields
const DURATION_IDS = ['FEV_001', 'COU_001', 'CHEST_001', 'ABD_001', 'HED_001', 'BAK_001', 'JNT_001'];
const MEDICATION_IDS = ['ALLERGY_002', 'FEV_MED', 'ABD_MED', 'COU_MED'];
const ALLERGY_IDS = ['ALLERGY_001', 'ALLERGY_002'];
const PAST_HISTORY_IDS = ['FEV_HIST', 'ABD_HIST', 'COU_HIST', 'CHEST_HIST'];

/**
 * Builds a structured ClinicalHistory object from the patient's responses and complaint.
 * When lang !== 'en', preserves original patient language (Hindi/Marathi) for patient-facing summaries.
 * When lang === 'en', guarantees all summary fields are stored in English for the attending physician.
 */
export function buildHistory(chiefComplaint: string | undefined, answers: Answer[], lang: string = 'en'): ClinicalHistory {
  const isEnglish = lang === 'en';

  const complaint = isEnglish
    ? (normalizePhraseToEnglish(chiefComplaint) || chiefComplaint || '')
    : (chiefComplaint || '');
  
  // Find duration answer: prioritize normalizedEnglishText, then answer, normalized to English
  const durationMatch = 
    answers.find(a => DURATION_IDS.includes(a.questionId)) ||
    answers.find(a => a.questionId.endsWith('001') && a.questionId !== 'URGENT_001');

  const rawDuration = isEnglish
    ? (durationMatch?.normalizedEnglishText || durationMatch?.answer || 'Not specified')
    : (durationMatch?.answer || durationMatch?.normalizedEnglishText || (lang === 'hi' ? 'निर्दिष्ट नहीं' : lang === 'mr' ? 'नमूद केलेले नाही' : 'Not specified'));

  const durationAnswer = isEnglish
    ? (normalizePhraseToEnglish(rawDuration) || rawDuration)
    : rawDuration;
  
  // Extract medication info from known medication question IDs
  const medicationAnswer = isEnglish
    ? (answers
        .filter(a => MEDICATION_IDS.includes(a.questionId))
        .map(a => normalizePhraseToEnglish(a.normalizedEnglishText || a.answer))
        .filter(Boolean)
        .join(', ') || 'None reported')
    : (answers
        .filter(a => MEDICATION_IDS.includes(a.questionId))
        .map(a => a.answer)
        .filter(Boolean)
        .join(', ') || (lang === 'hi' ? 'कोई दवा नहीं बताई गई' : lang === 'mr' ? 'कोणतेही औषध नोंदवले नाही' : 'None reported'));

  // Extract allergy info: if ALLERGY_001 = "no", report NKDA; if yes, pull ALLERGY_002
  const allergyNoAnswer = answers.find(
    a => a.questionId === 'ALLERGY_001' && 
    (/no/i.test(a.normalizedEnglishText || a.answer) || /नाही/i.test(a.answer) || /नही/i.test(a.answer))
  );
  const allergyMatch = answers.find(a => a.questionId === 'ALLERGY_002');
  const allergyDetails = allergyMatch 
    ? (isEnglish ? normalizePhraseToEnglish(allergyMatch.normalizedEnglishText || allergyMatch.answer) : allergyMatch.answer)
    : undefined;

  const allergies = allergyDetails
    ? allergyDetails
    : allergyNoAnswer
    ? (isEnglish ? 'NKDA (No known drug allergy)' : (lang === 'hi' ? 'कोई ज्ञात दवा एलर्जी नहीं (NKDA)' : lang === 'mr' ? 'कोणतीही ज्ञात औषध ऍलर्जी नाही (NKDA)' : 'NKDA (No known drug allergy)'))
    : (isEnglish ? 'Not assessed' : (lang === 'hi' ? 'मूल्यांकन नहीं किया गया' : lang === 'mr' ? 'मूल्यांकन केलेले नाही' : 'Not assessed'));

  // Extract past medical history
  const pastHistoryAnswer = isEnglish
    ? (answers
        .filter(a => PAST_HISTORY_IDS.includes(a.questionId))
        .map(a => normalizePhraseToEnglish(a.normalizedEnglishText || a.answer))
        .filter(Boolean)
        .join(', ') || 'Not fully assessed')
    : (answers
        .filter(a => PAST_HISTORY_IDS.includes(a.questionId))
        .map(a => a.answer)
        .filter(Boolean)
        .join(', ') || (lang === 'hi' ? 'कोई पूर्व इतिहास नहीं' : lang === 'mr' ? 'कोणताही पूर्व इतिहास नाही' : 'Not fully assessed'));

  // Collect all other answers as associated symptoms/context (exclude key clinical field answers)
  const excludedIds = new Set([...DURATION_IDS, ...MEDICATION_IDS, ...ALLERGY_IDS, ...PAST_HISTORY_IDS]);
  const symptoms: string[] = answers
    .filter(a => !excludedIds.has(a.questionId) && !a.questionId.endsWith('001'))
    .map(a => {
      const qText = isEnglish 
        ? (getEnglishQuestionText(a.questionId) || normalizePhraseToEnglish(a.questionText) || a.questionId)
        : (a.questionText || getEnglishQuestionText(a.questionId) || a.questionId);
      const aText = isEnglish
        ? normalizePhraseToEnglish(a.normalizedEnglishText || a.answer)
        : a.answer;
      return `${qText}: ${aText}`;
    });

  const defaultComplaint = isEnglish ? 'Intake completed' : (lang === 'hi' ? 'जांच पूरी हुई' : lang === 'mr' ? 'तपासणी पूर्ण झाली' : 'Intake completed');
  const defaultDuration = isEnglish ? 'Reported during intake' : (lang === 'hi' ? 'पंजीकरण के दौरान सूचित किया गया' : lang === 'mr' ? 'नोंदणी दरम्यान कळवले' : 'Reported during intake');

  return {
    chiefComplaint: complaint || defaultComplaint,
    duration: durationAnswer || defaultDuration,
    associatedSymptoms: symptoms.length > 0 ? symptoms : [],
    medicationTaken: medicationAnswer,
    allergies,
    pastMedicalHistory: pastHistoryAnswer,
    answers,
  };
}
