import { SidebarData } from "hasyx/components/sidebar";
import pckg from "hasyx/package.json";

export const sidebar: SidebarData = {
  name: pckg.name,
  version: pckg.version,
  logo: "logo.svg",
  navMain: [
    {
      title: "Core",
      url: "#",
      items: [
        {
          title: "Diagnostics",
          url: "/",
        },
        {
          title: "A-Frame",
          url: "/aframe",
        },
      ],
    },
  ],
};

export default sidebar;