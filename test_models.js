import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const apiKey = envConfig.BHASHINI_API_KEY;

const testModelsPipeline = async () => {
    const payload = {
        "pipelineTasks": [
            { "taskType": "asr" },
            { "taskType": "translation" }
        ],
        "pipelineRequestConfig": {
            "pipelineId": "64392f96daac500b55c543cd"
        }
    };

    try {
        const response = await fetch('https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'userID': '36da4dc760774a3da787ea25316db53a', // Dummy user ID to pass the "exists" check
                'ulcaApiKey': apiKey
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        fs.writeFileSync('out.json', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Error:", err);
    }
};

testModelsPipeline();
