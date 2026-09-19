import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const apiKey = envConfig.BHASHINI_API_KEY;

const testFullPipeline = async () => {
    console.log("Step 1: Fetching service config...");
    const configPayload = {
        "pipelineTasks": [
            { "taskType": "asr" },
            { "taskType": "translation" }
        ],
        "pipelineRequestConfig": {
            "pipelineId": "64392f96daac500b55c543cd"
        }
    };

    let asrServiceId = null;
    let translationServiceId = null;
    let callbackUrl = null;

    try {
        const configRes = await fetch('https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': apiKey,
                'ulcaApiKey': apiKey
            },
            body: JSON.stringify(configPayload)
        });

        const configDataArr = await configRes.json();
        const configData = configDataArr[0]; // It's an array!
        
        callbackUrl = configData.pipelineInferenceAPIEndPoint?.callbackUrl;
        
        for (const task of configData.pipelineResponseConfig || []) {
            if (task.taskType === 'asr') {
                const cfg = task.config.find(c => c.language.sourceLanguage === 'hi');
                if (cfg) asrServiceId = cfg.serviceId;
            }
            if (task.taskType === 'translation') {
                const cfg = task.config.find(c => c.language.sourceLanguage === 'hi' && c.language.targetLanguage === 'en');
                if (cfg) translationServiceId = cfg.serviceId;
            }
        }

        console.log("Resolved ASR:", asrServiceId);
        console.log("Resolved Translation:", translationServiceId);
        console.log("Callback:", callbackUrl);

        if (!asrServiceId || !translationServiceId) {
            console.error("Failed to resolve serviceIds");
            return;
        }

        console.log("Step 2: Sending audio to pipeline...");
        const payload = {
            "pipelineTasks": [
                {
                    "taskType": "asr",
                    "config": {
                        "language": { "sourceLanguage": "hi" },
                        "serviceId": asrServiceId,
                        "audioFormat": "wav",
                        "samplingRate": 16000
                    }
                },
                {
                    "taskType": "translation",
                    "config": {
                        "language": { "sourceLanguage": "hi", "targetLanguage": "en" },
                        "serviceId": translationServiceId
                    }
                }
            ],
            "inputData": {
                "audio": [
                    {
                        "audioContent": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
                    }
                ]
            }
        };

        const inferRes = await fetch(callbackUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': apiKey
            },
            body: JSON.stringify(payload)
        });

        const inferData = await inferRes.json();
        console.log("Inference Status:", inferRes.status);
        console.log("Inference Response:", JSON.stringify(inferData, null, 2));

    } catch (err) {
        console.error("Error:", err);
    }
};

testFullPipeline();
