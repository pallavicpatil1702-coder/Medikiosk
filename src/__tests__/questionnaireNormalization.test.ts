import assert from 'assert';
import { 
  normalizeQuestion, 
  normalizeQuestionType, 
  normalizeRawOptions, 
  getStandardYesNoOptions, 
  mapAnswerToNormalizedEnglish, 
  extractQuestionText 
} from '../lib/questionNormalizer';
import type { Question, Answer } from '../lib/types';

console.log('=== STARTING QUESTIONNAIRE NORMALIZATION & RENDERING TESTS ===\n');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAIL: ${name}`);
    console.error(err);
    failed++;
  }
}

// -------------------------------------------------------------
// TEST SUITE 1: Question Schema Variants
// -------------------------------------------------------------
test('1.1 Normalizes JSON-defined question with multilingual text', () => {
  const jsonQ: Question = {
    id: 'FEV_003',
    text: {
      en: 'Have you measured your temperature?',
      hi: 'क्या आपने तापमान मापा है?',
      mr: 'तुम्ही तापमान मोजले आहे का?'
    },
    type: 'yes_no',
    branch: { yes: 'FEV_004', no: 'FEV_005' }
  };

  const normEn = normalizeQuestion(jsonQ, 'en');
  assert.strictEqual(normEn.id, 'FEV_003');
  assert.strictEqual(normEn.text, 'Have you measured your temperature?');
  assert.strictEqual(normEn.type, 'yes_no');
  assert.strictEqual(normEn.options.length, 3);
  assert.strictEqual(normEn.options[0].value, 'Yes');

  const normHi = normalizeQuestion(jsonQ, 'hi');
  assert.strictEqual(normHi.text, 'क्या आपने तापमान मापा है?');
  assert.strictEqual(normHi.options[0].value, 'Haan');
  assert.strictEqual(normHi.options[1].value, 'Nahin');
  assert.strictEqual(normHi.options[2].value, 'Pakka Nahin');
});

test('1.2 Normalizes non-JSON / alternate schema (question, prompt, linkId, answerOption)', () => {
  // FHIR Questionnaire item format
  const fhirQ = {
    linkId: 'FHIR_001',
    text: 'Do you have persistent cough?',
    type: 'boolean'
  };
  const normFhir = normalizeQuestion(fhirQ, 'en');
  assert.strictEqual(normFhir.id, 'FHIR_001');
  assert.strictEqual(normFhir.text, 'Do you have persistent cough?');
  assert.strictEqual(normFhir.type, 'yes_no');
  assert.strictEqual(normFhir.options.length, 3);

  // Custom prompt format with FHIR answerOption
  const customQ = {
    questionId: 'CUSTOM_CHOICE_01',
    prompt: 'Select severity level',
    type: 'choice',
    answerOption: [
      { valueString: 'Mild' },
      { valueString: 'Moderate' },
      { valueString: 'Severe' }
    ]
  };
  const normCustom = normalizeQuestion(customQ, 'en');
  assert.strictEqual(normCustom.id, 'CUSTOM_CHOICE_01');
  assert.strictEqual(normCustom.text, 'Select severity level');
  assert.strictEqual(normCustom.type, 'single');
  assert.strictEqual(normCustom.options.length, 3);
  assert.strictEqual(normCustom.options[0].label, 'Mild');
  assert.strictEqual(normCustom.options[2].value, 'Severe');
});

// -------------------------------------------------------------
// TEST SUITE 2: Hindi, Hinglish, Marathi, and English Yes/No
// -------------------------------------------------------------
test('2.1 "Kya aapko ulti hoti hai?" displays Haan, Nahin, Pakka Nahin in Hindi and Hinglish', () => {
  // Roman Hindi / Hinglish question
  const hinglishQ = {
    id: 'VOMIT_001',
    text: 'Kya aapko ulti hoti hai?',
    type: 'yes_no'
  };
  
  // In English mode with Hinglish text, should detect Hinglish and offer Haan, Nahin, Pakka Nahin
  const normHinglish = normalizeQuestion(hinglishQ, 'en');
  assert.strictEqual(normHinglish.type, 'yes_no');
  assert.strictEqual(normHinglish.options.length, 3);
  assert.strictEqual(normHinglish.options[0].value, 'Haan');
  assert.strictEqual(normHinglish.options[1].value, 'Nahin');
  assert.strictEqual(normHinglish.options[2].value, 'Pakka Nahin');

  // In Hindi mode
  const normHi = normalizeQuestion(hinglishQ, 'hi');
  assert.strictEqual(normHi.options[0].value, 'Haan');
  assert.strictEqual(normHi.options[1].value, 'Nahin');
  assert.strictEqual(normHi.options[2].value, 'Pakka Nahin');
});

test('2.2 Marathi Yes/No provides Hoy, Nahi, Khatri Nahi', () => {
  const marathiQ = {
    id: 'ABD_006',
    text: {
      en: 'Do you have nausea or vomiting?',
      mr: 'मळमळ किंवा उलटी आहे का?'
    },
    type: 'yes_no'
  };
  const normMr = normalizeQuestion(marathiQ, 'mr');
  assert.strictEqual(normMr.text, 'मळमळ किंवा उलटी आहे का?');
  assert.strictEqual(normMr.options[0].value, 'Hoy');
  assert.strictEqual(normMr.options[1].value, 'Nahi');
  assert.strictEqual(normMr.options[2].value, 'Khatri Nahi');
});

test('2.3 English Yes/No provides Yes, No, Not sure', () => {
  const engQ = {
    id: 'ABD_006',
    text: {
      en: 'Do you have nausea or vomiting?',
      hi: 'क्या मितली या उल्टी है?'
    },
    type: 'yes_no'
  };
  const normEn = normalizeQuestion(engQ, 'en');
  assert.strictEqual(normEn.options[0].value, 'Yes');
  assert.strictEqual(normEn.options[1].value, 'No');
  assert.strictEqual(normEn.options[2].value, 'Not sure');
});

test('2.4 Normalizes multilingual answers to canonical English for branching', () => {
  assert.strictEqual(mapAnswerToNormalizedEnglish('Haan'), 'Yes');
  assert.strictEqual(mapAnswerToNormalizedEnglish('हाँ'), 'Yes');
  assert.strictEqual(mapAnswerToNormalizedEnglish('हाँ (Haan)'), 'Yes');
  assert.strictEqual(mapAnswerToNormalizedEnglish('Hoy'), 'Yes');
  assert.strictEqual(mapAnswerToNormalizedEnglish('होय'), 'Yes');
  assert.strictEqual(mapAnswerToNormalizedEnglish('Nahin'), 'No');
  assert.strictEqual(mapAnswerToNormalizedEnglish('नहीं'), 'No');
  assert.strictEqual(mapAnswerToNormalizedEnglish('Nahi'), 'No');
  assert.strictEqual(mapAnswerToNormalizedEnglish('नाही'), 'No');
  assert.strictEqual(mapAnswerToNormalizedEnglish('Pakka Nahin'), 'Not sure');
  assert.strictEqual(mapAnswerToNormalizedEnglish('पक्का नहीं'), 'Not sure');
  assert.strictEqual(mapAnswerToNormalizedEnglish('Khatri Nahi'), 'Not sure');
});

// -------------------------------------------------------------
// TEST SUITE 3: Single-choice, Multi-choice, Number, Scale, Free-text
// -------------------------------------------------------------
test('3.1 Single-choice with configured options preserves all options', () => {
  const singleQ = {
    id: 'GI_001',
    text: {
      en: 'Which problem is present: vomiting, diarrhea, or both?',
      hi: 'उल्टी, दस्त या दोनों?'
    },
    type: 'single',
    options: ['Vomiting', 'Diarrhea', 'Both']
  };
  const norm = normalizeQuestion(singleQ, 'en');
  assert.strictEqual(norm.type, 'single');
  assert.strictEqual(norm.options.length, 3);
  assert.strictEqual(norm.options[0].value, 'Vomiting');
  assert.strictEqual(norm.options[1].value, 'Diarrhea');
  assert.strictEqual(norm.options[2].value, 'Both');
});

test('3.2 Multi-choice retains configured options without overriding', () => {
  const multiQ = {
    id: 'FEV_006',
    text: 'Do you have cough, sore throat, vomiting, diarrhea, or burning while urinating?',
    type: 'multi_choice',
    options: ['Cough', 'Sore throat', 'Vomiting', 'Diarrhea', 'Burning while urinating', 'None of these']
  };
  const norm = normalizeQuestion(multiQ, 'en');
  assert.strictEqual(norm.type, 'multi_choice');
  assert.strictEqual(norm.options.length, 6);
  assert.strictEqual(norm.options[0].value, 'Cough');
  assert.strictEqual(norm.options[5].value, 'None of these');
});

test('3.3 Number questions preserve numeric type and do not invent options', () => {
  const numQ = {
    id: 'FEV_004',
    text: 'What was the highest temperature recorded?',
    type: 'number'
  };
  const norm = normalizeQuestion(numQ, 'en');
  assert.strictEqual(norm.type, 'number');
  assert.strictEqual(norm.options.length, 0);
});

test('3.4 Scale questions generate 0 to 10 rating scale', () => {
  const scaleQ = {
    id: 'CHE_002',
    text: 'Rate the pain from 0 to 10.',
    type: 'scale'
  };
  const norm = normalizeQuestion(scaleQ, 'en');
  assert.strictEqual(norm.type, 'scale');
  assert.strictEqual(norm.options.length, 11);
  assert.strictEqual(norm.options[0].value, '0');
  assert.strictEqual(norm.options[10].value, '10');
});

test('3.5 Open-ended free_text and duration questions retain text type', () => {
  const freeQ = {
    id: 'AYU_002',
    text: 'How are your appetite and digestion compared with usual?',
    type: 'free_text'
  };
  const normFree = normalizeQuestion(freeQ, 'en');
  assert.strictEqual(normFree.type, 'free_text');
  assert.strictEqual(normFree.options.length, 0);

  const durQ = {
    id: 'FEV_001',
    text: 'When did the fever start?',
    type: 'duration'
  };
  const normDur = normalizeQuestion(durQ, 'en');
  assert.strictEqual(normDur.type, 'duration');
  assert.strictEqual(normDur.options.length, 0);
});

// -------------------------------------------------------------
// TEST SUITE 4: Answer Persistence & Deduplication
// -------------------------------------------------------------
test('4.1 Answers are updated by questionId without creating duplicates', () => {
  let answers: Answer[] = [
    { questionId: 'Q1', answer: 'Old Answer', questionText: 'Q1 Text' },
    { questionId: 'Q2', answer: 'Q2 Answer', questionText: 'Q2 Text' },
  ];

  const updatedEntry: Answer = {
    questionId: 'Q1',
    answer: 'New Updated Answer',
    questionText: 'Q1 Text'
  };

  const existingIdx = answers.findIndex(a => a.questionId === updatedEntry.questionId);
  const newAnswers = existingIdx >= 0
    ? answers.map((a, i) => i === existingIdx ? updatedEntry : a)
    : [...answers, updatedEntry];

  assert.strictEqual(newAnswers.length, 2, 'Must not duplicate Q1');
  assert.strictEqual(newAnswers[0].answer, 'New Updated Answer');
  assert.strictEqual(newAnswers[1].questionId, 'Q2');
});

test('4.2 Multi-select answers are preserved and parsed correctly', () => {
  const selectedChoices = ['Cough', 'Fever', 'Sore throat'];
  const joinedString = selectedChoices.join(', ');

  const savedAnswer: Answer = {
    questionId: 'FEV_006',
    answer: joinedString,
    selectedChoices: selectedChoices
  };

  assert.strictEqual(savedAnswer.answer, 'Cough, Fever, Sore throat');
  assert.deepStrictEqual(savedAnswer.selectedChoices, ['Cough', 'Fever', 'Sore throat']);

  // Recovery when selectedChoices is missing (backward compatibility)
  const legacyAnswer: Answer = {
    questionId: 'FEV_006',
    answer: 'Cough, Fever, Sore throat'
  };
  const recovered = legacyAnswer.selectedChoices || legacyAnswer.answer.split(',').map(s => s.trim());
  assert.deepStrictEqual(recovered, ['Cough', 'Fever', 'Sore throat']);
});

// -------------------------------------------------------------
// TEST SUITE 5: Branching Evaluation Compatibility
// -------------------------------------------------------------
test('5.1 Branching matches both English ("yes") and Hindi ("Haan", "हाँ") answers', () => {
  const branchConfig = { yes: 'NEXT_YES', no: 'NEXT_NO' };

  function evaluateBranch(storedAnswer: Answer): string {
    const ansToEvaluate = storedAnswer.normalizedEnglishText || storedAnswer.answer;
    const ansNormalized = ansToEvaluate.toLowerCase();
    
    for (const [key, nextQ] of Object.entries(branchConfig)) {
      const keyLower = key.toLowerCase();
      const regex = new RegExp(`\\b${keyLower}\\b`, 'i');
      const isAffirmative = keyLower === 'yes' && (
        ansNormalized === 'yes' || ansNormalized === 'haan' || ansNormalized === 'हाँ' || 
        ansNormalized === 'होय' || ansNormalized === 'hoy' || ansNormalized === 'true' ||
        /\b(yes|haan|hoy)\b/i.test(ansNormalized)
      );
      const isNegative = keyLower === 'no' && (
        ansNormalized === 'no' || ansNormalized === 'nahin' || ansNormalized === 'नहीं' || 
        ansNormalized === 'नाही' || ansNormalized === 'nahi' || ansNormalized === 'false' ||
        /\b(no|nahin|nahi)\b/i.test(ansNormalized)
      );

      if (ansNormalized === keyLower || regex.test(ansNormalized) || isAffirmative || isNegative) {
        return nextQ;
      }
    }
    return 'DEFAULT_NEXT';
  }

  // Test 1: Standard English
  assert.strictEqual(evaluateBranch({ questionId: 'q', answer: 'Yes', normalizedEnglishText: 'Yes' }), 'NEXT_YES');
  assert.strictEqual(evaluateBranch({ questionId: 'q', answer: 'No', normalizedEnglishText: 'No' }), 'NEXT_NO');

  // Test 2: Hindi with normalizedEnglishText
  assert.strictEqual(evaluateBranch({ questionId: 'q', answer: 'Haan', normalizedEnglishText: 'Yes' }), 'NEXT_YES');
  assert.strictEqual(evaluateBranch({ questionId: 'q', answer: 'Nahin', normalizedEnglishText: 'No' }), 'NEXT_NO');

  // Test 3: Legacy Hindi WITHOUT normalizedEnglishText
  assert.strictEqual(evaluateBranch({ questionId: 'q', answer: 'Haan' }), 'NEXT_YES');
  assert.strictEqual(evaluateBranch({ questionId: 'q', answer: 'हाँ' }), 'NEXT_YES');
  assert.strictEqual(evaluateBranch({ questionId: 'q', answer: 'Nahin' }), 'NEXT_NO');
  assert.strictEqual(evaluateBranch({ questionId: 'q', answer: 'नहीं' }), 'NEXT_NO');

  // Test 4: Marathi
  assert.strictEqual(evaluateBranch({ questionId: 'q', answer: 'Hoy' }), 'NEXT_YES');
  assert.strictEqual(evaluateBranch({ questionId: 'q', answer: 'नाही' }), 'NEXT_NO');
});

console.log('\n=== TEST SUMMARY ===');
console.log(`Passed: ${passed}, Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL QUESTIONNAIRE NORMALIZATION TESTS PASSED SUCCESSFULLY!\n');
}
