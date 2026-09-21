import Groq from 'groq-sdk';
import type { PatientSession, MedicationSafetyAlert } from '../types';
import { generateUUID } from '../uuid';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'missing',
});

interface KnowledgeBaseEntry {
  itemA: string[]; // Generic drug name or class
  itemB: string[]; // Herb/Supplement name
  interactionType: 'herb-drug' | 'drug-drug' | 'duplicate';
  severity: 'informational' | 'caution' | 'high_attention';
  concern: string;
  evidenceNote: string;
  source: string;
}

// Deterministic safety prototype knowledge base
const SAFETY_KNOWLEDGE_BASE: KnowledgeBaseEntry[] = [
  {
    itemA: ['warfarin', 'aspirin', 'clopidogrel', 'heparin'],
    itemB: ['ginkgo biloba', 'ginseng', 'garlic', 'ginger', 'turmeric'],
    interactionType: 'herb-drug',
    severity: 'high_attention',
    concern: 'Potential increased bleeding risk.',
    evidenceNote: 'Herbs like Ginkgo and high-dose Garlic/Ginger possess antiplatelet properties that can potentiate anticoagulant/antiplatelet medications.',
    source: 'National Center for Complementary and Integrative Health (NCCIH) / NIH'
  },
  {
    itemA: ['metformin', 'glimepiride', 'gliclazide', 'insulin', 'sitagliptin'],
    itemB: ['bitter melon', 'karela', 'fenugreek', 'methi', 'gymnema', 'gurmar'],
    interactionType: 'herb-drug',
    severity: 'caution',
    concern: 'Potential risk of additive hypoglycemia (low blood sugar).',
    evidenceNote: 'Botanicals like Bitter Melon and Fenugreek may lower blood glucose levels, potentially causing hypoglycemia when combined with antidiabetic drugs.',
    source: 'Memorial Sloan Kettering Cancer Center (MSKCC) - About Herbs'
  },
  {
    itemA: ['diazepam', 'clonazepam', 'lorazepam', 'alprazolam', 'zolpidem'],
    itemB: ['ashwagandha', 'valerian', 'chamomile', 'kava'],
    interactionType: 'herb-drug',
    severity: 'caution',
    concern: 'Potential additive CNS depressant (sedative) effect.',
    evidenceNote: 'Herbs with sedative properties may potentiate the effects of benzodiazepines or other CNS depressants.',
    source: 'Memorial Sloan Kettering Cancer Center (MSKCC)'
  },
  {
    itemA: ['atorvastatin', 'rosuvastatin', 'simvastatin'],
    itemB: ['guggul', 'red yeast rice'],
    interactionType: 'herb-drug',
    severity: 'caution',
    concern: 'Potential increased risk of myopathy or altered lipid effects.',
    evidenceNote: 'Red yeast rice contains natural statins (monacolin K), and Guggul may interact with statin metabolism.',
    source: 'National Center for Complementary and Integrative Health (NCCIH)'
  },
  {
    itemA: ['levothyroxine', 'thyroxine'],
    itemB: ['ashwagandha', 'guggul'],
    interactionType: 'herb-drug',
    severity: 'caution',
    concern: 'Potential alteration of thyroid hormone levels.',
    evidenceNote: 'Ashwagandha and Guggul may stimulate thyroid function, potentially interfering with thyroid replacement therapy dosage.',
    source: 'Memorial Sloan Kettering Cancer Center (MSKCC)'
  }
];

interface NormalizedItem {
  originalName: string;
  normalizedName: string;
  type: 'drug' | 'herb';
}

/**
 * Uses Groq purely to normalize unstructured patient text into standardized medicine and herb generic names.
 * It does NOT evaluate safety or generate alerts.
 */
async function extractAndNormalizeItems(session: PatientSession): Promise<NormalizedItem[]> {
  const patientContext = `
Patient Answers: ${JSON.stringify(session.answers?.map(a => `${a.questionText}: ${a.answer}`) || [])}
Extracted Reports: ${JSON.stringify(session.extractedData?.medicines || [])}
Clinical Summary Meds: ${session.clinicalSummary?.medications || 'None'}
  `;

  const systemPrompt = `You are a medical text normalization assistant.
Your ONLY job is to extract mentions of medications, herbs, and supplements from the patient data and normalize them to their generic English names.

RULES:
1. Output ONLY valid JSON in this exact format:
{
  "items": [
    { "originalName": "patient's exact word (e.g., पैरासिटामोल, thyronorm, methi)", "normalizedName": "generic english name (e.g., paracetamol, levothyroxine, fenugreek)", "type": "drug" | "herb" }
  ]
}
2. Translate Hindi/Marathi/regional names to their standard generic English equivalent.
3. Map brand names to their primary active generic ingredient when confidently known.
4. Do NOT output anything outside the JSON.
5. If no medicines or herbs are found, return { "items": [] }.
6. NEVER infer a medicine from a symptom. ONLY extract explicitly stated items.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: patientContext }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0,
      response_format: { type: 'json_object' }
    });

    const aiContent = completion.choices[0]?.message?.content;
    if (!aiContent) return [];
    
    const parsed = JSON.parse(aiContent);
    return parsed.items || [];
  } catch (error) {
    console.error('Herb-Drug Engine Normalization Error:', error);
    return []; // Return empty gracefully
  }
}

/**
 * Deterministically checks normalized items against the prototype knowledge base.
 */
export async function generateMedicationSafetyAlerts(session: PatientSession): Promise<MedicationSafetyAlert[]> {
  // 1. Normalize items using AI
  const items = await extractAndNormalizeItems(session);
  if (!items || items.length === 0) return [];

  const alerts: MedicationSafetyAlert[] = [];

  // 2. Check for Herb-Drug interactions
  const drugs = items.filter(i => i.type === 'drug');
  const herbs = items.filter(i => i.type === 'herb');

  for (const drug of drugs) {
    const normalizedDrug = drug.normalizedName.toLowerCase();
    
    for (const herb of herbs) {
      const normalizedHerb = herb.normalizedName.toLowerCase();
      
      // Find matching rule
      const rule = SAFETY_KNOWLEDGE_BASE.find(r => 
        r.itemA.some(a => normalizedDrug.includes(a) || a.includes(normalizedDrug)) &&
        r.itemB.some(b => normalizedHerb.includes(b) || b.includes(normalizedHerb))
      );

      if (rule) {
        alerts.push({
          id: generateUUID(),
          itemA: `${drug.originalName} (${drug.normalizedName})`,
          itemB: `${herb.originalName} (${herb.normalizedName})`,
          interactionType: rule.interactionType,
          severity: rule.severity,
          concern: rule.concern,
          evidenceNote: rule.evidenceNote,
          source: rule.source,
          status: 'pending_review',
          createdAt: new Date().toISOString()
        });
      }
    }
  }

  // 3. Check for Duplicate Active Ingredients
  const seenGenerics = new Map<string, string>(); // generic -> original
  for (const drug of drugs) {
    const generic = drug.normalizedName.toLowerCase();
    if (seenGenerics.has(generic) && seenGenerics.get(generic)?.toLowerCase() !== drug.originalName.toLowerCase()) {
      alerts.push({
        id: generateUUID(),
        itemA: seenGenerics.get(generic)!,
        itemB: drug.originalName,
        interactionType: 'duplicate',
        severity: 'caution',
        concern: 'Potential duplicate medication identified.',
        evidenceNote: `Both items appear to contain the same active ingredient (${drug.normalizedName}).`,
        source: 'Automated generic ingredient matching',
        status: 'pending_review',
        createdAt: new Date().toISOString()
      });
    } else {
      seenGenerics.set(generic, drug.originalName);
    }
  }

  return alerts;
}
