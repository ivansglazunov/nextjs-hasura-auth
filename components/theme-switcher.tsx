"use client";

import { Button } from "hasyx/components/ui/button";
import { useTheme } from "next-themes";

export interface SidebarItem {
  title: string;
  url: string;
  items?: SidebarItem[];
}

export interface SidebarData {
  versions: string[];
  navMain: SidebarItem[];
}

export function ThemeSwitcher(props: any) {
  const { theme, setTheme } = useTheme();
  return (
    <Button {...props} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      {theme === 'dark' ? 'Light' : 'Dark'}
    </Button>
  )
}
