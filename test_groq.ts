import fs from 'fs';
import path from 'path';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const questionBank = JSON.parse(fs.readFileSync('src/lib/medikiosk_question_bank.json', 'utf8'));

async function run() {
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY || '',
    });

    const complaintContext = "I have fever";
    const availableModulesInfo = Object.keys(questionBank.modules).map(key => {
      return {
        id: key,
        name: questionBank.modules[key].display_name,
        questions: questionBank.modules[key].questions.map((q: any) => ({
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

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'openai/gpt-oss-120b',
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    console.log(chatCompletion.choices[0]?.message?.content);
}

run();
