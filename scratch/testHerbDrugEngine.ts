import { generateMedicationSafetyAlerts } from '../src/lib/clinical/herbDrugSafetyEngine';
import type { PatientSession } from '../src/lib/types';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runTests() {
  const tests: { name: string; session: Partial<PatientSession> }[] = [
    {
      name: "Warfarin + Ginkgo",
      session: {
        answers: [{ questionId: 'q1', questionText: 'Meds?', answer: 'I take warfarin' }],
        clinicalSummary: { medications: 'ginkgo biloba', history: { chiefComplaint: 'checkup', duration: '', associatedSymptoms: [] }, status: 'draft', allergies: '', pastHistory: '', vitals: '', investigationResults: '' }
      } as any
    },
    {
      name: "Metformin + Bitter Melon",
      session: {
        clinicalSummary: { medications: 'metformin, karela juice', history: { chiefComplaint: '', duration: '', associatedSymptoms: [] }, status: 'draft', allergies: '', pastHistory: '', vitals: '', investigationResults: '' }
      } as any
    },
    {
      name: "Diazepam + Ashwagandha",
      session: {
        extractedData: { medicines: ['diazepam', 'ashwagandha tablet'], tests: [], redFlags: [], missingInformation: [] },
        clinicalSummary: { history: { chiefComplaint: '', duration: '', associatedSymptoms: [] }, medications: '', status: 'draft', allergies: '', pastHistory: '', vitals: '', investigationResults: '' }
      } as any
    },
    {
      name: "Duplicate - Crocin + Paracetamol",
      session: {
        answers: [{ questionId: '1', questionText: 'Meds?', answer: 'crocin and paracetamol' }],
        clinicalSummary: { history: { chiefComplaint: '', duration: '', associatedSymptoms: [] }, medications: '', status: 'draft', allergies: '', pastHistory: '', vitals: '', investigationResults: '' }
      } as any
    },
    {
      name: "Safe - No interactions",
      session: {
        answers: [{ questionId: '1', questionText: 'Meds?', answer: 'vitamin C' }],
        clinicalSummary: { history: { chiefComplaint: '', duration: '', associatedSymptoms: [] }, medications: '', status: 'draft', allergies: '', pastHistory: '', vitals: '', investigationResults: '' }
      } as any
    }
  ];

  console.log("Starting Herb-Drug Safety Engine Tests...");
  for (const test of tests) {
    console.log(`\n--- Test: ${test.name} ---`);
    try {
      const alerts = await generateMedicationSafetyAlerts(test.session as PatientSession);
      console.log(`Found ${alerts.length} alert(s):`);
      alerts.forEach(a => console.log(` - [${a.severity.toUpperCase()}] ${a.itemA} + ${a.itemB}: ${a.concern}`));
    } catch (e: any) {
      console.error('Error:', e.message);
    }
  }
}

runTests().catch(console.error);
