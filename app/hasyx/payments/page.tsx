import sidebar from "@/app/sidebar";
import Payments from "@/components/payments";

export default function PaymentsPage() {
  return (
    <Payments sidebarData={sidebar} />
  );
} 