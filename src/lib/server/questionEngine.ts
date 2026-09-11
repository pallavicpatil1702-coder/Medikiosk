import fs from 'fs';
import path from 'path';
import { PatientSession, Answer, Question } from '@/lib/types';
import Groq from 'groq-sdk';

// Define the JSON structure
interface QuestionBank {
  modules: Record<string, Module>;
  universal_ayurveda_context: any[];
  second_visit: any;
  system_actions: Record<string, string>;
}

interface Module {
  display_name: string;
  entry_question: string;
  questions: any[];
}

export async function processQuestionEngine(session: PatientSession) {
  console.log('[QuestionEngine] request received');
  
  const jsonPath = path.join(process.cwd(), 'src', 'lib', 'medikiosk_question_bank.json');
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const questionBank: QuestionBank = JSON.parse(rawData);

  let activeModules = session.activeModules || [];
  let completedModules = session.completedModules || [];
  let newAnswers = [...(session.answers || [])];
  let knownFacts = [...(session.knownFacts || [])];

  // If no active modules and no completed modules, we are identifying the modules
  if (activeModules.length === 0 && completedModules.length === 0) {
    const clarificationAnswers = newAnswers.filter(a => a.moduleId === 'clarification');
    const fullContext = [session.chiefComplaint, ...clarificationAnswers.map(a => a.answer)].filter(Boolean).join('. ');

    if (clarificationAnswers.length >= 2) {
      // Maximum clarification attempts reached. Show manual selection.
      const hasManualSelection = newAnswers.find(a => a.questionId === 'MANUAL_SELECT_001');
      if (!hasManualSelection) {
        console.log('[QuestionEngine] Max clarification attempts reached. Falling back to manual selection.');
        return {
          action: 'CONTINUE',
          question: {
            id: 'MANUAL_SELECT_001',
            text: {
              en: 'Please specify the affected area:',
              hi: 'कृपया प्रभावित क्षेत्र बताएं:',
              mr: 'कृपया प्रभावित भाग सांगा:'
            },
            type: 'single',
            options: ['Headache / Head', 'Chest Pain', 'Abdominal Pain / Stomach', 'Back Pain', 'Joint Pain', 'Fever', 'Cough / Breathing', 'Vomiting / Diarrhea', 'Other / General']
          },
          activeModules,
          completedModules,
          newAnswers,
          knownFacts
        };
      }
    }

    console.log('[QuestionEngine] Identifying modules via AI for context:', fullContext);
    const result = await resolveComplaintContext(fullContext, questionBank);
    
    if (result.needsClarification && result.clarificationQuestion && clarificationAnswers.length < 2) {
       console.log('[QuestionEngine] AI requests clarification:', result.clarificationQuestion.text);
       return {
         action: 'CONTINUE',
         question: result.clarificationQuestion,
         activeModules,
         completedModules,
         newAnswers,
         knownFacts
       };
    }
    
    // Add valid identified modules
    activeModules = result.modules.filter((m: string) => questionBank.modules[m]);
    console.log('[QuestionEngine] AI classification - identified modules:', activeModules);
    console.log('[QuestionEngine] AI extracted facts:', result.extractedAnswers);
    
    if (activeModules.length === 0) {
      console.log('[QuestionEngine] Fallback: No modules identified, using generic or ending');
    }

    // 2. Pre-fill any answers the AI extracted into knownFacts (not newAnswers)
    for (const fact of result.extractedAnswers) {
      if (!knownFacts.find(a => a.questionId === fact.questionId) && !newAnswers.find(a => a.questionId === fact.questionId)) {
        knownFacts.push({
          questionId: fact.questionId,
          moduleId: fact.moduleId,
          answer: fact.answer,
          inputMethod: 'text', // Inferred from chief complaint
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  console.log('[QuestionEngine] activeModules:', activeModules);
  console.log('[QuestionEngine] completedModules:', completedModules);
  console.log('[QuestionEngine] actual patient answers:', newAnswers.map(a => `${a.questionId}: ${a.answer}`));
  console.log('[QuestionEngine] AI knownFacts:', knownFacts.map(a => `${a.questionId}: ${a.answer}`));

  return deterministicTraverse(activeModules, completedModules, newAnswers, knownFacts, questionBank);
}

function deterministicTraverse(activeModules: string[], completedModules: string[], answers: Answer[], knownFacts: Answer[], questionBank: QuestionBank) {
  // If we are out of standard modules, check Ayurveda
  if (activeModules.length === 0) {
    // Check if we need to do Ayurveda
    if (!completedModules.includes('ayurveda')) {
      activeModules = ['ayurveda'];
      console.log('[QuestionEngine] Moving to Ayurveda module');
    } else {
      console.log('[QuestionEngine] All modules and Ayurveda completed');
      return { action: 'MODULE_END', activeModules, completedModules, newAnswers: answers, knownFacts };
    }
  }

  const currentModuleId = activeModules[0];
  let currentQuestionId: string | null = null;
  let moduleQuestions: any[] = [];

  if (currentModuleId === 'ayurveda') {
    currentQuestionId = 'ALLERGY_001';
    moduleQuestions = questionBank.universal_ayurveda_context;
  } else {
    currentQuestionId = questionBank.modules[currentModuleId].entry_question;
    moduleQuestions = questionBank.modules[currentModuleId].questions;
  }

  console.log(`[QuestionEngine] Traversing module: ${currentModuleId}, starting from ${currentQuestionId}`);

  // Traverse down the module based on answers
  while (currentQuestionId) {
    if (currentQuestionId === 'MODULE_END') {
      console.log(`[QuestionEngine] Reached MODULE_END for ${currentModuleId}`);
      // Move to next module
      completedModules = [...completedModules, currentModuleId];
      activeModules = activeModules.slice(1);
      return deterministicTraverse(activeModules, completedModules, answers, knownFacts, questionBank);
    }
    
    if (currentQuestionId === 'URGENT_001') {
      console.log(`[QuestionEngine] Reached URGENT_001`);
      return { action: 'URGENT_001', activeModules, completedModules, newAnswers: answers, knownFacts };
    }

    const qDef = moduleQuestions.find(q => q.id === currentQuestionId);
    if (!qDef) {
      console.log(`[QuestionEngine] ERROR: Question ${currentQuestionId} not found in module ${currentModuleId}`);
      // Safety break
      break;
    }

    // 1. Check if patient explicitly answered this
    let existingAnswer = answers.find(a => a.questionId === currentQuestionId);
    let fromKnownFact = false;

    // 2. If not, check if AI confidently extracted this from the chief complaint
    if (!existingAnswer) {
      const knownFact = knownFacts.find(a => a.questionId === currentQuestionId);
      if (knownFact) {
        existingAnswer = knownFact;
        fromKnownFact = true;
      }
    }
    
    if (existingAnswer) {
      if (fromKnownFact) {
         console.log(`[QuestionEngine] AUTO_ANSWER_DETECTED: Question ${currentQuestionId} skipped via knownFacts: ${existingAnswer.answer}`);
      } else {
         console.log(`[QuestionEngine] Question ${currentQuestionId} already answered with: ${existingAnswer.answer}`);
      }
      // Evaluate branching
      if (qDef.branch) {
        // e.g. branch: { "yes": "FEV_004", "no": "FEV_005" }
        // We normalize answer to lowercase for branch matching
        const ansNormalized = existingAnswer.answer.toLowerCase();
        let branched = false;
        for (const [key, nextQ] of Object.entries(qDef.branch)) {
          const keyLower = key.toLowerCase();
          // Match exactly, or if it's a multi-word answer, check if it contains the key as a discrete word
          const regex = new RegExp(`\\b${keyLower}\\b`, 'i');
          if (ansNormalized === keyLower || regex.test(ansNormalized)) {
            console.log(`[QuestionEngine] Branch matched '${key}', next question: ${nextQ}`);
            currentQuestionId = nextQ as string;
            branched = true;
            break;
          }
        }
        if (!branched) {
           currentQuestionId = qDef.next || 'MODULE_END';
           console.log(`[QuestionEngine] No branch matched, defaulting to next: ${currentQuestionId}`);
        }
      } else if (qDef.next) {
        currentQuestionId = qDef.next;
        console.log(`[QuestionEngine] Proceeding to next: ${currentQuestionId}`);
      } else {
        currentQuestionId = 'MODULE_END';
        console.log(`[QuestionEngine] No next or branch, defaulting to MODULE_END`);
      }
    } else {
      console.log(`[QuestionEngine] Question ${currentQuestionId} is unanswered. Returning it to client.`);
      // Unanswered question! Return it to the client.
      const formattedQuestion: Question = {
        id: qDef.id,
        text: qDef.text,
        type: qDef.type,
        options: qDef.options,
        branch: qDef.branch,
        next: qDef.next,
        red_flag: qDef.red_flag
      };
      
      console.log('[QuestionEngine] selected next question:', formattedQuestion.id);
      return {
        action: 'CONTINUE',
        question: formattedQuestion,
        activeModules,
        completedModules,
        newAnswers: answers,
        knownFacts
      };
    }
  }

  console.log(`[QuestionEngine] Exited while loop without returning, returning MODULE_END`);
  return { action: 'MODULE_END', activeModules, completedModules, newAnswers: answers, knownFacts };
}

async function resolveComplaintContext(complaintContext: string, questionBank: QuestionBank) {
  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY || '',
  });

  // We must provide the AI with the ACTUAL questions for the modules so it can accurately extract facts!
  const availableModulesInfo = Object.keys(questionBank.modules).map(key => {
    return {
      id: key,
      name: questionBank.modules[key].display_name,
      questions: questionBank.modules[key].questions.map(q => ({
        id: q.id,
        text: q.text.en || q.text,
        type: q.type
      }))
    };
  });

  const prompt = `You are a medical intake routing assistant.
Patient's Complaint Context: "${complaintContext}"

Available Modules and their questions:
${JSON.stringify(availableModulesInfo, null, 2)}

Instructions:
1. Analyze the complaint context. Is it a SPECIFIC complaint (e.g., chest pain, productive cough, stomach ache, headache, "pet me dard") or a GENERIC/AMBIGUOUS complaint (e.g., "pain", "vedna", "swelling", "weakness", "dard") where the body location or exact nature is missing?
2. DO NOT route to a specific module if the location is ambiguous. For example, "pain" could be chest, abdominal, back, or joint. You must clarify if location is unspecified. But if a specific location is mentioned (like "pet", "stomach", "head", "chest"), DO NOT ask for clarification.
3. If the complaint is ambiguous/missing context, set "needsClarification": true, "confidence": "low", and provide a "clarificationQuestion" (id: "CLARIFY_001", type: "free_text") asking for the missing context in English, Hindi, and Marathi.
4. If the complaint context is specific enough (or clarification was provided resolving ambiguity), set "needsClarification": false, "confidence": "high", and identify the relevant module IDs in the "modules" array.
5. If the patient explicitly provided specific answers that map to questions in the identified modules (e.g. if they said "stomach ache", extract "stomach" for the "Where is the pain" question), extract them into the "extractedAnswers" array (with questionId, moduleId, and answer text). This is crucial to avoid asking redundant questions. DO NOT guess or hallucinate answers that were not mentioned.

Output ONLY a JSON object:
{
  "complaint": "string",
  "location": "string | null",
  "needsClarification": boolean,
  "confidence": "high | low",
  "clarificationQuestion": {
    "id": "CLARIFY_001",
    "text": {
      "en": "Where is the pain?",
      "hi": "दर्द कहाँ है?",
      "mr": "वेदना कुठे आहे?"
    },
    "type": "text"
  },
  "modules": ["chest_pain"],
  "extractedAnswers": []
}`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama3-70b-8192',
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const text = chatCompletion.choices[0]?.message?.content || '{}';
    
    // Safely extract JSON in case the model wraps it in markdown
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (jsonMatch && jsonMatch[1]) {
      jsonStr = jsonMatch[1];
    } else {
      const braceIndex = text.indexOf('{');
      if (braceIndex >= 0) {
        jsonStr = text.substring(braceIndex);
        const lastBraceIndex = jsonStr.lastIndexOf('}');
        if (lastBraceIndex >= 0) {
          jsonStr = jsonStr.substring(0, lastBraceIndex + 1);
        }
      }
    }

    const parsed = JSON.parse(jsonStr);
    
    if (parsed.clarificationQuestion) {
      parsed.clarificationQuestion.type = 'free_text';
    }

    return {
      needsClarification: parsed.needsClarification || false,
      clarificationQuestion: parsed.clarificationQuestion || null,
      modules: parsed.modules || [],
      extractedAnswers: parsed.extractedAnswers || []
    };
  } catch (error) {
    console.error('Failed to parse AI response for module identification:', error);
    
    // Fallback: simple text matching and ambiguity detection
    const fallbackModules: string[] = [];
    const textLower = complaintContext.toLowerCase();
    
    // AMBIGUITY CHECK (Fallback)
    const isGenericPain = (textLower.includes('pain') || textLower.includes('dard') || textLower.includes('vedna'));
    const hasLocation = textLower.includes('chest') || textLower.includes('pet') || textLower.includes('stomach') || textLower.includes('sir') || textLower.includes('head') || textLower.includes('kamar') || textLower.includes('back') || textLower.includes('potat') || textLower.includes('chhatit') || textLower.includes('dokyat') || textLower.includes('kambaret') || textLower.includes('sandhyat') || textLower.includes('gudghyat') || textLower.includes('paat') || textLower.includes('gale') || textLower.includes('throat');
    
    if (isGenericPain && !hasLocation) {
       return {
         needsClarification: true,
         clarificationQuestion: {
           id: "CLARIFY_001",
           text: {
             en: "Where are you experiencing the pain?",
             hi: "आपको दर्द कहाँ हो रहा है?",
             mr: "तुम्हाला वेदना कुठे होत आहे?"
           },
           type: "text"
         },
         modules: [],
         extractedAnswers: []
       };
    }
    
    if (textLower.includes('khansi') || textLower.includes('cough')) fallbackModules.push('cough');
    if (textLower.includes('bukhar') || textLower.includes('fever')) fallbackModules.push('fever');
    if ((textLower.includes('dard') || textLower.includes('pain') || textLower.includes('vedna') || textLower.includes('chest')) && (textLower.includes('chest') || textLower.includes('seene') || textLower.includes('chhatit'))) fallbackModules.push('chest_pain');
    if ((textLower.includes('dard') || textLower.includes('pain') || textLower.includes('vedna')) && (textLower.includes('pet') || textLower.includes('stomach') || textLower.includes('potat'))) fallbackModules.push('abdominal_pain');
    if ((textLower.includes('dard') || textLower.includes('pain') || textLower.includes('vedna')) && (textLower.includes('sir') || textLower.includes('head') || textLower.includes('dokyat'))) fallbackModules.push('headache');
    
    return { needsClarification: false, modules: fallbackModules, extractedAnswers: [] };
  }
}
