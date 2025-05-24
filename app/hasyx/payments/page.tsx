import sidebar from "@/app/sidebar";
import Payments from "hasyx/components/payments";

export default function PaymentsPage() {
  return (
    <Payments sidebarData={sidebar} />
  );
} 