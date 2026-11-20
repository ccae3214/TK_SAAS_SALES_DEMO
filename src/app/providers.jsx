"use client";
import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from "@/context/LanguageContext";
import { AuthProvider } from "@/context/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import LineLanguageSync from "@/components/LineLanguageSync";

export default function Providers({ children }) {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <LanguageProvider>
          <AuthProvider>
            <LineLanguageSync />
            {children}
          </AuthProvider>
        </LanguageProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}
