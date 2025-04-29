import { SidebarData } from "hasyx/components/sidebar";
import pckg from "hasyx/package.json";

export const sidebar: SidebarData = {
  versions: [pckg.version],
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