"use client";

import { useTranslation } from '@/lib/i18n';

export default function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  const { t } = useTranslation();
  return (
    <div className="w-full mb-6" aria-label={`${t('Step')} ${current} ${t('of')} ${total}`}>
      <div className="flex items-center justify-between text-xs font-bold text-[#556358] mb-2">
        <span>{t('Step')} {current} {t('of')} {total}</span>
        <span className="font-mono text-[#234e32]">{pct}%</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-[#e8e2d2] overflow-hidden p-0.5 border border-[#d8caa7]/50 shadow-inner">
        <div className="h-full rounded-full bg-gradient-to-r from-[#234e32] via-[#3d7a52] to-[#829277] transition-all duration-500 shadow-sm" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
