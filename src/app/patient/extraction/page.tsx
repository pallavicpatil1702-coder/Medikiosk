"use client";

import Header from '@/components/Header';
import ProgressBar from '@/components/ProgressBar';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { Sparkles, CheckCircle2, AlertCircle, ArrowRight, RefreshCw, FileText, Check, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, updateSession } from '@/lib/store/store';
import { extractFromReport } from '@/lib/services/ocrService';
import type { ExtractedClinicalData, MedicalDocument } from '@/lib/types';
import { useTranslation } from '@/lib/i18n';
import { useSync } from '@/hooks/useSync';

export default function ExtractionPage() {
  const [extracted, setExtracted] = useState<ExtractedClinicalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [hasDocs, setHasDocs] = useState(true);
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const router = useRouter();
  const { t } = useTranslation();
  const { sync } = useSync();

  useEffect(() => {
    const session = getSession();
    if (!session?.documents || session.documents.length === 0) {
      setHasDocs(false);
    } else {
      setDocuments(session.documents);
      if (session.extractedData && (session.extractedData.tests?.length > 0 || session.extractedData.summary)) {
        setExtracted(session.extractedData);
      }
    }
  }, []);

  const runExtract = async () => {
    setLoading(true);
    setErrorState(null);
    const session = getSession();
    const docs = session?.documents || [];

    if (docs.length === 0) {
      setLoading(false);
      return;
    }

    if (!navigator.onLine) {
      const offlineMsg = 'Offline mode: You are currently offline. Reports are saved and can be processed when reconnected.';
      const offlineData: ExtractedClinicalData = { tests: [], medicines: [], confidence: 'low', source: offlineMsg, summary: offlineMsg };
      setExtracted(offlineData);
      updateSession({ extractedData: offlineData as any });
      setErrorState('You are offline. Reports are archived locally.');
      setLoading(false);
      return;
    }

    try {
      // Process documents concurrently rather than sequential blocking
      const extractionPromises = docs.map(async (doc) => {
        try {
          const res = await extractFromReport(doc);
          const docData = res.data || {
            tests: [],
            medicines: [],
            confidence: 'low' as const,
            source: res.error || 'No data',
            summary: 'Report archived.'
          };

          const hasTests = docData.tests && docData.tests.length > 0;
          const hasMedicines = docData.medicines && docData.medicines.length > 0;
          
          let status: 'completed' | 'no_tests' | 'failed' = 'completed';
          if (res.error && !hasTests) {
            status = 'failed';
          } else if (!hasTests && !hasMedicines) {
            status = 'no_tests';
          }

          const docSummary = docData.summary || (hasTests ? `Extracted ${docData.tests.length} laboratory test parameter(s).` : 'Document archived.');

          const updatedDoc: MedicalDocument = {
            ...doc,
            extractedData: docData,
            summary: docSummary,
          };

          return {
            updatedDoc,
            data: docData,
            status,
            error: res.error,
          };
        } catch (singleErr: any) {
          console.error(`[ExtractionPage] Error processing ${doc.fileName}:`, singleErr);
          const updatedDoc: MedicalDocument = {
            ...doc,
            summary: 'Extraction could not be completed for this document.',
          };
          return {
            updatedDoc,
            data: { tests: [], medicines: [], confidence: 'low' as const, source: 'Extraction error' } as ExtractedClinicalData,
            status: 'failed' as const,
            error: singleErr?.message || 'Processing failed',
          };
        }
      });

      const results = await Promise.all(extractionPromises);

      const updatedDocs: MedicalDocument[] = [];
      const allTests: any[] = [];
      const allMedicines: string[] = [];
      const allSummaries: string[] = [];
      let latestReportDate = '';
      let anyFailed = false;

      for (const res of results) {
        updatedDocs.push(res.updatedDoc);
        if (res.status === 'failed') anyFailed = true;

        if (res.data.tests && res.data.tests.length > 0) {
          allTests.push(...res.data.tests);
        }
        if (res.data.medicines && res.data.medicines.length > 0) {
          allMedicines.push(...res.data.medicines);
        }
        if (res.updatedDoc.summary) {
          allSummaries.push(`${res.updatedDoc.fileName}: ${res.updatedDoc.summary}`);
        }
        if (res.data.reportDate && !latestReportDate) {
          latestReportDate = res.data.reportDate;
        }
      }

      setDocuments(updatedDocs);

      const consolidatedData: ExtractedClinicalData = {
        reportDate: latestReportDate || undefined,
        summary: allSummaries.length > 0
          ? allSummaries.join('\n')
          : (allTests.length > 0 ? `Extracted ${allTests.length} test parameter(s) across uploaded report(s).` : 'Reports processed and archived.'),
        tests: allTests,
        medicines: Array.from(new Set(allMedicines)),
        confidence: allTests.length > 0 ? 'high' : 'medium',
        source: 'AI/OCR Clinical Multi-report Extraction'
      };

      setExtracted(consolidatedData);
      updateSession({
        documents: updatedDocs,
        extractedData: consolidatedData,
      });
      sync();

      if (anyFailed && allTests.length === 0) {
        setErrorState('One or more reports could not be fully read. You can retry or continue.');
      }
    } catch (err: any) {
      console.error('Multi-document extraction error:', err);
      const fallbackData: ExtractedClinicalData = {
        tests: [],
        medicines: [],
        confidence: 'low',
        source: 'Extraction error: ' + (err?.message || 'Unknown'),
        summary: 'Error processing reports. Reports remain securely archived.'
      };
      setExtracted(fallbackData);
      setErrorState(err?.message || 'Error occurred during extraction.');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (extracted) {
      updateSession({ extractedData: extracted as any });
      sync();
    }
    router.push('/patient/summary');
  };

  if (!hasDocs) {
    return (
      <AyurvedaBackground variant="kiosk">
        <Header title={t('Medical Report Analysis')} backHref="/patient/reports" />
        <div className="max-w-4xl mx-auto px-6 py-12 sm:py-16">
          <ProgressBar current={12} total={13} />
          <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl p-6 md:p-12 text-center">
            <h2 className="text-3xl font-serif font-bold text-[#1b3d27] mb-3">{t('No Reports Found')}</h2>
            <p className="text-[#556358] mb-6">{t('You skipped uploading reports.')}</p>
            <button 
              onClick={() => router.push('/patient/summary')} 
              className="w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-8 py-3.5 text-base transition shadow-md shadow-[#234e32]/25 cursor-pointer"
            >
              <span>{t('Continue to Summary')}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </AyurvedaBackground>
    );
  }

  return (
    <AyurvedaBackground variant="kiosk">
      <Header title={t('Medical Report Analysis')} backHref="/patient/reports" />
      <div className="max-w-4xl mx-auto px-6 py-12 sm:py-16">
        <ProgressBar current={12} total={13} />
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#1b3d27] mb-2">{t('Analyzing Medical Report...')}</h2>
          <p className="text-[#556358] text-sm">{t('AI and OCR extract structured clinical parameters from your uploaded documents.')}</p>
        </div>

        {errorState && (
          <div className="rounded-2xl bg-[#fff5f5] border border-[#b83b3b]/30 p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-[#b83b3b] shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-[#8a1f1f] font-bold text-sm">{t(errorState)}</p>
                <p className="text-xs text-[#8a1f1f]/80 mt-0.5">{t('Your original reports are safely saved in your session.')}</p>
              </div>
            </div>
            <button
              onClick={runExtract}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#b83b3b] hover:bg-[#962e2e] text-white text-xs font-bold rounded-xl transition shadow-xs self-end sm:self-auto cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>{t('Retry Extraction')}</span>
            </button>
          </div>
        )}

        {!extracted && !loading && (
          <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl p-6 md:p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#e4ede1] text-[#234e32] flex items-center justify-center mb-4 shadow-xs">
              <Sparkles size={32} />
            </div>
            <h3 className="text-2xl font-serif font-bold text-[#1b3d27] mb-2">
              {documents.length > 1 ? `${documents.length} ${t('Reports Ready for Analysis')}` : t('Report Ready for Analysis')}
            </h3>
            <p className="text-[#556358] text-sm max-w-lg mx-auto mb-6">
              {t('AI automatically reads lab parameters, test results, reference ranges, and medications from your documents.')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={runExtract} 
                className="w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-9 py-4 text-lg shadow-xl shadow-[#234e32]/25 transition cursor-pointer"
              >
                <Sparkles size={22} />
                <span>{t('Analyze Report & Extract Data')}</span>
              </button>
              <button
                onClick={() => router.push('/patient/summary')}
                className="font-bold text-[#6f4827] hover:text-[#4d2f19] text-sm py-3 px-4"
              >
                {t('Skip for now')}
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl p-8 md:p-14 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#e4ede1] text-[#234e32] flex items-center justify-center animate-pulse-soft mb-5">
              <Sparkles size={32} />
            </div>
            <h3 className="text-2xl font-serif font-bold text-[#1b3d27] mb-2">{t('Analyzing Documents...')}</h3>
            <p className="text-[#556358] text-sm">{t('Reading and structuring lab parameters, values, and medicines...')}</p>
            <div className="mt-6 max-w-xs mx-auto bg-[#e4ede1]/50 rounded-full h-2 overflow-hidden">
              <div className="bg-[#234e32] h-2 rounded-full animate-pulse-soft w-3/4 mx-auto" />
            </div>
          </div>
        )}

        {extracted && !loading && (
          <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl p-6 md:p-12">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-[#ded5c2]/60">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-serif font-bold text-[#1b3d27]">{t('Extracted Information')}</h3>
                <span className="rounded-full bg-[#e4ede1] text-[#234e32] border border-[#c7d9c2] text-xs font-bold px-3 py-1">
                  {extracted.source?.includes('Groq') ? t('AI/OCR Assisted') : t('Structured Extraction')}
                </span>
              </div>
              <button
                onClick={runExtract}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#234e32] hover:text-[#1a3b26] bg-[#e4ede1]/80 hover:bg-[#e4ede1] px-3 py-1.5 rounded-xl border border-[#c7d9c2] transition cursor-pointer"
                title={t('Re-run extraction')}
              >
                <RefreshCw size={13} />
                <span>{t('Re-analyze')}</span>
              </button>
            </div>

            {/* Document Status Badges */}
            {documents.length > 0 && (
              <div className="mb-6 space-y-2">
                <div className="text-xs font-bold text-[#829277] uppercase tracking-widest">{t('Analyzed Documents')}</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {documents.map((doc) => {
                    const testCount = doc.extractedData?.tests?.length || 0;
                    return (
                      <div key={doc.id} className="flex items-center justify-between bg-[#f8f5ee] border border-[#ded5c2] rounded-xl px-3.5 py-2.5 text-xs">
                        <div className="flex items-center gap-2 truncate mr-2">
                          <FileText size={16} className="text-[#234e32] shrink-0" />
                          <span className="font-semibold text-[#1c241e] truncate" title={doc.fileName}>{doc.fileName}</span>
                        </div>
                        <span className={`shrink-0 font-bold px-2 py-0.5 rounded-md border ${
                          testCount > 0 
                            ? 'bg-[#e4ede1] text-[#234e32] border-[#c7d9c2]' 
                            : 'bg-[#f4ece1] text-[#6f4827] border-[#ded5c2]'
                        }`}>
                          {testCount > 0 ? `${testCount} ${t('tests')}` : t('Archived')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {(!extracted.tests || extracted.tests.length === 0) && (!extracted.medicines || extracted.medicines.length === 0) && !extracted.reportDate ? (
              <div className="bg-[#f8f5ee] border border-[#ded5c2] rounded-2xl p-8 text-center mb-6">
                <AlertCircle className="text-[#829277] mx-auto mb-3" size={32} />
                <h4 className="text-base font-bold text-[#1c241e]">{t('No discrete laboratory test values identified')}</h4>
                <p className="text-[#556358] text-sm mt-1 max-w-md mx-auto">
                  {extracted.summary || t('Your report was securely archived. If this was an imaging scan, prescription, or clinical note, the document has been attached for doctor review.')}
                </p>
                <div className="mt-4 inline-block bg-[#fbf9f4] border border-[#ded5c2] rounded-xl p-3">
                  <div className="text-xs font-bold text-[#829277] uppercase tracking-widest mb-1">{t('Uploaded On')}</div>
                  <div className="font-bold text-[#1c241e] text-sm">
                    {documents[0]?.uploadedAt ? new Date(documents[0].uploadedAt).toLocaleDateString() : new Date().toLocaleDateString()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
                    <div className="text-xs font-extrabold text-[#829277] uppercase tracking-widest mb-1">
                      {extracted.reportDate ? t('Report Date') : t('Uploaded On')}
                    </div>
                    <div className="font-serif font-bold text-xl text-[#1c241e]">
                      {extracted.reportDate || (documents[0]?.uploadedAt ? new Date(documents[0].uploadedAt).toLocaleDateString() : new Date().toLocaleDateString())}
                    </div>
                  </div>
                  
                  {extracted.medicines && extracted.medicines.length > 0 ? (
                    <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
                      <div className="text-xs font-extrabold text-[#829277] uppercase tracking-widest mb-1">{t('Detected Medicines')}</div>
                      <div className="font-serif font-bold text-base text-[#1c241e]">
                        {extracted.medicines.join(', ')}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
                      <div className="text-xs font-extrabold text-[#829277] uppercase tracking-widest mb-1">{t('Extraction Confidence')}</div>
                      <div className="font-serif font-bold text-xl text-[#1c241e] capitalize">
                        {extracted.confidence || 'Medium'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Report Clinical Summary */}
                {extracted.summary && (
                  <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
                    <div className="text-xs font-extrabold text-[#829277] uppercase tracking-widest mb-1.5">{t('Report Summary')}</div>
                    <p className="text-sm text-[#3e4a3f] leading-relaxed">{extracted.summary}</p>
                  </div>
                )}

                {/* Lab Results Table */}
                {extracted.tests && extracted.tests.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-base font-bold text-[#1b3d27]">{t('Lab Results')} ({extracted.tests.length})</h4>
                    </div>
                    <div className="overflow-x-auto rounded-2xl border border-[#ded5c2] bg-white">
                      <table className="w-full text-left text-sm text-[#3e4a3f] whitespace-nowrap sm:whitespace-normal">
                        <thead className="bg-[#f8f5ee] text-xs uppercase font-extrabold text-[#6b7c6e] border-b border-[#ded5c2]">
                          <tr>
                            <th className="px-4 py-3">{t('Test Name')}</th>
                            <th className="px-4 py-3">{t('Result')}</th>
                            <th className="px-4 py-3">{t('Unit')}</th>
                            <th className="px-4 py-3">{t('Reference Range')}</th>
                            <th className="px-4 py-3">{t('Flag')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#ded5c2]/60">
                          {extracted.tests.map((test, i) => (
                            <tr key={i} className="hover:bg-[#fbf9f4]">
                              <td className="px-4 py-3 font-semibold text-[#1c241e]">{test.name}</td>
                              <td className="px-4 py-3 font-bold text-[#234e32]">{test.value}</td>
                              <td className="px-4 py-3 text-[#556358]">{test.unit || '—'}</td>
                              <td className="px-4 py-3 text-[#829277]">{test.referenceRange || '—'}</td>
                              <td className="px-4 py-3">
                                {test.flag ? (
                                  <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-bold border ${
                                    test.flag.toLowerCase() === 'high'
                                      ? 'bg-[#fff5f5] text-[#8a1f1f] border-[#b83b3b]/30'
                                      : test.flag.toLowerCase() === 'low'
                                      ? 'bg-[#f4f7fb] text-[#1e4a7a] border-[#2d5f9e]/30'
                                      : 'bg-[#fff9e6] text-[#7a5b1e] border-[#c49a33]/30'
                                  }`}>
                                    {test.flag}
                                  </span>
                                ) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="rounded-full bg-[#f6ebd0] border border-[#e5d4a4] text-[#6f4827] text-xs font-bold px-3 py-1 flex items-center gap-1.5 self-start">
                <AlertCircle size={14} /> {t('AI assists. Healthcare professionals decide.')}
              </span>
              <span className="text-xs text-[#6b7c6e] max-w-sm">
                {t('Extraction assists clinicians by organizing parameters. All findings require healthcare professional verification.')}
              </span>
            </div>

            <div className="mt-8 flex justify-end w-full">
              <button 
                onClick={handleContinue} 
                className="w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-8 py-3.5 text-base shadow-lg shadow-[#234e32]/25 transition cursor-pointer"
              >
                <span>{t('Continue to Summary')}</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </AyurvedaBackground>
  );
}


