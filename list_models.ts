import fs from 'fs';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
dotenv.config({ path: '.env.local' });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
groq.models.list().then(m => console.log(m.data.map(d => d.id).join('\n')));
