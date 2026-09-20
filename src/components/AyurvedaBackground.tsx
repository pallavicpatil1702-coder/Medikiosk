import type { ReactNode } from 'react';

interface AyurvedaBackgroundProps {
  children: ReactNode;
  variant?: 'landing' | 'kiosk' | 'clinical' | 'minimal';
  className?: string;
}

export default function AyurvedaBackground({
  children,
  variant = 'landing',
  className = ''
}: AyurvedaBackgroundProps) {
  const overlayClass = 
    variant === 'landing' ? 'ayur-overlay-landing' :
    variant === 'kiosk' ? 'ayur-overlay-kiosk' :
    variant === 'clinical' ? 'ayur-overlay-clinical' :
    'bg-[#fbf9f4]/90 backdrop-blur-md min-h-screen';

  return (
    <div className={`relative min-h-screen ${className}`}>
      {/* Background System Group (Fixed to viewport to prevent scroll cutoff & stacking context bugs) */}
      <div className="fixed inset-0 z-[-1] pointer-events-none">
        {/* Background Image Layer */}
        <div className="absolute inset-0 ayur-bg-container" />
        {/* Gradient / Blur Overlay Layer */}
        <div className={`absolute inset-0 ${overlayClass}`} />
      </div>

      {/* Content Layer */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  );
}
