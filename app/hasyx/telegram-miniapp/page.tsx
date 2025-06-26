'use client';

import sidebar from "@/app/sidebar";
import pckg from "@/package.json";
import { SidebarLayout } from "hasyx/components/sidebar/layout";
import TelegramMiniAppPage from "hasyx/lib/telegram-miniapp-page";

export default function Page() {
  return (
    <SidebarLayout sidebarData={sidebar} breadcrumb={[{ title: pckg.name, link: '/' }]}>
      <TelegramMiniAppPage/>
    </SidebarLayout>
  );
} 