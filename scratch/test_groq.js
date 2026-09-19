import fs from 'fs';

async function testGroqAPI() {
  console.log('Testing Groq Summary API via mock fetch...');
  const payload = {
    chiefComplaint: 'तीव्र ताप आणि डोकेदुखी (Severe fever and headache)',
    answers: [
      'Have you taken any medicine?: pata nahi',
      'Does it hurt when you breathe?: Yes',
      'Any past medical history?: No',
      'Describe the pain: mala don divasapasun chhatit traas ahe (chest pain since 2 days)'
    ],
    knownFacts: [
      'fever: 102F'
    ],
    bodyLocations: [
      'Chest (front midline)',
      'Head (front bilateral)'
    ],
    redFlags: [
      'High Fever Alert: Temperature over 101F',
      'Chest Pain Alert: Patient reported chest pain'
    ],
    extractedData: 'Lab Report: Hemoglobin 12g/dL, WBC 15000'
  };

  const response = await fetch('http://localhost:3000/api/ai/generatePhysicianSummary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'TEST_SESSION_123'
    })
  });
  
  // Actually we need to test the Groq prompt directly since we don't have a real TEST_SESSION in DB.
}

testGroqAPI();
