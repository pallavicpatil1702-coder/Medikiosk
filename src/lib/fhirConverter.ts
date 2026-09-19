import type { FHIRResource, PatientSession, RedFlag, MedicalDocument } from './types';

/**
 * Generates an ABDM-compliant FHIR R4 resource bundle from a REAL Firestore patient session.
 * Does NOT hardcode any patient details.
 */
export function generateRealFHIRResources(session: any): FHIRResource[] {
  const patientData = session.patient || {};
  const patientId = session.patientId || session.id || 'unknown-patient';
  const sessionId = session.id || 'unknown-session';
  const generatedAt = session.createdAt?.toDate?.()?.toISOString() 
    || session.createdAt 
    || new Date().toISOString();

  const resources: FHIRResource[] = [];

  // 1. FHIR Patient Resource
  const birthDate = patientData.age && patientData.age > 0
    ? new Date(Date.now() - patientData.age * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    : undefined;

  resources.push({
    resourceType: 'Patient',
    id: `patient-${patientId}`,
    identifier: [
      {
        system: 'https://healthid.ndhm.gov.in',
        type: { text: 'ABHA' },
        value: patientData.abhaId || `kiosk-temp-${patientId.slice(0, 8)}`
      }
    ],
    name: [
      {
        use: 'official',
        text: patientData.name || 'Walk-in Patient',
        family: (patientData.name || '').split(' ').slice(1).join(' ') || undefined,
        given: [(patientData.name || '').split(' ')[0] || 'Patient']
      }
    ],
    gender: (patientData.gender || '').toLowerCase() === 'male' 
      ? 'male' 
      : (patientData.gender || '').toLowerCase() === 'female' 
      ? 'female' 
      : 'other',
    birthDate,
    telecom: patientData.contact 
      ? [{ system: 'phone', value: patientData.contact }] 
      : undefined
  });

  // 2. Encounter / Triage Session
  resources.push({
    resourceType: 'Encounter',
    id: `encounter-${sessionId}`,
    status: session.status === 'confirmed' ? 'finished' : 'in-progress',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'Ambulatory / OPD Intake'
    },
    subject: { reference: `Patient/patient-${patientId}` },
    period: { start: generatedAt },
    priority: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActPriority',
          code: session.calculatedPriority === 'EMERGENCY' ? 'EM' : session.calculatedPriority === 'HIGH' ? 'UR' : 'R',
          display: session.calculatedPriority || 'NORMAL'
        }
      ]
    },
    serviceProvider: { display: 'MediKiosk OPD Telehealth Station' }
  });

  // 3. Observation - Chief Complaint
  if (session.chiefComplaint) {
    resources.push({
      resourceType: 'Observation',
      id: `obs-complaint-${sessionId}`,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'exam',
              display: 'Exam'
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '422843007',
            display: 'Chief complaint'
          }
        ],
        text: 'Chief Complaint'
      },
      subject: { reference: `Patient/patient-${patientId}` },
      effectiveDateTime: generatedAt,
      valueString: session.bodyLocations && session.bodyLocations.length > 0
        ? `${session.chiefComplaint} (Affected Areas: ${session.bodyLocations.map((b: any) => b.name || b.id).join(', ')})`
        : session.chiefComplaint
    });
  }

  // 4. QuestionnaireResponse - Actual Patient Intake Answers
  if (Array.isArray(session.answers) && session.answers.length > 0) {
    resources.push({
      resourceType: 'QuestionnaireResponse',
      id: `qr-${sessionId}`,
      status: 'completed',
      subject: { reference: `Patient/patient-${patientId}` },
      authored: generatedAt,
      item: session.answers.map((ans: any, idx: number) => ({
        linkId: ans.questionId || `q-${idx + 1}`,
        text: ans.questionText || ans.questionId || `Clinical Question ${idx + 1}`,
        answer: [
          {
            valueString: ans.answer || 'Not answered'
          }
        ]
      }))
    });
  }

  // 5. Condition - Detected Clinical Red Flags
  if (Array.isArray(session.redFlags) && session.redFlags.length > 0) {
    session.redFlags.forEach((rf: RedFlag, index: number) => {
      resources.push({
        resourceType: 'Condition',
        id: `cond-redflag-${sessionId}-${index + 1}`,
        clinicalStatus: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }]
        },
        verificationStatus: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'provisional' }]
        },
        category: [
          {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'problem-list-item' }],
            text: 'Deterministic Red Flag Alert'
          }
        ],
        severity: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: rf.severity === 'high' ? '24484000' : '6736007',
              display: rf.severity === 'high' ? 'Severe' : 'Moderate'
            }
          ]
        },
        code: { text: rf.type || 'Clinical Warning' },
        subject: { reference: `Patient/patient-${patientId}` },
        note: [{ text: rf.description }]
      });
    });
  }

  // 6. DiagnosticReport / DocumentReference - Uploaded Documents & Extracted OCR
  if (Array.isArray(session.documents) && session.documents.length > 0) {
    session.documents.forEach((doc: MedicalDocument, docIdx: number) => {
      resources.push({
        resourceType: 'DiagnosticReport',
        id: `report-${sessionId}-${docIdx + 1}`,
        status: 'final',
        category: [
          {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'LAB' }],
            text: doc.fileType || 'Medical Report'
          }
        ],
        code: { text: doc.fileName || 'Patient Clinical Record' },
        subject: { reference: `Patient/patient-${patientId}` },
        effectiveDateTime: doc.uploadedAt || generatedAt,
        conclusion: doc.extractedData 
          ? `Extracted ${doc.extractedData.tests?.length || 0} lab findings` 
          : 'Report attached without automated extraction'
      });
    });
  }

  // 7. ClinicalImpression / Physician Note
  if (session.doctorDecision || session.doctorNote) {
    resources.push({
      resourceType: 'ClinicalImpression',
      id: `impression-${sessionId}`,
      status: 'completed',
      subject: { reference: `Patient/patient-${patientId}` },
      effectiveDateTime: session.doctorReviewedAt || new Date().toISOString(),
      assessor: { display: session.doctorEmail || session.doctorUid || 'Attending Physician' },
      description: session.doctorNote || `Consultation ${session.doctorDecision}`,
      summary: `Decision: ${session.doctorDecision || 'Reviewed'}`
    });
  }

  return resources;
}
