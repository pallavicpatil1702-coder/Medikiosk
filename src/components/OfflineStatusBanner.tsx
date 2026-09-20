"use client";

import { useEffect, useState } from 'react';
import { useNetworkState } from '@/hooks/useNetworkState';
import { WifiOff, Wifi, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function OfflineStatusBanner() {
  const { isOnline } = useNetworkState();
  const [showOnline, setShowOnline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowOnline(false);
    } else if (isOnline && wasOffline) {
      setShowOnline(true);
      // Hide the "Back Online" message after 4 seconds
      const t = setTimeout(() => {
        setShowOnline(false);
        setWasOffline(false);
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [isOnline, wasOffline]);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-[#fff9e6] border-b border-[#f0e3b6] px-4 py-2 flex items-center justify-center shadow-sm z-50 relative"
        >
          <div className="flex items-center gap-2 text-[#856404] text-xs sm:text-sm font-medium">
            <WifiOff size={16} />
            <span>Offline Mode: Your information is saved locally and will sync when connection returns.</span>
          </div>
        </motion.div>
      )}

      {showOnline && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-[#e8f5e9] border-b border-[#c8e6c9] px-4 py-2 flex items-center justify-center shadow-sm z-50 relative"
        >
          <div className="flex items-center gap-2 text-[#2e7d32] text-xs sm:text-sm font-medium">
            <CheckCircle2 size={16} />
            <span>Back Online: Syncing your consultation...</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
