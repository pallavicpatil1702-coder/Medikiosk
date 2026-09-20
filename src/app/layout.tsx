import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "MediKiosk — AI-Assisted Healthcare Intake",
  description: "Internal SIH MVP for AI-Assisted Healthcare Intake",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-[#dbe4d5] selection:text-[#1b3d27]">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
