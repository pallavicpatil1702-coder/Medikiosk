import re

with open('src/app/nurse/dashboard/page.tsx', 'r') as f:
    nurse = f.read()

# Replace clinicalSummary usage with structuredPhysicianSummary fallback

old_duration = """                {selectedPatient.clinicalSummary?.history?.duration && (
                    <div className="text-xs text-[#556358] mt-1">
                      <strong>Duration:</strong> {selectedPatient.clinicalSummary.history.duration}
                    </div>
                  )}"""

new_duration = """                {(selectedPatient.structuredPhysicianSummary?.durationOnset || selectedPatient.clinicalSummary?.history?.duration) && (
                    <div className="text-xs text-[#556358] mt-1">
                      <strong>Duration:</strong> {selectedPatient.structuredPhysicianSummary?.durationOnset || selectedPatient.clinicalSummary?.history?.duration}
                    </div>
                  )}"""

nurse = nurse.replace(old_duration, new_duration)

old_details = """                    <div>
                      <span className="text-[#556358]">Allergies: </span>
                      <span className="text-[#1c241e] font-semibold">
                        {selectedPatient.clinicalSummary?.allergies || 'None reported'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#556358]">Medications: </span>
                      <span className="text-[#1c241e] font-semibold">
                        {selectedPatient.clinicalSummary?.medications || 'None reported'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#556358]">Past History: </span>
                      <span className="text-[#1c241e] font-semibold">
                        {selectedPatient.clinicalSummary?.pastHistory || 'None reported'}
                      </span>
                    </div>"""

new_details = """                    <div>
                      <span className="text-[#556358]">Allergies: </span>
                      <span className="text-[#1c241e] font-semibold">
                        {selectedPatient.clinicalSummary?.allergies || 'Not assessed'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#556358]">Medications: </span>
                      <span className="text-[#1c241e] font-semibold">
                        {selectedPatient.structuredPhysicianSummary?.medicines || selectedPatient.clinicalSummary?.medications || 'None reported'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#556358]">Past History: </span>
                      <span className="text-[#1c241e] font-semibold">
                        {selectedPatient.structuredPhysicianSummary?.relevantHistory || selectedPatient.clinicalSummary?.pastHistory || 'None reported'}
                      </span>
                    </div>"""

nurse = nurse.replace(old_details, new_details)

with open('src/app/nurse/dashboard/page.tsx', 'w') as f:
    f.write(nurse)
print("Nurse dashboard updated")
