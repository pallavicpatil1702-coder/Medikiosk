const Groq = require('groq-sdk');
require('dotenv').config({ path: './.env.local' });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
async function test() {
  try {
    const list = await groq.models.list();
    console.log('Available models:', list.data.map(m => m.id));
  } catch (err) {
    console.error('List models error:', err);
  }
}
test();
