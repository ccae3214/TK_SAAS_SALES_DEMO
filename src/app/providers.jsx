"use client";
import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from "@/context/LanguageContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import LineLanguageSync from "@/components/LineLanguageSync";
import HrLaunchHandler from "@/components/HrLaunchHandler";
import HrSessionGuard from "@/components/HrSessionGuard";

export default function Providers({ children }) {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <LanguageProvider>
          <LineLanguageSync />
          <HrLaunchHandler />
          <HrSessionGuard />
          {children}
        </LanguageProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}
