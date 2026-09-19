import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const apiKey = envConfig.BHASHINI_API_KEY;

const audioBase64 = fs.readFileSync('dummy_base64.txt', 'utf8').trim();

const testBhashini = async () => {
    console.log("Testing ASR with pipelineId...");
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
