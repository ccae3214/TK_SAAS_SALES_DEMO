"use client";
import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from "@/context/LanguageContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import LineLanguageSync from "@/components/LineLanguageSync";

export default function Providers({ children }) {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <LanguageProvider>
          <LineLanguageSync />
          {children}
        </LanguageProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}
