import re

with open('src/app/doctor/patient/[id]/page.tsx', 'r') as f:
    content = f.read()

# Replace all englishSummary with summary/s equivalents
old_audio = """        <div className="mb-6">
          <DoctorSummaryAudio
            textToSpeak={spokenText}
            patientId={params.id}
            patientName={englishSummary.patient?.name}
          />
        </div>"""

new_audio = """        <div className="mb-6">
          <DoctorSummaryAudio
            textToSpeak={spokenText}
            patientId={params.id}
            patientName={summary.patient?.name}
          />
        </div>"""
content = content.replace(old_audio, new_audio)

old_info = """            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-4">
                <div className="text-xs font-bold text-[#829277] uppercase">Name</div>
                <div className="font-bold text-base text-[#1c241e] mt-1">{englishSummary.patient.name}</div>
              </div>
              <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-4">
                <div className="text-xs font-bold text-[#829277] uppercase">Age</div>
                <div className="font-bold text-base text-[#1c241e] mt-1">{englishSummary.patient.age || '—'}</div>
              </div>
              <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-4">
                <div className="text-xs font-bold text-[#829277] uppercase">Gender</div>
                <div className="font-bold text-base text-[#1c241e] mt-1">{englishSummary.patient.gender || '—'}</div>
              </div>
            </div>"""

new_info = """            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-4">
                <div className="text-xs font-bold text-[#829277] uppercase">Name</div>
                <div className="font-bold text-base text-[#1c241e] mt-1">{summary.patient.name}</div>
              </div>
              <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-4">
                <div className="text-xs font-bold text-[#829277] uppercase">Age</div>
                <div className="font-bold text-base text-[#1c241e] mt-1">{summary.patient.age || '—'}</div>
              </div>
              <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-4">
                <div className="text-xs font-bold text-[#829277] uppercase">Gender</div>
                <div className="font-bold text-base text-[#1c241e] mt-1">{summary.patient.gender || '—'}</div>
              </div>
            </div>"""
content = content.replace(old_info, new_info)

old_chief = """            <h3 className="text-xl font-serif font-bold text-[#1b3d27] mb-4">Chief Complaint (English)</h3>
            <div className="rounded-2xl bg-[#e4ede1]/60 border border-[#c7d9c2] p-5 mb-6">
              <div className="font-serif font-bold text-xl text-[#1b3d27] mb-1">{englishSummary.history.chiefComplaint || 'None'}</div>
              <div className="text-xs text-[#3e4a3f]"><strong>Duration:</strong> {englishSummary.history.duration || 'Not specified'}</div>
            </div>"""

new_chief = """            <h3 className="text-xl font-serif font-bold text-[#1b3d27] mb-4">Chief Complaint (English)</h3>
            <div className="rounded-2xl bg-[#e4ede1]/60 border border-[#c7d9c2] p-5 mb-6">
              <div className="font-serif font-bold text-xl text-[#1b3d27] mb-1">{s.chiefComplaint || summary.history.chiefComplaint || 'None'}</div>
              <div className="text-xs text-[#3e4a3f]"><strong>Duration:</strong> {s.durationOnset || summary.history.duration || 'Not specified'}</div>
              <div className="text-xs text-[#3e4a3f] mt-1"><strong>Affected Area:</strong> {s.affectedArea || 'Not specified'}</div>
            </div>"""
content = content.replace(old_chief, new_chief)


old_hpi = """            <h3 className="text-xl font-serif font-bold text-[#1b3d27] mb-4">History of Present Illness</h3>
            <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5 mb-6">
              <div className="font-bold text-sm text-[#1c241e] mb-1">Associated Symptoms:</div>
              <div className="text-sm text-[#556358]">{englishSummary.history.associatedSymptoms?.join(', ') || 'None reported'}</div>
            </div>"""

new_hpi = """            <h3 className="text-xl font-serif font-bold text-[#1b3d27] mb-4">History of Present Illness</h3>
            <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5 mb-6">
              <div className="font-bold text-sm text-[#1c241e] mb-1">Associated Symptoms:</div>
              <div className="text-sm text-[#556358]">{s.associatedSymptoms?.join(', ') || summary.history.associatedSymptoms?.join(', ') || 'None reported'}</div>
            </div>"""
content = content.replace(old_hpi, new_hpi)

old_meds = """            <h3 className="text-xl font-serif font-bold text-[#1b3d27] mb-4">Medications & Allergies</h3>
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
                <div className="text-xs font-bold text-[#829277] uppercase mb-1">Medications</div>
                <div className="font-bold text-sm text-[#1c241e]">{englishSummary.medications}</div>
              </div>
              <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
                <div className="text-xs font-bold text-[#829277] uppercase mb-1">Allergies</div>
                <div className="font-bold text-sm text-[#1c241e]">{englishSummary.allergies}</div>
              </div>
            </div>"""

new_meds = """            <h3 className="text-xl font-serif font-bold text-[#1b3d27] mb-4">Medications & Allergies</h3>
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
                <div className="text-xs font-bold text-[#829277] uppercase mb-1">Medications</div>
                <div className="font-bold text-sm text-[#1c241e]">{s.medicines || summary.medications}</div>
              </div>
              <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
                <div className="text-xs font-bold text-[#829277] uppercase mb-1">Allergies</div>
                <div className="font-bold text-sm text-[#1c241e]">{summary.allergies}</div>
              </div>
            </div>"""
content = content.replace(old_meds, new_meds)

# Ensure englishSummary doesn't exist anymore
content = content.replace("const englishSummary = normalizeClinicalSummaryToEnglish(summary);", "")

with open('src/app/doctor/patient/[id]/page.tsx', 'w') as f:
    f.write(content)

