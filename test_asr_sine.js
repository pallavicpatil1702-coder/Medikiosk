import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const apiKey = envConfig.BHASHINI_API_KEY;

// Base64 of a short audio "Hello" in Hindi: "नमस्ते"
// I will just use a real valid base64 audio sample that is known to work.
// Since I don't have one, I will try to use the `bhashiniClient.ts` as it was written.
// Wait, actually, let me use a very small base64 string of a real wav file.
// Let's create a 1 second PCM wav file correctly.
const sampleRate = 16000;
const duration = 1; // 1 second
const numSamples = sampleRate * duration;
const buffer = Buffer.alloc(44 + numSamples * 2);

// Write WAV header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + numSamples * 2, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // Subchunk1Size
buffer.writeUInt16LE(1, 20); // AudioFormat (PCM)
buffer.writeUInt16LE(1, 22); // NumChannels
buffer.writeUInt32LE(sampleRate, 24); // SampleRate
buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
buffer.writeUInt16LE(2, 32); // BlockAlign
buffer.writeUInt16LE(16, 34); // BitsPerSample
buffer.write('data', 36);
buffer.writeUInt32LE(numSamples * 2, 40);

// Fill with some sine wave data so it's not silent
for (let i = 0; i < numSamples; i++) {
    const val = Math.floor(Math.sin(i * 0.05) * 10000);
    buffer.writeInt16LE(val, 44 + i * 2);
}

const audioBase64 = buffer.toString('base64');

const testBhashini = async () => {
    console.log("Testing ASR with valid Sine Wave base64...");
    const payload = {
        "pipelineTasks": [
            {
                "taskType": "asr",
                "config": {
                    "language": {
                        "sourceLanguage": "hi"
                    },
                    "audioFormat": "wav",
                    "samplingRate": 16000
                }
            },
            {
                "taskType": "translation",
                "config": {
                    "language": {
                        "sourceLanguage": "hi",
                        "targetLanguage": "en"
                    }
                }
            }
        ],
        "pipelineRequestConfig": {
            "pipelineId": "64392f96daac500b55c543cd"
        },
        "inputData": {
            "audio": [
                {
                    "audioContent": audioBase64
                }
            ]
        }
    };

    try {
        const response = await fetch('https://dhruva-api.bhashini.gov.in/services/inference/pipeline', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': apiKey
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log("HTTP Status:", response.status);
        if (response.status !== 200) {
            console.log("Error Response:", JSON.stringify(data, null, 2));
        } else {
            console.log("Success! Pipeline worked.");
            console.log("Response:", JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error("Error:", err);
    }
};

testBhashini();
