import re

# 1. Update Doctor Dashboard
with open('src/app/doctor/dashboard/page.tsx', 'r') as f:
    doc_dash = f.read()

# Add a retry button handler
retry_handler = """  const [isRetryingSummary, setIsRetryingSummary] = useState(false);

  const retryPhysicianSummary = async (sessionId: string) => {
    setIsRetryingSummary(true);
    try {
      const res = await fetch('/api/ai/generatePhysicianSummary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      if (res.ok) {
        // Just reload the page or optimistically update
        window.location.reload();
      } else {
        alert('Failed to generate summary. Please try again.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error.');
    } finally {
      setIsRetryingSummary(false);
    }
  };

  const handlePatientSelect"""
doc_dash = doc_dash.replace("  const handlePatientSelect", retry_handler)

# Replace the activeTab === 'summary' render block
old_tab_1 = """                  {/* TAB 1: Clinical Summary & Notes */}
                  {activeTab === 'summary' && (() => {
                    const fallbackSummary: ClinicalSummary = selectedPatient.clinicalSummary || {
                      id: selectedPatient.id,
                      patientId: selectedPatient.patientId || selectedPatient.id,
                      generatedAt: new Date().toISOString(),
                      patient: selectedPatient.patient || { name: 'Patient', age: 0, gender: 'Unknown', id: selectedPatient.id, createdAt: new Date().toISOString() },
                      history: {
                        chiefComplaint: selectedPatient.chiefComplaint || 'Intake completed',
                        duration: 'Reported during intake',
                        associatedSymptoms: [],
                        medicationTaken: 'None reported',
                        allergies: 'No known allergy',
                        pastMedicalHistory: 'None declared',
                        answers: selectedPatient.answers || []
                      },
                      medications: 'None reported',
                      allergies: 'No known allergy',
                      pastHistory: 'None declared',
                      investigationResults: 'None',
                      previousReports: [],
                      redFlags: selectedPatient.redFlags || [],
                      aiNotes: 'Clinical intake dossier retrieved from Firestore.',
                      status: 'pending'
                    };

                    const englishSummary = normalizeClinicalSummaryToEnglish(fallbackSummary);

                    const spokenSummaryText = buildSpokenClinicalSummary({
                      patientName: selectedPatient.patient?.name,
                      patientAge: selectedPatient.patient?.age,
                      patientGender: selectedPatient.patient?.gender,
                      chiefComplaint: englishSummary.history.chiefComplaint,
                      duration: englishSummary.history.duration,
                      associatedSymptoms: englishSummary.history.associatedSymptoms,
                      medications: englishSummary.medications,
                      allergies: englishSummary.allergies,
                      pastHistory: englishSummary.pastHistory,
                      redFlags: englishSummary.redFlags
                    });

                    return (
                      <div className="space-y-6">"""

new_tab_1 = """                  {/* TAB 1: Clinical Summary & Notes */}
                  {activeTab === 'summary' && (() => {
                    const status = selectedPatient.physicianSummaryStatus;
                    const structSummary = selectedPatient.structuredPhysicianSummary;
                    
                    if (status === 'pending') {
                      return (
                        <div className="flex flex-col items-center justify-center p-12 text-[#556358]">
                          <div className="w-8 h-8 border-4 border-[#234e32] border-t-transparent rounded-full animate-spin mb-4"></div>
                          <p className="font-bold">Generating Structured Physician Summary...</p>
                          <p className="text-sm mt-2">The AI is currently analyzing the patient's intake data.</p>
                        </div>
                      );
                    }
                    
                    if (status === 'failed' || (!structSummary && status !== 'generated')) {
                      return (
                        <div className="flex flex-col items-center justify-center p-12 text-[#7a2c2c] bg-red-50 rounded-2xl border border-red-100">
                          <p className="font-bold mb-4">Failed to generate AI Physician Summary</p>
                          <button
                            onClick={() => retryPhysicianSummary(selectedPatient.firestoreSessionId || selectedPatient.id)}
                            disabled={isRetryingSummary}
                            className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded-xl transition"
                          >
                            {isRetryingSummary ? 'Retrying...' : 'Retry Generation'}
                          </button>
                        </div>
                      );
                    }

                    // Fallback to legacy behavior if structSummary somehow still doesn't exist but status is generated
                    // (Should not happen, but safe typing)
                    const s = structSummary!; 

                    const spokenSummaryText = buildSpokenClinicalSummary({
                      patientName: selectedPatient.patient?.name,
                      patientAge: selectedPatient.patient?.age,
                      patientGender: selectedPatient.patient?.gender,
                      chiefComplaint: s?.chiefComplaint,
                      duration: s?.durationOnset,
                      associatedSymptoms: s?.associatedSymptoms,
                      medications: s?.medicines,
                      allergies: 'Not assessed',
                      pastHistory: s?.relevantHistory,
                      redFlags: selectedPatient.redFlags
                    });

                    return (
                      <div className="space-y-6">"""

doc_dash = doc_dash.replace(old_tab_1, new_tab_1)

# Now we need to update the rendering of the summary fields
# We'll search for where `englishSummary` is used and replace it with `s`

render_old = """                        {/* Summary Header */}
                        <div className="flex items-start justify-between gap-4 bg-[#f8f5ee] rounded-2xl p-5 border border-[#ded5c2]">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#829277] mb-1 block">Chief Complaint</span>
                            <h3 className="text-xl font-bold text-[#1b3d27]">{englishSummary.history.chiefComplaint}</h3>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#829277] mb-1 block">Duration</span>
                            <span className="inline-block px-3 py-1 rounded-xl bg-white border border-[#ded5c2] text-[#2c241c] text-sm font-bold shadow-sm">
                              {englishSummary.history.duration}
                            </span>
                          </div>
                        </div>

                        {/* Summary Content Grid */}
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="bg-white rounded-2xl p-5 border border-[#ded5c2] shadow-sm">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-[#6b7c6e] mb-3 flex items-center gap-2">
                              <Activity size={14} className="text-[#234e32]" />
                              Associated Symptoms
                            </h4>
                            {englishSummary.history.associatedSymptoms && englishSummary.history.associatedSymptoms.length > 0 ? (
                              <ul className="space-y-2">
                                {englishSummary.history.associatedSymptoms.map((sym, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-[#2c241c] font-medium leading-tight">
                                    <span className="text-[#829277] mt-0.5">•</span>
                                    <span>{sym}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-[#829277] italic">None reported</p>
                            )}
                          </div>

                          <div className="bg-white rounded-2xl p-5 border border-[#ded5c2] shadow-sm flex flex-col gap-4">
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-[#6b7c6e] mb-2 flex items-center gap-2">
                                <Pill size={14} className="text-[#234e32]" />
                                Medications
                              </h4>
                              <p className="text-sm text-[#2c241c] font-medium leading-tight">
                                {englishSummary.medications}
                              </p>
                            </div>
                            <div className="h-px w-full bg-[#ded5c2]/60" />
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-[#6b7c6e] mb-2 flex items-center gap-2">
                                <FileText size={14} className="text-[#234e32]" />
                                Past Medical History
                              </h4>
                              <p className="text-sm text-[#2c241c] font-medium leading-tight">
                                {englishSummary.pastHistory}
                              </p>
                            </div>
                          </div>
                        </div>"""

render_new = """                        {/* Summary Header */}
                        <div className="flex items-start justify-between gap-4 bg-[#f8f5ee] rounded-2xl p-5 border border-[#ded5c2]">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#829277] mb-1 block">Chief Complaint & Affected Area</span>
                            <h3 className="text-xl font-bold text-[#1b3d27]">{s?.chiefComplaint}</h3>
                            <p className="text-sm text-[#556358] font-semibold mt-1">{s?.affectedArea}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#829277] mb-1 block">Duration / Onset</span>
                            <span className="inline-block px-3 py-1 rounded-xl bg-white border border-[#ded5c2] text-[#2c241c] text-sm font-bold shadow-sm">
                              {s?.durationOnset}
                            </span>
                          </div>
                        </div>

                        {/* Summary Content Grid */}
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="bg-white rounded-2xl p-5 border border-[#ded5c2] shadow-sm">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-[#6b7c6e] mb-3 flex items-center gap-2">
                              <Activity size={14} className="text-[#234e32]" />
                              Associated Symptoms
                            </h4>
                            {s?.associatedSymptoms && s.associatedSymptoms.length > 0 ? (
                              <ul className="space-y-2">
                                {s.associatedSymptoms.map((sym, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-[#2c241c] font-medium leading-tight">
                                    <span className="text-[#829277] mt-0.5">•</span>
                                    <span>{sym}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-[#829277] italic">None reported</p>
                            )}
                          </div>

                          <div className="bg-white rounded-2xl p-5 border border-[#ded5c2] shadow-sm flex flex-col gap-4">
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-[#6b7c6e] mb-2 flex items-center gap-2">
                                <Pill size={14} className="text-[#234e32]" />
                                Medications
                              </h4>
                              <p className="text-sm text-[#2c241c] font-medium leading-tight">
                                {s?.medicines}
                              </p>
                            </div>
                            <div className="h-px w-full bg-[#ded5c2]/60" />
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-[#6b7c6e] mb-2 flex items-center gap-2">
                                <FileText size={14} className="text-[#234e32]" />
                                Relevant History
                              </h4>
                              <p className="text-sm text-[#2c241c] font-medium leading-tight">
                                {s?.relevantHistory}
                              </p>
                            </div>
                            <div className="h-px w-full bg-[#ded5c2]/60" />
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-[#6b7c6e] mb-2 flex items-center gap-2">
                                <AlertTriangle size={14} className="text-[#234e32]" />
                                Missing / Unknown
                              </h4>
                              {s?.missingUnknownInformation && s.missingUnknownInformation.length > 0 ? (
                                <ul className="space-y-1">
                                  {s.missingUnknownInformation.map((info, i) => (
                                    <li key={i} className="text-xs text-[#7a5524] font-medium">• {info}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-xs text-[#829277] italic">All requested information provided</p>
                              )}
                            </div>
                          </div>
                        </div>"""

doc_dash = doc_dash.replace(render_old, render_new)

with open('src/app/doctor/dashboard/page.tsx', 'w') as f:
    f.write(doc_dash)

print("Updated doctor dashboard")
