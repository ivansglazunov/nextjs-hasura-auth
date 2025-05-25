import { SidebarData } from "hasyx/components/sidebar";
import pckg from "@/package.json";

export const sidebar: SidebarData = {
  name: pckg.name,
  version: pckg.version,
  logo: "logo.svg",
  navMain: [
    {
      title: "Hasyx",
      url: "#",
      items: [
        {
          title: "Diagnostics",
          url: "/hasyx/diagnostics",
        },
        {
          title: "A-Frame",
          url: "/hasyx/aframe",
        },
        {
          title: "Cyto",
          url: "/hasyx/cyto",
        },
        {
          title: "Payments",
          url: "/hasyx/payments",
        },
      ],
    },
  ],
};

export default sidebar;