import 'dotenv/config';
import { generateAyurvedaReferences } from './src/lib/clinical/ayurvedaReferenceEngine.js'; // Note we are running via ts-node or compiled JS, we'll use ts-node

async function runTests() {
  const tests = [
    {
      name: "TEST 1: Chest pain only (No Amlapitta)",
      session: {
        bodyLocations: [{ name: "Chest", id: "chest", view: "front" }],
        chiefComplaint: "chest pain",
        answers: [],
        redFlags: []
      }
    },
    {
      name: "TEST 2: Chest discomfort + burning + sour regurgitation (Possible Amlapitta)",
      session: {
        bodyLocations: [{ name: "Chest", id: "chest", view: "front" }],
        chiefComplaint: "chest discomfort",
        answers: [{ questionId: "q1", answer: "burning sensation and sour regurgitation" }],
        redFlags: []
      }
    },
    {
      name: "TEST 3: Chest pain + sweating + breathlessness (Red flag -> Urgent review -> NO Amlapitta)",
      session: {
        bodyLocations: [{ name: "Chest", id: "chest", view: "front" }],
        chiefComplaint: "severe chest pain",
        answers: [{ questionId: "q1", answer: "sweating and breathlessness" }],
        redFlags: [{ id: "rf1", type: "Cardiac", description: "Severe chest pain", severity: "high", detectedAt: "now" }]
      }
    },
    {
      name: "TEST 4: Joint pain + stiffness",
      session: {
        bodyLocations: [{ name: "Knee", id: "knee", view: "front" }],
        chiefComplaint: "joint pain",
        answers: [{ questionId: "q1", answer: "joint stiffness in the morning" }],
        redFlags: []
      }
    },
    {
      name: "TEST 5: Fever",
      session: {
        bodyLocations: [{ name: "General Body", id: "body", view: "front" }],
        chiefComplaint: "fever",
        answers: [{ questionId: "q1", answer: "high temperature" }],
        redFlags: []
      }
    },
    {
      name: "TEST 6: Cough",
      session: {
        bodyLocations: [{ name: "Chest", id: "chest", view: "front" }],
        chiefComplaint: "cough",
        answers: [{ questionId: "q1", answer: "khasi" }],
        redFlags: []
      }
    },
    {
      name: "TEST 7: Constipation explicitly reported",
      session: {
        bodyLocations: [{ name: "Lower Abdomen", id: "lower_abdomen", view: "front" }],
        chiefComplaint: "stomach ache",
        answers: [{ questionId: "q1", answer: "hard stool and constipation" }],
        redFlags: []
      }
    },
    {
      name: "TEST 8: 'Pata nahi' -> Unknown -> never convert to 'No'",
      session: {
        bodyLocations: [{ name: "Head", id: "head", view: "front" }],
        chiefComplaint: "headache",
        answers: [{ questionId: "q1", answer: "pata nahi" }],
        redFlags: []
      }
    },
    {
      name: "TEST 9: Multiple complaints",
      session: {
        bodyLocations: [{ name: "General Body", id: "body", view: "front" }, { name: "Chest", id: "chest", view: "front" }],
        chiefComplaint: "fever and cough",
        answers: [{ questionId: "q1", answer: "high temperature and coughing" }],
        redFlags: []
      }
    },
    {
      name: "TEST 10: Body Map location selected but no supporting symptom",
      session: {
        bodyLocations: [{ name: "Upper Abdomen", id: "upper_abdomen", view: "front" }],
        chiefComplaint: "stomach feels tight",
        answers: [{ questionId: "q1", answer: "no burning, no acidity" }],
        redFlags: []
      }
    }
  ];

  for (const test of tests) {
    console.log(`\n================================`);
    console.log(`Running: ${test.name}`);
    const refs = await generateAyurvedaReferences(test.session as any);
    console.log(`Result: ${JSON.stringify(refs, null, 2)}`);
  }
}

runTests();
