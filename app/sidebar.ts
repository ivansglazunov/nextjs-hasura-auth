import pckg from "hasyx/package.json"
import { SidebarData } from "hasyx/components/app-sidebar"

export const sidebarData: SidebarData = {
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
      ],
    },
  ],
};
