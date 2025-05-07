import {
  Sidebar as SidebarComponent,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "hasyx/components/ui/sidebar";
import { ProjectAndVersion } from "hasyx/components/version-switcher";
import { ThemeSwitcher } from "./theme-switcher";

export interface SidebarItem {
  title: string;
  url: string;
  items?: SidebarItem[];
}

export interface SidebarData {
  name: string;
  version: string;
  logo?: string;
  logoLight?: string;
  logoDark?: string;
  navMain: SidebarItem[];
}

export function Sidebar({ activeUrl, data }: { activeUrl: string, data: SidebarData }) {
  return (
    <SidebarComponent>
      <SidebarHeader>
        <ProjectAndVersion
          name={data.name}
          logo={data.logo}
          version={data.version}
        />
      </SidebarHeader>
      <SidebarContent>
        <ThemeSwitcher style={{ margin: 16 }} />
        {/* We create a SidebarGroup for each parent. */}
        {data.navMain.map((item) => (
          <SidebarGroup key={item.title}>
            <SidebarGroupLabel>{item.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {item?.items?.map((item) => (
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
    </SidebarComponent>
  )
}
