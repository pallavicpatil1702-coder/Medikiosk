import re

with open('src/app/doctor/patient/[id]/page.tsx', 'r') as f:
    content = f.read()

# Add StructuredPhysicianSummary type if needed, but it's part of ClinicalSummary? Wait, it's on PatientSession.
# The page fetches a PatientSession doc from firestore! Let's check line 39: `const data = docSnap.data();`
# Wait, `const loadedSummary: ClinicalSummary = data.clinicalSummary` - but we need `structuredPhysicianSummary`.
# Let's add it to the state. 

# Replace useState
old_state = """  const [summary, setSummary] = useState<ClinicalSummary | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);"""

new_state = """  const [summary, setSummary] = useState<ClinicalSummary | null>(null);
  const [structuredSummary, setStructuredSummary] = useState<any>(null);
  const [summaryStatus, setSummaryStatus] = useState<string>('pending');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);"""

content = content.replace(old_state, new_state)

# Replace local active session check
old_local = """      // 1. Check local active session
      if (session?.clinicalSummary && (session.clinicalSummary.patientId === params.id || session.firestoreSessionId === params.id || (session as any).id === params.id)) {
        setSummary(session.clinicalSummary);
        setConfirmed(session.clinicalSummary.status === 'confirmed');
        setLoading(false);
        return;
      }"""

new_local = """      // 1. Check local active session
      if (session?.clinicalSummary && (session.clinicalSummary.patientId === params.id || session.firestoreSessionId === params.id || (session as any).id === params.id)) {
        setSummary(session.clinicalSummary);
        setStructuredSummary(session.structuredPhysicianSummary || null);
        setSummaryStatus(session.physicianSummaryStatus || 'pending');
        setConfirmed(session.clinicalSummary.status === 'confirmed');
        setLoading(false);
        return;
      }"""

content = content.replace(old_local, new_local)

# Replace firestore fetch
old_fetch = """          const loadedSummary: ClinicalSummary = data.clinicalSummary || {
            id: docSnap.id,
            patientId: data.patientId || data.patient?.id || docSnap.id,
            generatedAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            patient: data.patient || { name: 'Patient', age: 0, gender: 'Unknown', id: docSnap.id, createdAt: new Date().toISOString() },
            history: data.clinicalHistory || {
              chiefComplaint: data.chiefComplaint || 'Intake',
              duration: 'Reported during intake',
              associatedSymptoms: [],
              medicationTaken: 'None reported',
              allergies: 'No known allergy',
              pastMedicalHistory: 'None declared',
              answers: data.answers || []
            },
            medications: 'None reported',
            allergies: 'No known allergy',
            pastHistory: 'Routine intake',
            investigationResults: data.extractedData ? JSON.stringify(data.extractedData) : 'None',
            previousReports: data.documents?.map((d: any) => d.fileName) || [],
            redFlags: data.redFlags || [],
            aiNotes: 'Clinical intake dossier retrieved from Firestore.',
            status: data.status || 'pending'
          };

          setSummary(loadedSummary);
          setConfirmed(data.status === 'confirmed' || data.doctorDecision === 'accepted');"""

new_fetch = """          const loadedSummary: ClinicalSummary = data.clinicalSummary || {
            id: docSnap.id,
            patientId: data.patientId || data.patient?.id || docSnap.id,
            generatedAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            patient: data.patient || { name: 'Patient', age: 0, gender: 'Unknown', id: docSnap.id, createdAt: new Date().toISOString() },
            history: data.clinicalHistory || {
              chiefComplaint: data.chiefComplaint || 'Intake',
              duration: 'Reported during intake',
              associatedSymptoms: [],
              medicationTaken: 'None reported',
              allergies: 'No known allergy',
              pastMedicalHistory: 'None declared',
              answers: data.answers || []
            },
            medications: 'None reported',
            allergies: 'No known allergy',
            pastHistory: 'Routine intake',
            investigationResults: data.extractedData ? JSON.stringify(data.extractedData) : 'None',
            previousReports: data.documents?.map((d: any) => d.fileName) || [],
            redFlags: data.redFlags || [],
            aiNotes: 'Clinical intake dossier retrieved from Firestore.',
            status: data.status || 'pending'
          };

          setSummary(loadedSummary);
          setStructuredSummary(data.structuredPhysicianSummary || null);
          setSummaryStatus(data.physicianSummaryStatus || 'pending');
          setConfirmed(data.status === 'confirmed' || data.doctorDecision === 'accepted');"""

content = content.replace(old_fetch, new_fetch)


old_audio_render = """  const englishSummary = normalizeClinicalSummaryToEnglish(summary);
  const spokenText = buildSpokenClinicalSummary({
    patientName: englishSummary.patient?.name,
    patientAge: englishSummary.patient?.age,
    patientGender: englishSummary.patient?.gender,
    chiefComplaint: englishSummary.history.chiefComplaint,
    duration: englishSummary.history.duration,
    associatedSymptoms: englishSummary.history.associatedSymptoms,
    medications: englishSummary.medications,
    allergies: englishSummary.allergies,
    pastHistory: englishSummary.pastHistory,
    redFlags: englishSummary.redFlags
  });"""

new_audio_render = """  const s = structuredSummary || {};
  const spokenText = buildSpokenClinicalSummary({
    patientName: summary.patient?.name,
    patientAge: summary.patient?.age,
    patientGender: summary.patient?.gender,
    chiefComplaint: s.chiefComplaint || summary.history.chiefComplaint,
    duration: s.durationOnset || summary.history.duration,
    associatedSymptoms: s.associatedSymptoms || summary.history.associatedSymptoms,
    medications: s.medicines || summary.medications,
    allergies: summary.allergies, // UI allergies fallback
    pastHistory: s.relevantHistory || summary.pastHistory,
    redFlags: summary.redFlags
  });"""

content = content.replace(old_audio_render, new_audio_render)

old_ui_render = """            {/* Intake Overview */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-2xl p-6 border border-[#ded5c2] shadow-sm">
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#829277] mb-1">Chief Complaint</h3>
                <p className="text-xl font-bold text-[#1b3d27] mb-4">{englishSummary.history.chiefComplaint}</p>
                
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#829277] mb-1">Duration</h3>
                <span className="inline-block px-3 py-1 rounded-xl bg-[#f8f5ee] border border-[#ded5c2] text-[#2c241c] text-sm font-bold shadow-sm">
                  {englishSummary.history.duration}
                </span>
              </div>
              
              <div className="bg-white rounded-2xl p-6 border border-[#ded5c2] shadow-sm flex flex-col gap-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#6b7c6e] mb-2 flex items-center gap-2">
                    <Pill size={14} className="text-[#234e32]" />
                    Medications
                  </h3>
                  <p className="text-sm text-[#2c241c] font-medium leading-tight">{englishSummary.medications}</p>
                </div>
                <div className="h-px w-full bg-[#ded5c2]/60" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#6b7c6e] mb-2 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-[#234e32]" />
                    Known Allergies
                  </h3>
                  <p className="text-sm text-[#2c241c] font-medium leading-tight">{englishSummary.allergies}</p>
                </div>
                <div className="h-px w-full bg-[#ded5c2]/60" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#6b7c6e] mb-2 flex items-center gap-2">
                    <FileText size={14} className="text-[#234e32]" />
                    Past Medical History
                  </h3>
                  <p className="text-sm text-[#2c241c] font-medium leading-tight">{englishSummary.pastHistory}</p>
                </div>
              </div>
            </div>

            {/* Detailed Symptoms List */}
            <div className="bg-[#f8f5ee] rounded-2xl p-6 border border-[#ded5c2] mb-8 shadow-inner">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#6b7c6e] mb-4 flex items-center gap-2">
                <Stethoscope size={16} className="text-[#234e32]" />
                Associated Symptoms & Details
              </h3>
              {englishSummary.history.associatedSymptoms && englishSummary.history.associatedSymptoms.length > 0 ? (
                <ul className="space-y-3">
                  {englishSummary.history.associatedSymptoms.map((sym, i) => (
                    <li key={i} className="flex items-start gap-3 bg-white p-3 rounded-xl border border-[#ded5c2]/60 shadow-sm">
                      <span className="text-[#234e32] font-black mt-0.5">•</span>
                      <span className="text-sm text-[#2c241c] font-medium">{sym}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#829277] italic p-4 bg-white rounded-xl border border-dashed border-[#ded5c2]">
                  No associated symptoms reported.
                </p>
              )}
            </div>"""

new_ui_render = """            {/* Intake Overview */}
            {summaryStatus === 'pending' && (
              <div className="flex flex-col items-center justify-center p-12 text-[#556358] bg-white rounded-2xl border border-[#ded5c2] mb-8">
                <div className="w-8 h-8 border-4 border-[#234e32] border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="font-bold">Generating Structured Physician Summary...</p>
                <p className="text-sm mt-2">The AI is currently analyzing the patient's intake data.</p>
              </div>
            )}
            
            {summaryStatus === 'failed' && (
              <div className="flex flex-col items-center justify-center p-12 text-[#7a2c2c] bg-red-50 rounded-2xl border border-red-100 mb-8">
                <p className="font-bold">Failed to generate AI Physician Summary</p>
                <p className="text-sm mt-1 mb-4 text-red-700">Please review raw patient answers below.</p>
              </div>
            )}
            
            {structuredSummary && (
              <>
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-white rounded-2xl p-6 border border-[#ded5c2] shadow-sm">
                    <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#829277] mb-1">Chief Complaint & Affected Area</h3>
                    <p className="text-xl font-bold text-[#1b3d27] mb-1">{s.chiefComplaint}</p>
                    <p className="text-sm text-[#556358] font-semibold mb-4">{s.affectedArea}</p>
                    
                    <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#829277] mb-1">Duration / Onset</h3>
                    <span className="inline-block px-3 py-1 rounded-xl bg-[#f8f5ee] border border-[#ded5c2] text-[#2c241c] text-sm font-bold shadow-sm">
                      {s.durationOnset}
                    </span>
                  </div>
                  
                  <div className="bg-white rounded-2xl p-6 border border-[#ded5c2] shadow-sm flex flex-col gap-4">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#6b7c6e] mb-2 flex items-center gap-2">
                        <Pill size={14} className="text-[#234e32]" />
                        Medications
                      </h3>
                      <p className="text-sm text-[#2c241c] font-medium leading-tight">{s.medicines}</p>
                    </div>
                    <div className="h-px w-full bg-[#ded5c2]/60" />
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#6b7c6e] mb-2 flex items-center gap-2">
                        <FileText size={14} className="text-[#234e32]" />
                        Relevant History
                      </h3>
                      <p className="text-sm text-[#2c241c] font-medium leading-tight">{s.relevantHistory}</p>
                    </div>
                  </div>
                </div>

                {/* Detailed Symptoms List */}
                <div className="bg-[#f8f5ee] rounded-2xl p-6 border border-[#ded5c2] mb-8 shadow-inner">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#6b7c6e] mb-4 flex items-center gap-2">
                    <Stethoscope size={16} className="text-[#234e32]" />
                    Associated Symptoms & Details
                  </h3>
                  {s.associatedSymptoms && s.associatedSymptoms.length > 0 ? (
                    <ul className="space-y-3">
                      {s.associatedSymptoms.map((sym: string, i: number) => (
                        <li key={i} className="flex items-start gap-3 bg-white p-3 rounded-xl border border-[#ded5c2]/60 shadow-sm">
                          <span className="text-[#234e32] font-black mt-0.5">•</span>
                          <span className="text-sm text-[#2c241c] font-medium">{sym}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-[#829277] italic p-4 bg-white rounded-xl border border-dashed border-[#ded5c2]">
                      No associated symptoms reported.
                    </p>
                  )}
                  
                  {s.missingUnknownInformation && s.missingUnknownInformation.length > 0 && (
                    <div className="mt-6 border-t border-[#ded5c2] pt-4">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-[#6b7c6e] mb-3 flex items-center gap-2">
                        <AlertTriangle size={14} className="text-[#7a5524]" />
                        Missing / Unknown Info
                      </h3>
                      <ul className="space-y-2">
                        {s.missingUnknownInformation.map((info: string, i: number) => (
                          <li key={i} className="text-xs text-[#7a5524] font-medium">• {info}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            )}"""

content = content.replace(old_ui_render, new_ui_render)

with open('src/app/doctor/patient/[id]/page.tsx', 'w') as f:
    f.write(content)
print("Updated doctor patient page")
