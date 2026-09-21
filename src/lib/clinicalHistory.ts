import { Answer, ClinicalHistory } from '@/lib/types';
import { normalizePhraseToEnglish, getEnglishQuestionText } from '@/lib/clinicalSummaryTranslator';

// Known question IDs for key clinical fields
const DURATION_IDS = ['FEV_001', 'COU_001', 'CHEST_001', 'ABD_001', 'HED_001', 'BAK_001', 'JNT_001'];
const MEDICATION_IDS = ['ALLERGY_002', 'FEV_MED', 'ABD_MED', 'COU_MED'];
const ALLERGY_IDS = ['ALLERGY_001', 'ALLERGY_002'];
const PAST_HISTORY_IDS = ['FEV_HIST', 'ABD_HIST', 'COU_HIST', 'CHEST_HIST'];

/**
 * Builds a structured ClinicalHistory object from the patient's responses and complaint.
 * Guarantees all summary fields are stored strictly in English for the attending physician.
 */
export function buildHistory(chiefComplaint: string | undefined, answers: Answer[]): ClinicalHistory {
  const complaint = normalizePhraseToEnglish(chiefComplaint) || chiefComplaint || '';
  
  // Find duration answer: prioritize normalizedEnglishText, then answer, normalized to English
  const durationMatch = 
    answers.find(a => DURATION_IDS.includes(a.questionId)) ||
    answers.find(a => a.questionId.endsWith('001') && a.questionId !== 'URGENT_001');

  const rawDuration = durationMatch?.normalizedEnglishText || durationMatch?.answer || 'Not specified';
  const durationAnswer = normalizePhraseToEnglish(rawDuration) || rawDuration;
  
  // Extract medication info from known medication question IDs
  const medicationAnswer = answers
    .filter(a => MEDICATION_IDS.includes(a.questionId))
    .map(a => normalizePhraseToEnglish(a.normalizedEnglishText || a.answer))
    .filter(Boolean)
    .join(', ') || 'None reported';

  // Extract allergy info: if ALLERGY_001 = "no", report NKDA; if yes, pull ALLERGY_002
  const allergyNoAnswer = answers.find(
    a => a.questionId === 'ALLERGY_001' && 
    (/no/i.test(a.normalizedEnglishText || a.answer) || /नाही/i.test(a.answer) || /नही/i.test(a.answer))
  );
  const allergyMatch = answers.find(a => a.questionId === 'ALLERGY_002');
  const allergyDetails = allergyMatch 
    ? normalizePhraseToEnglish(allergyMatch.normalizedEnglishText || allergyMatch.answer)
    : undefined;

  const allergies = allergyDetails
    ? allergyDetails
    : allergyNoAnswer
    ? 'NKDA (No known drug allergy)'
    : 'Not assessed';

  // Extract past medical history
  const pastHistoryAnswer = answers
    .filter(a => PAST_HISTORY_IDS.includes(a.questionId))
    .map(a => normalizePhraseToEnglish(a.normalizedEnglishText || a.answer))
    .filter(Boolean)
    .join(', ') || 'Not fully assessed';

  // Collect all other answers as associated symptoms/context (exclude key clinical field answers)
  const excludedIds = new Set([...DURATION_IDS, ...MEDICATION_IDS, ...ALLERGY_IDS, ...PAST_HISTORY_IDS]);
  const symptoms: string[] = answers
    .filter(a => !excludedIds.has(a.questionId) && !a.questionId.endsWith('001'))
    .map(a => {
      const qText = getEnglishQuestionText(a.questionId) || normalizePhraseToEnglish(a.questionText) || a.questionId;
      const aText = normalizePhraseToEnglish(a.normalizedEnglishText || a.answer);
      return `${qText}: ${aText}`;
    });

  return {
    chiefComplaint: complaint || 'Intake completed',
    duration: durationAnswer || 'Reported during intake',
    associatedSymptoms: symptoms.length > 0 ? symptoms : [],
    medicationTaken: medicationAnswer,
    allergies,
    pastMedicalHistory: pastHistoryAnswer,
    answers,
  };
}
