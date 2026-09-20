"use client";

import Header from '@/components/Header';
import ProgressBar from '@/components/ProgressBar';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { Sparkles, CheckCircle2, AlertCircle, PenTool, SkipForward, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, updateSession } from '@/lib/store/store';
import { extractFromReport } from '@/lib/services/ocrService';
import type { ExtractedClinicalData } from '@/lib/types';
import { useTranslation } from '@/lib/i18n';
import { useSync } from '@/hooks/useSync';

export default function ExtractionPage() {
  const [extracted, setExtracted] = useState<ExtractedClinicalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [hasDocs, setHasDocs] = useState(true);
  const router = useRouter();
  const { t } = useTranslation();
  const { sync } = useSync();

  useEffect(() => {
    const session = getSession();
    if (!session?.documents || session.documents.length === 0) {
      setHasDocs(false);
    }
  }, []);

  const runExtract = async () => {
    setLoading(true);
    const session = getSession();
    const docName = session.documents?.[0]?.fileName || 'Unknown Report';
    
    if (!navigator.onLine) {
      setExtracted({ tests: [], medicines: [], confidence: 'low', source: 'Error: You are currently offline. Document will be processed later.' });
      updateSession({ extractedData: { tests: [], medicines: [], confidence: 'low', source: 'Error: You are currently offline. Document will be processed later.' } as any });
    } else {
      const res = await extractFromReport(session.documents[0]);
      
      if (res.error) {
        setExtracted({ tests: [], medicines: [], confidence: 'low', source: 'Error: ' + res.error });
      } else if (res.data) {
        setExtracted(res.data);
      } else {
        setExtracted({ tests: [], medicines: [], confidence: 'low', source: 'Empty response' });
      }
      updateSession({ extractedData: res.data as any });
    }
    
    sync();
    
    setLoading(false);
  };

  const handleContinue = () => {
    if (extracted) {
      const finalData = { ...extracted, ...edited };
      updateSession({ extractedData: finalData as any });
      sync();
    }
    router.push('/patient/summary');
  };

  if (!hasDocs) {
    return (
      <AyurvedaBackground variant="kiosk">
        <Header title="Medical Report Analysis" backHref="/patient/reports" />
        <div className="max-w-4xl mx-auto px-6 py-12 sm:py-16">
          <ProgressBar current={12} total={13} />
          <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl p-6 md:p-12 text-center">
            <h2 className="text-3xl font-serif font-bold text-[#1b3d27] mb-3">{t('No Reports Found')}</h2>
            <p className="text-[#556358] mb-6">{t('You skipped uploading reports.')}</p>
            <button 
              onClick={() => router.push('/patient/summary')} 
              className="w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-8 py-3.5 text-base transition shadow-md shadow-[#234e32]/25"
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
      <Header title="Medical Report Analysis" backHref="/patient/reports" />
      <div className="max-w-4xl mx-auto px-6 py-12 sm:py-16">
        <ProgressBar current={12} total={13} />
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#1b3d27] mb-2">{t('Analyzing Medical Report...')}</h2>
          <p className="text-[#556358] text-sm">{t('AI tries to extract structured data from your uploaded document.')}</p>
        </div>

        {!extracted && !loading && (
          <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl p-6 md:p-12 text-center">
            <button 
              onClick={runExtract} 
              className="w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-9 py-4 text-lg shadow-xl shadow-[#234e32]/25 transition"
            >
              <Sparkles size={22} />
              <span>{t('Analyze Report & Extract Data')}</span>
            </button>
            <p className="mt-4 text-xs text-[#829277]">{t('AI automatically extracts lab parameters, test results, and medications from your document.')}</p>
          </div>
        )}

        {loading && (
          <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl p-6 md:p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#e4ede1] text-[#234e32] flex items-center justify-center animate-pulse-soft mb-4">
              <Sparkles size={32} />
            </div>
            <h3 className="text-2xl font-serif font-bold text-[#1b3d27] mb-2">{t('Analyzing')}</h3>
            <p className="text-[#556358] text-sm">{t('Reading blood report values...')}</p>
          </div>
        )}

        {extracted && (
          <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl p-6 md:p-12">
            <div className="flex items-center gap-3 mb-6">
              <h3 className="text-2xl font-serif font-bold text-[#1b3d27]">{t('Extracted Information')}</h3>
              <span className="rounded-full bg-[#e4ede1] text-[#234e32] border border-[#c7d9c2] text-xs font-bold px-3 py-1">
                {extracted.source?.includes('Groq') ? t('AI/OCR Assisted') : t('Structured Extraction')}
              </span>
            </div>
            
            {(!extracted.tests || extracted.tests.length === 0) && (!extracted.medicines || extracted.medicines.length === 0) && !extracted.reportDate ? (
              <div className="bg-[#f8f5ee] border border-[#ded5c2] rounded-2xl p-8 text-center mb-6">
                <AlertCircle className="text-[#829277] mx-auto mb-3" size={32} />
                <h4 className="text-base font-bold text-[#1c241e]">{t('No extractable clinical information found.')}</h4>
                <p className="text-[#556358] text-sm mt-1">
                  {extracted.source?.startsWith('Error:') ? extracted.source : t('OCR/AI extraction was unavailable for this document.')}
                </p>
                <div className="mt-4 inline-block bg-[#fbf9f4] border border-[#ded5c2] rounded-xl p-3">
                  <div className="text-xs font-bold text-[#829277] uppercase tracking-widest mb-1">{t('Uploaded On')}</div>
                  <div className="font-bold text-[#1c241e] text-sm">
                     {getSession()?.documents?.[0]?.uploadedAt ? new Date(getSession()?.documents?.[0]?.uploadedAt as string).toLocaleDateString() : '—'}
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
                      {edited['reportDate'] !== undefined ? edited['reportDate'] : (extracted.reportDate || (getSession()?.documents?.[0]?.uploadedAt ? new Date(getSession()?.documents?.[0]?.uploadedAt as string).toLocaleDateString() : '—'))}
                    </div>
                  </div>
                  
                  {extracted.medicines && extracted.medicines.length > 0 && (
                    <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
                      <div className="text-xs font-extrabold text-[#829277] uppercase tracking-widest mb-1">{t('Medicines')}</div>
                      <div className="font-serif font-bold text-xl text-[#1c241e]">
                        {extracted.medicines.join(', ')}
                      </div>
                    </div>
                  )}
                </div>

                {extracted.tests && extracted.tests.length > 0 && (
                  <div>
                    <h4 className="text-base font-bold text-[#1b3d27] mb-3">{t('Lab Results')}</h4>
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
                                  <span className="inline-flex items-center rounded-lg bg-[#fff5f5] px-2 py-0.5 text-xs font-bold text-[#8a1f1f] border border-[#b83b3b]/30">
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
                {t('Extraction is simulated/assisted for this MVP and requires clinician verification. AI does not diagnose or prescribe.')}
              </span>
            </div>
            <div className="mt-8 flex justify-end w-full">
              <button 
                onClick={handleContinue} 
                className="w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-8 py-3.5 text-base shadow-lg shadow-[#234e32]/25 transition"
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

