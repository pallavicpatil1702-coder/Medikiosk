"use client";

import Header from '@/components/Header';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import {
  Activity,
  ShieldCheck,
  Stethoscope,
  User,
  Shield,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Clock,
  Layers,
  Cpu,
  Lock,
  ChevronRight,
  Languages,
  HeartPulse,
  Leaf
} from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function MediKioskMainLanding() {
  const { currentUser, role, isAnonymous, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && currentUser && !isAnonymous && role) {
      if (role === 'patient') router.replace('/patient/dashboard');
      else if (role === 'doctor') router.replace('/doctor/dashboard');
      else if (role === 'nurse') router.replace('/nurse/dashboard');
      else if (role === 'admin') router.replace('/admin/dashboard');
    }
  }, [currentUser, role, isAnonymous, loading, router]);

  const containerVariants: Variants = {
    hidden: { opacity: 1 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.15 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 1, y: 0 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } }
  };

  const personas = [
    {
      id: 'patient',
      title: 'Patient / Kiosk',
      headingColor: 'text-[#1e462c]',
      subtitle: 'For patients and general users to start consultation.',
      description: 'Touch, voice, and multilingual interface with adaptive clinical questioning and document capture. No login required for kiosk mode.',
      badge: 'Kiosk Mode',
      badgeColor: 'bg-[#e4ede1] text-[#234e32] border-[#c7d9c2]',
      actionText: 'Start Consultation',
      href: '/patient',
      icon: User,
      iconBg: 'bg-[#e2ece0] text-[#234e32] border-[#c6dbc3]',
      btnBg: 'bg-[#234e32] hover:bg-[#1a3b26] text-white',
      cardBorder: 'hover:border-[#234e32]/40 hover:shadow-[#234e32]/15',
      features: ['Multilingual Voice & Touch', 'Deterministic Red Flags', 'Medical Report OCR']
    },
    {
      id: 'nurse',
      title: 'Nurse',
      headingColor: 'text-[#5a3618]',
      subtitle: 'For nursing staff to manage patient triage and handle queue.',
      description: 'Monitor incoming patients in real-time, review clinical summaries, add triage notes, evaluate urgency, and forward triaged cases to physicians.',
      badge: 'Triage Desk',
      badgeColor: 'bg-[#f4ebe1] text-[#6f4827] border-[#e2d2c1]',
      actionText: 'Nurse Sign In',
      href: '/login',
      icon: Activity,
      iconBg: 'bg-[#f3eae0] text-[#6f4827] border-[#e3d1c0]',
      btnBg: 'bg-[#6f4827] hover:bg-[#57371c] text-white',
      cardBorder: 'hover:border-[#6f4827]/40 hover:shadow-[#6f4827]/15',
      features: ['Live Patient Telemetry', 'Priority Sorting (Emergency/High)', 'Physician Forwarding']
    },
    {
      id: 'doctor',
      title: 'Doctor',
      headingColor: 'text-[#244254]',
      subtitle: 'For physicians to review cases and provide clinical decisions.',
      description: 'Access triaged patient intake summaries, nurse notes, and AI-assisted preliminary findings for rapid clinical confirmation and consultation.',
      badge: 'Clinician Portal',
      badgeColor: 'bg-[#e3ecf2] text-[#2c4e63] border-[#c6d7e2]',
      actionText: 'Doctor Sign In',
      href: '/login',
      icon: Stethoscope,
      iconBg: 'bg-[#e2ebf1] text-[#2c4e63] border-[#c4d6e1]',
      btnBg: 'bg-[#2c4e63] hover:bg-[#1f3747] text-white',
      cardBorder: 'hover:border-[#2c4e63]/40 hover:shadow-[#2c4e63]/15',
      features: ['Clinical History & Symptoms', 'Nurse Triage Audit Logs', 'FHIR R4 / ABDM Schema']
    },
    {
      id: 'admin',
      title: 'Admin',
      headingColor: 'text-[#482d4d]',
      subtitle: 'For system administration, user management and monitoring.',
      description: 'Manage staff accounts, assign cryptographic Firebase Custom Claims, inspect system audit logs, and enforce hospital role-based access rules.',
      badge: 'System Admin',
      badgeColor: 'bg-[#ece4ee] text-[#55365a] border-[#d8c7da]',
      actionText: 'Admin Sign In',
      href: '/login',
      icon: Shield,
      iconBg: 'bg-[#ebe3ed] text-[#55365a] border-[#d6c4d9]',
      btnBg: 'bg-[#55365a] hover:bg-[#422946] text-white',
      cardBorder: 'hover:border-[#55365a]/40 hover:shadow-[#55365a]/15',
      features: ['Server Custom Claims Engine', 'Staff RBAC Provisioning', 'Clinical Audit Log']
    }
  ];

  return (
    <AyurvedaBackground variant="landing">
      {/* Global Header with Role Context */}
      <Header title="MediKiosk Platform" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-16">
        {/* Hero Section — Matching the provided reference image layout */}
        <motion.div
          className="text-center max-w-3xl mx-auto mb-12 sm:mb-16"
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Centered Botanical Emblem (from reference image) */}
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#234e32]/10 text-[#234e32] border border-[#234e32]/20 mb-4 shadow-sm">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 20A7 7 0 0 1 4 13C4 7 11 2 11 2s7 5 7 11a7 7 0 0 1-7 7Z" />
              <path d="M11 20V10" />
            </svg>
          </div>

          <h1 className="text-4xl sm:text-6xl font-serif font-bold text-[#1b3d27] tracking-tight leading-[1.1] mb-3">
            Welcome to MediKiosk
          </h1>

          <p className="text-base sm:text-xl font-medium text-[#4a5749] leading-relaxed max-w-2xl mx-auto">
            AI-enabled healthcare with Ayurveda wisdom for a healthier tomorrow
          </p>

          {/* Tiny decorative leaf separator */}
          <div className="flex items-center justify-center gap-2 mt-4 text-[#829277]">
            <span className="w-8 h-px bg-[#829277]/40" />
            <Leaf size={14} />
            <span className="w-8 h-px bg-[#829277]/40" />
          </div>
        </motion.div>

        {/* 4 Persona Portals Grid — Matching cards in reference image */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-7"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {personas.map((p) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.id}
                variants={itemVariants}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className={`relative rounded-[28px] bg-[#fbf9f4]/92 backdrop-blur-xl border border-[#ded5c2]/80 p-7 flex flex-col justify-between shadow-[0_12px_36px_-8px_rgba(45,35,20,0.12)] transition-all duration-300 ${p.cardBorder} overflow-hidden group`}
              >
                {/* Botanical Corner Watermark sketch */}
                <div className="absolute -bottom-6 -right-6 w-28 h-28 opacity-10 pointer-events-none text-[#234e32]">
                  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M20,80 Q50,20 80,80 Q50,50 20,80 Z" />
                    <path d="M50,50 L50,85" />
                    <path d="M35,65 Q50,60 65,65" />
                  </svg>
                </div>

                <div className="relative z-10">
                  {/* Top Circular Icon Badge */}
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-14 h-14 rounded-full ${p.iconBg} border flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform`}>
                      <Icon size={26} strokeWidth={2.2} />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${p.badgeColor}`}>
                      {p.badge}
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <h2 className={`text-2xl font-serif font-bold ${p.headingColor} transition-colors tracking-tight mb-2`}>
                    {p.title}
                  </h2>
                  <p className="text-xs font-semibold text-[#404c42] leading-relaxed mb-4">
                    {p.subtitle}
                  </p>

                  <p className="text-[12px] text-[#556358] leading-relaxed mb-5">
                    {p.description}
                  </p>

                  {/* Features List */}
                  <div className="space-y-2 mb-6 pt-4 border-t border-[#ded5c2]/60">
                    {p.features.map((feat) => (
                      <div key={feat} className="flex items-center gap-2 text-[11px] text-[#3e4a3f] font-medium">
                        <CheckCircle2 size={13} className="text-[#234e32] shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Circular Action Button — matching reference design with arrow */}
                <div className="relative z-10 pt-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#404c42]">
                    {p.actionText}
                  </span>
                  <a
                    href={p.href}
                    className={`w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-all group-hover:scale-110 ${p.btnBg}`}
                    aria-label={`Proceed to ${p.title}`}
                  >
                    <ArrowRight size={18} />
                  </a>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* System Highlights Banner in Warm Cream Glass */}
        <motion.div
          className="mt-14 rounded-3xl bg-[#fbf9f4]/88 border border-[#ded5c2]/80 p-6 sm:p-8 backdrop-blur-xl shadow-[0_10px_30px_-8px_rgba(45,35,20,0.08)]"
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-[#e4ede1] border border-[#c7d9c2] flex items-center justify-center text-[#234e32] shrink-0 shadow-xs">
                <Languages size={22} />
              </div>
              <div>
                <h3 className="text-sm font-serif font-bold text-[#1b3d27] mb-1">Inclusive Multilingual Intake</h3>
                <p className="text-xs text-[#556358] leading-relaxed">
                  Available in 9 Indian languages with real-time speech recognition, natural TTS voice synthesis, and touch-friendly navigation.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-[#f4ebe1] border border-[#e2d2c1] flex items-center justify-center text-[#6f4827] shrink-0 shadow-xs">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 className="text-sm font-serif font-bold text-[#5a3618] mb-1">Zero-Trust Role Security</h3>
                <p className="text-xs text-[#556358] leading-relaxed">
                  Cryptographically verified Firebase Custom Claims protect nurse, doctor, and admin dashboards against unauthorized access.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-[#e3ecf2] border border-[#c6d7e2] flex items-center justify-center text-[#2c4e63] shrink-0 shadow-xs">
                <HeartPulse size={22} />
              </div>
              <div>
                <h3 className="text-sm font-serif font-bold text-[#244254] mb-1">Deterministic Triage Engine</h3>
                <p className="text-xs text-[#556358] leading-relaxed">
                  Urgent and high-priority physiological red flags are detected deterministically, alerting clinical triage staff without hallucination.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <footer className="mt-12 text-center text-xs text-[#738274] border-t border-[#ded5c2]/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-serif">MediKiosk — Smart India Hackathon (SIH) Healthcare Intake System</span>
          <div className="flex items-center gap-4 text-[#556358] font-semibold">
            <a href="/patient" className="hover:text-[#234e32] transition">Patient Kiosk</a>
            <span>•</span>
            <a href="/login" className="hover:text-[#234e32] transition">Staff Login</a>
            <span>•</span>
            <a href="/nurse/dashboard" className="hover:text-[#234e32] transition">Triage Desk</a>
            <span>•</span>
            <a href="/doctor/dashboard" className="hover:text-[#234e32] transition">Doctor Portal</a>
          </div>
        </footer>
      </div>
    </AyurvedaBackground>
  );
}
