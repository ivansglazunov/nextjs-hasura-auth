import * as React from "react"

import { SearchForm } from "hasyx/components/search-form"
import { VersionSwitcher } from "hasyx/components/version-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "hasyx/components/ui/sidebar"
import pckg from "hasyx/package.json"

// This is sample data.
const data = {
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
}

export function AppSidebar({ activeUrl }: { activeUrl: string }) {
  return (
    <Sidebar>
      <SidebarHeader>
        <VersionSwitcher
          versions={data.versions}
          defaultVersion={data.versions[0]}
        />
        <SearchForm />
      </SidebarHeader>
      <SidebarContent>
        {/* We create a SidebarGroup for each parent. */}
        {data.navMain.map((item) => (
          <SidebarGroup key={item.title}>
            <SidebarGroupLabel>{item.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {item.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={item.url === activeUrl || item.url === activeUrl + "/"}>
                      <a href={item.url}>{item.title}</a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
