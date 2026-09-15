"use client";

import Header from '@/components/Header';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { Activity, ShieldCheck, Languages, ChevronRight, Leaf, Sparkles, HeartPulse } from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import { clearSession } from '@/lib/store/store';

export default function PatientKioskLandingPage() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <AyurvedaBackground variant="kiosk">
      <Header title="Patient Kiosk" backHref="/" />

      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-16 sm:pt-20 pb-16 grid lg:grid-cols-2 gap-12 sm:gap-16 items-center">
        <motion.div variants={containerVariants} initial="hidden" animate="show">
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 rounded-full bg-[#e4ede1] border border-[#c7d9c2] px-4 py-1.5 text-xs font-bold text-[#234e32] mb-6 shadow-xs">
            <Languages size={15} /> Multilingual • Touch Friendly • Voice Intake
          </motion.div>

          <motion.h1 variants={itemVariants} className="text-4xl sm:text-6xl font-serif font-bold text-[#1b3d27] tracking-tight leading-[1.15] mb-5">
            Smart AI-Assisted <br />
            <span className="text-[#6f4827]">Healthcare Intake</span>
          </motion.h1>

          <motion.p variants={itemVariants} className="text-base sm:text-lg text-[#4a5749] leading-relaxed mb-8 max-w-xl">
            Helping healthcare professionals spend less time collecting routine history and more time caring for patients, grounded in holistic clinical wellness.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-wrap gap-4">
            <motion.a
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              href="/patient/language"
              onClick={() => clearSession()}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-8 py-4 text-base sm:text-lg shadow-lg shadow-[#234e32]/25 transition focus:outline-none focus:ring-4 focus:ring-[#234e32]/30"
            >
              Start Consultation <ChevronRight size={20} />
            </motion.a>
            <motion.a
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              href="/patient/identify"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#fbf9f4] hover:bg-[#f2ece0] text-[#4d2f19] font-bold px-8 py-4 text-base sm:text-lg border border-[#ded5c2] transition shadow-xs"
            >
              Existing Patient
            </motion.a>
          </motion.div>

          <motion.div variants={itemVariants} className="mt-10 flex items-center gap-6 text-xs text-[#556358] font-semibold">
            <span className="flex items-center gap-1.5"><Activity size={16} className="text-[#234e32]" /> Touch Screen</span>
            <span className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-[#234e32]" /> Secure Session</span>
            <span className="flex items-center gap-1.5"><Languages size={16} className="text-[#234e32]" /> 9 Languages</span>
          </motion.div>
        </motion.div>

        {/* Right Feature Card */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.3 }}
        >
          <div className="rounded-3xl bg-[#fbf9f4]/95 backdrop-blur-xl border border-[#ded5c2] p-8 shadow-[0_15px_40px_-10px_rgba(45,35,20,0.12)]">
            <div className="flex items-center gap-3.5 mb-6 pb-5 border-b border-[#ded5c2]/70">
              <div className="w-12 h-12 rounded-2xl bg-[#e4ede1] text-[#234e32] border border-[#c7d9c2] flex items-center justify-center shadow-xs">
                <HeartPulse size={24} />
              </div>
              <div>
                <div className="font-serif font-bold text-lg text-[#1b3d27]">Holistic Intake Flow</div>
                <div className="text-xs text-[#556358]">Requires attending physician verification</div>
              </div>
            </div>

            <motion.ul
              className="space-y-3 text-[#3e4a3f] text-xs sm:text-sm font-medium"
              initial="hidden"
              animate="show"
              variants={{
                hidden: { opacity: 0 },
                show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.4 } }
              }}
            >
              {[
                'Identify patient & Record consent',
                'Report chief complaints in 9 languages',
                'Speak answers using voice microphone',
                'Listen to questions using speech audio',
                'Medical report & document OCR upload',
                'Deterministic clinical red-flag triage',
                'Attending physician final decision'
              ].map((item) => (
                <motion.li
                  key={item}
                  className="flex items-center gap-3"
                  variants={{
                    hidden: { opacity: 0, x: -8 },
                    show: { opacity: 1, x: 0 }
                  }}
                >
                  <span className="w-2 h-2 rounded-full bg-[#234e32] shrink-0" />
                  <span>{item}</span>
                </motion.li>
              ))}
            </motion.ul>

            <div className="mt-7 pt-5 border-t border-[#ded5c2]/70 flex items-center gap-2.5 text-xs text-[#6e7d70]">
              <ShieldCheck size={16} className="text-[#234e32] shrink-0" />
              <span>Your privacy is protected. MediKiosk complies with healthcare data safety standards.</span>
            </div>
          </div>
        </motion.div>
      </section>
    </AyurvedaBackground>
  );
}
