import { SidebarData } from "hasyx/components/sidebar";
import pckg from "hasyx/package.json";

export const sidebar: SidebarData = {
  name: pckg.name,
  version: pckg.version,
  logo: "logo.svg",
  navMain: [
    {
      title: "Home",
      url: "/",
      items: [],
    },
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
          title: "Payments",
          url: "/hasyx/payments",
        },
      ],
    },
  ],
};

export default sidebar;