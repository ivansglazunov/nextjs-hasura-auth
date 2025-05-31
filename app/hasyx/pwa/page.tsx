import authOptions from "@/app/options"
import sidebar from "@/app/sidebar"
import PWADiagnostics from "hasyx/lib/pwa-diagnostics"
import useSsr, { SsrResult } from "hasyx/lib/ssr"

export default async function PWADiagnosticsPage() {
  const { session } = await useSsr(authOptions) as SsrResult;

  return (
    <PWADiagnostics 
      serverSession={session} 
      sidebarData={sidebar} 
    />
  );
} 