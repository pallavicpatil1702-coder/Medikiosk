const Groq = require('groq-sdk');
require('dotenv').config({ path: './.env.local' });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
async function test() {
  try {
    const res = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'Output JSON: {"summary": "test"}' },
        { role: 'user', content: 'Hemoglobin 13.5 g/dL' }
      ],
      model: 'groq/compound',
      response_format: { type: 'json_object' }
    });
    console.log('Success:', res.choices[0].message.content);
  } catch (err) {
    console.log('Groq json_object error:', err.status, err.message);
  }
}
test();
