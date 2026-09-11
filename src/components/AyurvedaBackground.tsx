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
    <div className={`ayur-bg-container ${className}`}>
      <div className={overlayClass}>
        {children}
      </div>
    </div>
  );
}
