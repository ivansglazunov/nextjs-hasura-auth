"use client";

import { Session } from "next-auth";
import { SidebarData } from "hasyx/components/sidebar";
import PWADiagnostics from "hasyx/lib/pwa-diagnostics";

interface PWAPageClientProps {
  serverSession: Session | null;
  sidebarData: SidebarData;
}

export default function PWAPageClient({ serverSession, sidebarData }: PWAPageClientProps) {
  return (
    <PWADiagnostics 
      serverSession={serverSession} 
      sidebarData={sidebarData} 
    />
  );
} 