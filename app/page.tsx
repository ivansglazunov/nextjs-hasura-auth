


// Imports for getting server-side session
import authOptions from "@/app/options"

import sidebar from "@/app/sidebar"
import Diagnostics from "hasyx/components/diagnostics"
import useSsr, { SsrResult } from "hasyx/lib/ssr"

// Now this is an async server component
export default async function Page() {
  const { session } = await useSsr(authOptions) as SsrResult;

  return (
    <Diagnostics 
      serverSession={session} 
      sidebarData={sidebar} 
    />
  );
}
