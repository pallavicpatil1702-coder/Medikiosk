import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

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
                'userID': '397c0307bb28481ebb0fa62edcbfa0b8', // a known public ID maybe?
                'ulcaApiKey': 'cfd73dcc29-6be5-4bc9-a549-36171ed8203d' // some old public key
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        fs.writeFileSync('out_public.json', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Error:", err);
    }
};

testModelsPipeline();
