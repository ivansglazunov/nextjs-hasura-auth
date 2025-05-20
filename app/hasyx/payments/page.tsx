import sidebar from "@/app/sidebar";
import Payments from "@/lib/payments";

export default function PaymentsPage() {
  return (
    <Payments sidebarData={sidebar} />
  );
} 