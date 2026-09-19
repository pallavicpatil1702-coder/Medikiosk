import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const apiKey = envConfig.BHASHINI_API_KEY;

if (!apiKey) {
    console.error("No BHASHINI_API_KEY in .env.local");
    process.exit(1);
}

const testBhashini = async () => {
    console.log("Testing Bhashini Inference Pipeline API...");
    
    // Test payload without serviceId
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
        "inputData": {
            "audio": [
                {
                    "audioContent": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=" // dummy 16khz silent wav
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
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Network Error:", err);
    }
};

testBhashini();
