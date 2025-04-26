import pckg from "hasyx/package.json"
import { SidebarData } from "@/components/sidebar"
import {
  CircleDollarSign,
  Home,
  Settings,
  ShoppingBag,
  User,
  LogOut,
  Box,
} from "lucide-react"

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