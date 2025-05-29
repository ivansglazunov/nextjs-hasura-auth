import authOptions from "@/app/options"
import sidebar from "@/app/sidebar"
import Constructor from "hasyx/lib/constructor"
import useSsr, { SsrResult } from "hasyx/lib/ssr"

export default async function ConstructorPage() {
  const { session } = await useSsr(authOptions) as SsrResult;

  return (
    <Constructor 
      serverSession={session} 
      sidebarData={sidebar} 
    />
  );
} 