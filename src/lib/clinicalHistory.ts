import { Answer, ClinicalHistory } from '@/lib/types';

/**
 * Builds a structured ClinicalHistory object from the patient's real responses and complaint.
 */
export function buildHistory(chiefComplaint: string | undefined, answers: Answer[]): ClinicalHistory {
  const complaint = chiefComplaint || '';
  
  // Find an answer that relates to duration
  const durationAnswer = answers.find(a => 
    a.questionId.endsWith('001') && a.questionId !== 'URGENT_001'
  )?.answer || 'Not specified';
  
  // Collect all other answers as associated symptoms/context
  const symptoms: string[] = answers
    .filter(a => !a.questionId.endsWith('001'))
    .map(a => `${a.questionText || a.questionId}: ${a.answer}`);

  const medication = 'None reported (needs clinician review)';

  return {
    chiefComplaint: complaint,
    duration: durationAnswer,
    associatedSymptoms: symptoms.length > 0 ? symptoms : ['See specific answers'],
    medicationTaken: medication,
    allergies: 'Not assessed in intake',
    pastMedicalHistory: 'Not fully assessed in intake',
    answers,
  };
}
