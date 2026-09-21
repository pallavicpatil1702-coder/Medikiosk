import { Answer, ClinicalHistory } from '@/lib/types';

// Known question IDs for key clinical fields
const DURATION_IDS = ['FEV_001', 'COU_001', 'CHEST_001', 'ABD_001', 'HED_001', 'BAK_001', 'JNT_001'];
const MEDICATION_IDS = ['ALLERGY_002', 'FEV_MED', 'ABD_MED', 'COU_MED'];
const ALLERGY_IDS = ['ALLERGY_001', 'ALLERGY_002'];
const PAST_HISTORY_IDS = ['FEV_HIST', 'ABD_HIST', 'COU_HIST', 'CHEST_HIST'];

/**
 * Builds a structured ClinicalHistory object from the patient's real responses and complaint.
 */
export function buildHistory(chiefComplaint: string | undefined, answers: Answer[]): ClinicalHistory {
  const complaint = chiefComplaint || '';
  
  // Find duration answer: check known duration question IDs first, then fall back to first _001 answer
  const durationAnswer = 
    answers.find(a => DURATION_IDS.includes(a.questionId))?.answer ||
    answers.find(a => a.questionId.endsWith('001') && a.questionId !== 'URGENT_001')?.answer ||
    'Not specified';
  
  // Extract medication info from known medication question IDs
  const medicationAnswer = answers
    .filter(a => MEDICATION_IDS.includes(a.questionId))
    .map(a => a.answer)
    .filter(Boolean)
    .join(', ') || 'None reported';

  // Extract allergy info: if ALLERGY_001 = "no", report NKDA; if yes, pull ALLERGY_002
  const allergyNoAnswer = answers.find(a => a.questionId === 'ALLERGY_001' && /no/i.test(a.answer));
  const allergyDetails = answers.find(a => a.questionId === 'ALLERGY_002')?.answer;
  const allergies = allergyDetails
    ? allergyDetails
    : allergyNoAnswer
    ? 'NKDA (No known drug allergy)'
    : 'Not assessed';

  // Extract past medical history
  const pastHistoryAnswer = answers
    .filter(a => PAST_HISTORY_IDS.includes(a.questionId))
    .map(a => a.answer)
    .filter(Boolean)
    .join(', ') || 'Not fully assessed';

  // Collect all other answers as associated symptoms/context (exclude key clinical field answers)
  const excludedIds = new Set([...DURATION_IDS, ...MEDICATION_IDS, ...ALLERGY_IDS, ...PAST_HISTORY_IDS]);
  const symptoms: string[] = answers
    .filter(a => !excludedIds.has(a.questionId) && !a.questionId.endsWith('001'))
    .map(a => `${a.questionText || a.questionId}: ${a.answer}`);

  return {
    chiefComplaint: complaint,
    duration: durationAnswer,
    associatedSymptoms: symptoms.length > 0 ? symptoms : [],
    medicationTaken: medicationAnswer,
    allergies,
    pastMedicalHistory: pastHistoryAnswer,
    answers,
  };
}
