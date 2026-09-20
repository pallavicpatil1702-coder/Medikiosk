"use client";

import Header from '@/components/Header';
import ProgressBar from '@/components/ProgressBar';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { Upload, ScanLine, FileText, Check, FileImage, SkipForward, UploadCloud, Trash2, AlertCircle, ArrowRight } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, updateSession } from '@/lib/store/store';
import type { MedicalDocument } from '@/lib/types';
import { useTranslation } from '@/lib/i18n';
import { useSync } from '@/hooks/useSync';

import { useAuth } from '@/context/AuthContext';
import { uploadMedicalReport, deleteMedicalReport } from '@/lib/storage';

export default function ReportsPage() {
  const [uploaded, setUploaded] = useState<MedicalDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();
  const { t } = useTranslation();
  const { sync } = useSync();
  const { currentUser } = useAuth();

  useEffect(() => {
    const session = getSession();
    if (session?.documents) {
      setUploaded(session.documents);
    }
  }, []);

  const handleContinue = () => {
    router.push('/patient/extraction');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setUploading(true);

    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setErrorMsg('Invalid file type. Please upload a PDF, JPG, or PNG.');
      setUploading(false);
      return;
    }

    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrorMsg('File too large (max 2MB).');
      setUploading(false);
      return;
    }

    try {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2) + 'MB';
      const docId = crypto.randomUUID();
      
      const newDoc: MedicalDocument = {
        id: docId,
        fileName: file.name,
        fileType: file.type,
        size: sizeMB,
        uploadedAt: new Date().toISOString(),
      };

      if (currentUser && currentUser.uid) {
        console.log('[Storage] upload started');
        const session = getSession();
        const sessionId = session?.firestoreSessionId || 'pending';
        
        try {
          const { storagePath, downloadUrl } = await uploadMedicalReport(currentUser.uid, sessionId, file);
          newDoc.storagePath = storagePath;
          newDoc.downloadUrl = downloadUrl;
        } catch (uploadErr: any) {
          console.error('[Storage] upload failed:', uploadErr.code, uploadErr.message);
          throw uploadErr;
        }
      } else {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
        newDoc.dataUrl = dataUrl;
      }

      const updatedDocs = [...uploaded, newDoc];
      updateSession({ documents: updatedDocs });
      setUploaded(updatedDocs);
      sync();
    } catch (err: any) {
      console.error("Upload error:", err);
      if (err.name === 'QuotaExceededError' || err?.message?.includes('quota')) {
        setErrorMsg('Storage limit reached. Please remove an existing report before uploading another.');
      } else {
        setErrorMsg('An unexpected error occurred while saving.');
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const removeReport = async (id: string) => {
    const docToRemove = uploaded.find(doc => doc.id === id);
    if (!docToRemove) return;

    try {
      if (currentUser && currentUser.uid && docToRemove.storagePath) {
        await deleteMedicalReport(docToRemove.storagePath);
      }
      
      const updatedDocs = uploaded.filter(doc => doc.id !== id);
      updateSession({ documents: updatedDocs });
      setUploaded(updatedDocs);
      setErrorMsg(null);
      sync();
    } catch (err) {
      console.error("Failed to delete report:", err);
      setErrorMsg('Failed to delete the report. Please try again.');
    }
  };

  return (
    <AyurvedaBackground variant="kiosk">
      <Header title="Previous Medical Reports" backHref="/patient/history" />
      <div className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
        <ProgressBar current={11} total={13} />
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#1b3d27] mb-2">{t('Previous Medical Reports')}</h2>
          <p className="text-[#556358] text-sm">{t('Upload or scan reports to help extract relevant clinical information.')}</p>
        </div>

        {errorMsg && (
          <div className="rounded-2xl bg-[#fff5f5] border border-[#b83b3b]/30 p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="text-[#b83b3b] shrink-0 mt-0.5" size={20} />
            <p className="text-[#8a1f1f] font-bold text-sm">{t(errorMsg)}</p>
          </div>
        )}

        <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl p-6 md:p-12 mb-8">
          <h3 className="text-2xl font-serif font-bold text-[#1b3d27] mb-8">{t('Do you have previous medical reports?')}</h3>
          <div className="grid sm:grid-cols-2 gap-5 mb-8">
            <input 
              type="file" 
              accept=".pdf,image/jpeg,image/png,image/jpg" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={uploading} 
              className="relative group rounded-3xl border-2 border-[#ded5c2] hover:border-[#234e32] focus:outline-none focus:ring-3 focus:ring-[#234e32]/25 bg-[#f8f5ee] hover:bg-[#e8f1e6]/50 p-8 flex flex-col items-center justify-center gap-4 transition disabled:opacity-50"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#e4ede1] text-[#234e32] group-hover:bg-[#234e32] group-hover:text-white flex items-center justify-center transition shadow-xs">
                <UploadCloud size={32} />
              </div>
              <div className="font-bold text-[#1c241e] text-base group-hover:text-[#1b3d27]">
                {uploading ? t('Uploading report...') : t('Upload Report')}
              </div>
              <span className="text-xs text-[#829277]">PDF, JPG, PNG (Max 2MB)</span>
            </button>
            
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
              ref={cameraInputRef} 
              onChange={handleFileSelect} 
            />
            <button 
              onClick={() => cameraInputRef.current?.click()} 
              disabled={uploading} 
              className="relative group rounded-3xl border-2 border-[#ded5c2] hover:border-[#234e32] focus:outline-none focus:ring-3 focus:ring-[#234e32]/25 bg-[#f8f5ee] hover:bg-[#e8f1e6]/50 p-8 flex flex-col items-center justify-center gap-4 transition disabled:opacity-50"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#f4ece1] text-[#6f4827] group-hover:bg-[#6f4827] group-hover:text-white flex items-center justify-center transition shadow-xs">
                <FileImage size={32} />
              </div>
              <div className="font-bold text-[#1c241e] text-base group-hover:text-[#6f4827]">
                {uploading ? t('Uploading report...') : t('Scan / Capture')}
              </div>
              <span className="text-xs text-[#829277]">Kiosk camera / phone photo</span>
            </button>
          </div>
          <div className="flex justify-center">
            <button 
              onClick={() => router.push('/patient/summary')} 
              className="font-bold text-[#6f4827] hover:text-[#4d2f19] hover:underline text-sm"
            >
              {t('Skip for now')}
            </button>
          </div>
        </div>

        {uploading && (
          <div className="rounded-3xl bg-[#e4ede1]/80 border border-[#c7d9c2] p-5 mb-8 flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-[#234e32] text-white flex items-center justify-center animate-pulse-soft">
              <Upload size={18} />
            </div>
            <div>
              <div className="font-bold text-[#1b3d27]">{t('Uploading report...')}</div>
              <div className="text-xs text-[#556358]">Saving securely to your intake profile</div>
            </div>
          </div>
        )}

        {uploaded.length > 0 && (
          <div className="mt-8">
            <h4 className="font-serif font-bold text-xl text-[#1b3d27] mb-4">{t('Uploaded Documents')}</h4>
            <div className="space-y-3 mb-8">
              {uploaded.map((f) => (
                <div key={f.id} className="flex items-center justify-between bg-[#fbf9f4] border border-[#ded5c2] rounded-2xl p-4 shadow-sm group">
                  <div className="flex items-center gap-3.5 overflow-hidden">
                    <FileImage size={22} className="text-[#234e32] shrink-0" />
                    <span className="font-semibold text-[#1c241e] truncate" title={f.fileName}>{f.fileName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-[#234e32] bg-[#e4ede1] px-2.5 py-1 rounded-lg hidden sm:block border border-[#c7d9c2]">{f.size}</span>
                    <button 
                      onClick={() => removeReport(f.id)} 
                      className="p-2 text-[#829277] hover:text-[#b83b3b] hover:bg-[#fff5f5] rounded-xl transition" 
                      aria-label={t('Delete')} 
                      title={t('Remove report')}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex w-full">
              <button 
                onClick={handleContinue} 
                className="w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-8 py-3.5 text-base shadow-lg shadow-[#234e32]/25 transition"
              >
                <span>{t('Continue to Extraction')}</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </AyurvedaBackground>
  );
}

