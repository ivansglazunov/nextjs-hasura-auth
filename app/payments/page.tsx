import sidebar from "@/app/sidebar";
import Payments from "@/components/payments";
import authOptions from "@/app/options";
import useSsr, { SsrResult } from "hasyx/lib/ssr";

export default async function PaymentsPage() {
  const { session } = await useSsr(authOptions) as SsrResult;

  return (
    <Payments 
      sidebarData={sidebar} 
    />
  );
} 