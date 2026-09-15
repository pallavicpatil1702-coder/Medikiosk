import { 
  normalizeClinicalSummaryToEnglish, 
  normalizePhraseToEnglish, 
  buildSpokenClinicalSummary,
  containsNonAscii
} from '../lib/clinicalSummaryTranslator';
import type { ClinicalSummary } from '../lib/types';

function runTests() {
  console.log('--- STARTING DOCTOR SUMMARY AUDIO & TRANSLATION TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${testName}`);
      failed++;
    }
  }

  // TEST 1: Non-ASCII detection
  assert(containsNonAscii('२ दिवस') === true, 'Detects Devanagari numerals and Marathi text');
  assert(containsNonAscii('बुखार और खांसी') === true, 'Detects Hindi text');
  assert(containsNonAscii('Fever and cough') === false, 'Detects plain English/ASCII text');

  // TEST 2: Deterministic Marathi translation
  const marathiComplaint = 'ताप आणि खोकला';
  const mrTranslated = normalizePhraseToEnglish(marathiComplaint);
  assert(mrTranslated.toLowerCase().includes('fever') && mrTranslated.toLowerCase().includes('cough'), 
    `Marathi "ताप आणि खोकला" translates to "${mrTranslated}" (contains fever and cough)`);

  const marathiDuration = '२ दिवस';
  const mrDurationTrans = normalizePhraseToEnglish(marathiDuration);
  assert(mrDurationTrans.includes('2 days'), `Marathi "२ दिवस" translates to "${mrDurationTrans}" (contains 2 days)`);

  const marathiStomach = 'तीव्र पोटदुखी';
  const mrStomachTrans = normalizePhraseToEnglish(marathiStomach);
  assert(mrStomachTrans.toLowerCase().includes('stomach') || mrStomachTrans.toLowerCase().includes('pain'),
    `Marathi "तीव्र पोटदुखी" translates to "${mrStomachTrans}"`);

  // TEST 3: Deterministic Hindi translation
  const hindiComplaint = 'तेज बुखार, सिरदर्द';
  const hiTranslated = normalizePhraseToEnglish(hindiComplaint);
  assert(hiTranslated.toLowerCase().includes('fever') && hiTranslated.toLowerCase().includes('headache'),
    `Hindi "तेज बुखार, सिरदर्द" translates to "${hiTranslated}" (contains fever and headache)`);

  const hindiDuration = '3 दिन से';
  const hiDurationTrans = normalizePhraseToEnglish(hindiDuration);
  assert(hiDurationTrans.toLowerCase().includes('3 days'),
    `Hindi "3 दिन से" translates to "${hiDurationTrans}" (contains 3 days)`);

  // TEST 4: Full ClinicalSummary normalization with Marathi intake
  const marathiIntakeSummary: ClinicalSummary = {
    id: 'test-mr-1',
    patientId: 'patient-mr-1',
    generatedAt: new Date().toISOString(),
    patient: {
      id: 'patient-mr-1',
      name: 'Ramesh Patil',
      age: 42,
      gender: 'Male',
      createdAt: new Date().toISOString()
    },
    history: {
      chiefComplaint: 'तीव्र डोकेदुखी आणि ताप',
      duration: '२ दिवस',
      associatedSymptoms: ['उलटी', 'मळमळ'],
      medicationTaken: 'पॅरासिटामॉल',
      allergies: 'कोणतीही ऍलर्जी नाही',
      pastMedicalHistory: 'काही नाही',
      answers: [
        { questionId: 'CHIEF_001', questionText: 'तुमची समस्या काय आहे?', answer: 'डोकेदुखी' },
        { questionId: 'DUR_001', questionText: 'किती दिवसांपासून आहे?', answer: '२ दिवस' }
      ]
    },
    medications: 'पॅरासिटामॉल',
    allergies: 'कोणतीही ऍलर्जी नाही',
    pastHistory: 'काही नाही',
    investigationResults: 'None',
    previousReports: [],
    redFlags: [
      { id: 'rf-1', type: 'High Fever Alert', description: 'Patient temperature exceeds threshold', severity: 'high', detectedAt: new Date().toISOString() }
    ],
    aiNotes: 'Auto-generated Marathi draft.',
    status: 'pending'
  };

  const englishSummary = normalizeClinicalSummaryToEnglish(marathiIntakeSummary);

  assert(englishSummary.history.chiefComplaint.toLowerCase().includes('headache') &&
         englishSummary.history.chiefComplaint.toLowerCase().includes('fever'),
         'Marathi Chief Complaint normalized to English (Headache and Fever)');

  assert(englishSummary.history.duration.includes('2 days'),
         'Marathi Duration normalized to English (2 days)');

  assert(englishSummary.history.associatedSymptoms.some(s => s.toLowerCase().includes('vomiting')) ||
         englishSummary.history.associatedSymptoms.some(s => s.toLowerCase().includes('nausea')),
         'Marathi Associated Symptoms normalized to English (Vomiting / Nausea)');

  assert(englishSummary.medications.toLowerCase().includes('paracetamol'),
         'Marathi Medication normalized to English (Paracetamol)');

  assert(englishSummary.allergies.toLowerCase().includes('no known allergies'),
         'Marathi Allergy normalized to English (No known allergies reported)');

  assert(englishSummary.pastHistory.toLowerCase().includes('none'),
         'Marathi Past History normalized to English (None declared)');

  // Critical: Original answers preserved in Marathi
  assert(englishSummary.history.answers[0].answer === 'डोकेदुखी',
         'Original patient answers array preserved in Marathi verbatim');

  // TEST 5: Spoken Clinical Summary builder matches screen
  const spokenText = buildSpokenClinicalSummary({
    patientName: englishSummary.patient.name,
    patientAge: englishSummary.patient.age,
    patientGender: englishSummary.patient.gender,
    chiefComplaint: englishSummary.history.chiefComplaint,
    duration: englishSummary.history.duration,
    associatedSymptoms: englishSummary.history.associatedSymptoms,
    medications: englishSummary.medications,
    allergies: englishSummary.allergies,
    pastHistory: englishSummary.pastHistory,
    triageNote: 'Patient triaged to fast track',
    redFlags: englishSummary.redFlags
  });

  assert(spokenText.includes('Ramesh Patil'), 'Spoken text includes patient name');
  assert(spokenText.includes('Chief Complaint:'), 'Spoken text includes Chief Complaint');
  assert(spokenText.includes('Duration: 2 days'), 'Spoken text includes Duration');
  assert(spokenText.includes('Paracetamol'), 'Spoken text includes Medications');
  assert(spokenText.includes('Triage Nurse note: Patient triaged to fast track'), 'Spoken text includes Nurse Triage Note');
  assert(spokenText.includes('High Fever Alert'), 'Spoken text includes Red Flag warning');

  console.log('--- TEST SUMMARY ---');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
