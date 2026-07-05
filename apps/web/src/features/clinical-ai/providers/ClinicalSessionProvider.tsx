"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface ClinicalSessionContextValue {
  /** Opaque reference to the CMS-side appointment/consultation this
   * session belongs to (architecture.md §12 — this repo never
   * validates or owns this beyond storing/forwarding it). */
  sessionRef: string;
  consentConfirmed: boolean;
  consentConfirmedAt: string | null;
  /** Explicit doctor action confirming patient consent for this
   * session (architecture.md §15 — never a pre-checked default). */
  confirmConsent: () => void;
}

const ClinicalSessionContext =
  createContext<ClinicalSessionContextValue | null>(null);

export interface ClinicalSessionProviderProps {
  sessionRef: string;
  children: ReactNode;
}

export function ClinicalSessionProvider({
  sessionRef,
  children,
}: ClinicalSessionProviderProps) {
  const [consentConfirmedAt, setConsentConfirmedAt] = useState<string | null>(
    null,
  );

  const confirmConsent = useCallback(() => {
    setConsentConfirmedAt(new Date().toISOString());
  }, []);

  const value = useMemo<ClinicalSessionContextValue>(
    () => ({
      sessionRef,
      consentConfirmed: consentConfirmedAt !== null,
      consentConfirmedAt,
      confirmConsent,
    }),
    [sessionRef, consentConfirmedAt, confirmConsent],
  );

  return (
    <ClinicalSessionContext.Provider value={value}>
      {children}
    </ClinicalSessionContext.Provider>
  );
}

export function useClinicalSession(): ClinicalSessionContextValue {
  const context = useContext(ClinicalSessionContext);
  if (!context) {
    throw new Error(
      "useClinicalSession must be used within a ClinicalSessionProvider",
    );
  }
  return context;
}
