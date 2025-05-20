import sidebar from "@/app/sidebar";
import Aframe from "@/lib/aframe";
import AframeClientComponent from "./client";

export default function AframePage() {
  return (
    <Aframe sidebarData={sidebar}>
      <AframeClientComponent />
    </Aframe>
  );
} 