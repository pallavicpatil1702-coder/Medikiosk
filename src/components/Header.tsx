"use client";

import {
  ShieldCheck,
  Menu,
  X,
  Home,
  LogIn,
  LayoutDashboard,
  FileCode,
  Activity,
  Shield,
  User,
  LogOut,
  Lock
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { saveToStore, STORAGE_KEYS } from '@/lib/store/store';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';

export default function Header({ title, backHref, customLeftMenu }: { title?: string; backHref?: string; customLeftMenu?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { t: translate, lang } = useTranslation();
  const pathname = usePathname();
  const { currentUser, role, isAnonymous, logout, loading } = useAuth();
  const isDoctor = pathname?.startsWith('/doctor');
  const t = (str: string) => isDoctor ? str : translate(str);
  const menuRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'हिंदी' },
    { code: 'mr', name: 'मराठी' },
    { code: 'bn', name: 'বাংলা' },
    { code: 'ta', name: 'தமிழ்' },
    { code: 'te', name: 'తెలుగు' },
    { code: 'gu', name: 'ગુજરાતી' },
    { code: 'kn', name: 'ಕನ್ನಡ' },
    { code: 'ml', name: 'മലയാളം' }
  ];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getDashboardHref = () => {
    switch (role) {
      case 'patient': return '/patient/dashboard';
      case 'nurse': return '/nurse/dashboard';
      case 'doctor': return '/doctor/dashboard';
      case 'admin': return '/admin/dashboard';
      default: return '/login';
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#fdfbf7]/90 backdrop-blur-xl border-b border-[#e6dece]/80 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {customLeftMenu}
          <a
            href={backHref || '/'}
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#234e32]/10 text-[#234e32] hover:bg-[#234e32]/20 transition shrink-0 border border-[#234e32]/20"
            aria-label="Back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </a>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-serif font-bold text-[#1b3d27] leading-tight truncate tracking-tight">
                {title ? t(title) : t('MediKiosk')}
              </h1>
              {!title && (
                <span className="hidden md:inline-block text-[10px] uppercase font-bold tracking-wider text-[#6f4827] bg-[#f2ebd9] border border-[#d8caa7] px-2 py-0.5 rounded-full">
                  Ayurveda Inspired
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#556358] font-medium mt-0.5">
              <span>{t('AI-Powered Healthcare Intake')}</span>
              <span className="w-0.5 h-0.5 rounded-full bg-[#829277]" />
              <span className="text-[#234e32] font-semibold">{t('Clinical Review Required')}</span>
            </div>
          </div>
        </div>

        {/* Center / Right Shloka (from reference image) */}
        <div className="hidden lg:flex flex-col items-end text-right">
          <span className="text-[12px] font-serif text-[#6f4827] font-semibold tracking-wide">
            — सर्वे सन्तु निरामयाः —
          </span>
          <span className="text-[10px] italic text-[#7a8677]">
            May all be free from disease
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {!isDoctor && !pathname?.startsWith('/admin') && !pathname?.startsWith('/nurse') && (
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f4efe4] text-[#2c241c] hover:bg-[#ebe4d3] border border-[#dcd3be] transition text-xs font-bold shadow-xs"
              >
                🌐 <span className="hidden sm:inline">{t('Language')}</span>
              </button>
              
              <AnimatePresence>
                {langOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute top-full right-0 mt-3 w-40 bg-[#fcfaf5] rounded-2xl shadow-[0_15px_50px_-10px_rgba(40,30,20,0.2)] border border-[#e2d9c5] p-1.5 z-[100]"
                  >
                    <div className="flex flex-col">
                      {languages.map((l) => (
                        <button
                          key={l.code}
                          onClick={() => {
                            saveToStore(STORAGE_KEYS.language, l.code);
                            window.dispatchEvent(new Event('language-changed'));
                            setLangOpen(false);
                          }}
                          className={`text-left px-4 py-2 text-sm rounded-xl transition ${lang === l.code ? 'bg-[#234e32]/10 text-[#234e32] font-bold' : 'text-[#4d2f19] hover:bg-slate-100'}`}
                        >
                          {l.name}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {loading ? (
            <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f4efe4] border border-[#dcd3be] shadow-xs">
              <div className="w-4 h-4 border-2 border-[#4d2f19] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : currentUser && !isAnonymous ? (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#f4efe4] border border-[#dcd3be] text-[#1b3d27] text-xs font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#234e32] animate-pulse" />
              <span className="capitalize">{role || 'Patient'}</span>
              <span className="text-[#8c7e6c] font-normal">|</span>
              <span className="font-mono text-[11px] text-[#57493a] max-w-[120px] truncate">{currentUser.email}</span>
            </div>
          ) : (
            <a
              href="/login"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-[#3d332a] hover:text-[#1b3d27] bg-[#f4efe4] hover:bg-[#eae3d2] border border-[#dcd3be] rounded-full px-3.5 py-1.5 transition shadow-xs"
            >
              <Lock size={12} className="text-[#6f4827]" /> Staff & Patient Login
            </a>
          )}

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOpen(!open)}
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#f4efe4] text-[#2c241c] hover:bg-[#ebe4d3] border border-[#dcd3be] transition relative z-10"
              aria-label="Menu"
              aria-expanded={open}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>

            <AnimatePresence>
              {open && (
                <motion.nav
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute top-full right-0 mt-3 w-[280px] bg-[#fcfaf5] rounded-3xl shadow-[0_15px_50px_-10px_rgba(40,30,20,0.2)] border border-[#e2d9c5] p-2.5 z-[100]"
                >
                  <div className="flex flex-col space-y-1">
                    {/* Logged in user info */}
                    {currentUser && !isAnonymous && (
                      <div className="px-3 py-2 mb-1 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-teal-700">Signed In As</div>
                        <div className="text-xs font-semibold text-slate-900 truncate font-mono">{currentUser.email}</div>
                        <div className="text-[11px] text-slate-500 capitalize mt-0.5">Role: <strong className="text-slate-700">{role || 'Authenticating'}</strong></div>
                      </div>
                    )}

                    {/* Role-Specific Menu Content */}
                    {currentUser && !isAnonymous ? (
                      <>
                        {/* 1. Patient Persona */}
                        {role === 'patient' && (
                          <>
                            <a href="/patient/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors">
                              <User size={17} className="text-teal-600" /> Patient Portal
                            </a>
                            <a href="/patient/language" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-teal-700 transition-colors">
                              <Activity size={15} className="text-slate-400" /> Start New Consultation
                            </a>
                          </>
                        )}

                        {/* 2. Nurse Persona */}
                        {role === 'nurse' && (
                          <>
                            <a href="/nurse/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors">
                              <Activity size={17} className="text-teal-600" /> Triage Nurse Dashboard
                            </a>
                            <a href="/" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-teal-700 transition-colors">
                              <Home size={15} className="text-slate-400" /> MediKiosk Home
                            </a>
                          </>
                        )}

                        {/* 3. Doctor Persona */}
                        {role === 'doctor' && (
                          <>
                            <a href="/doctor/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors">
                              <LayoutDashboard size={17} className="text-teal-600" /> Physician Dashboard
                            </a>
                            <a href="/doctor/fhir" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-teal-700 transition-colors">
                              <FileCode size={15} className="text-slate-400" /> FHIR Preview
                            </a>
                            <a href="/" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-teal-700 transition-colors">
                              <Home size={15} className="text-slate-400" /> MediKiosk Home
                            </a>
                          </>
                        )}

                        {/* 4. Admin Persona */}
                        {role === 'admin' && (
                          <>
                            <a href="/admin/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors">
                              <Shield size={17} className="text-teal-600" /> Admin RBAC Console
                            </a>
                            <a href="/" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-teal-700 transition-colors">
                              <Home size={15} className="text-slate-400" /> MediKiosk Home
                            </a>
                          </>
                        )}

                        {/* Fallback if role is being fetched or unrecognized */}
                        {!role && (
                          <a href={getDashboardHref()} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors">
                            <LayoutDashboard size={17} className="text-teal-600" /> My Dashboard
                          </a>
                        )}

                        <div className="h-px bg-slate-100 my-1" />
                        <button
                          onClick={() => { setOpen(false); logout(); }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors text-left"
                        >
                          <LogOut size={15} className="text-rose-500" /> Sign Out
                        </button>
                      </>
                    ) : (
                      /* Anonymous / Unauthenticated Persona */
                      <>
                        <a href="/patient" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors">
                          <Activity size={17} className="text-teal-600" /> Patient Intake Kiosk
                        </a>
                        <a href="/" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-teal-700 transition-colors">
                          <Home size={15} className="text-slate-400" /> MediKiosk Home
                        </a>
                        <a href="/login" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-teal-700 transition-colors">
                          <LogIn size={17} className="text-teal-600" /> Staff & Patient Login
                        </a>
                      </>
                    )}
                  </div>
                </motion.nav>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}

