"use client";

import { SidebarData } from "hasyx/components/sidebar";
import { SidebarLayout } from "hasyx/components/sidebar/layout";
import { AuthActionsCard } from "hasyx/components/auth/auth-actions-card";
import { CredentialsSignInCard } from "hasyx/components/auth/credentials-signin-card";
import { SessionCard } from "hasyx/components/auth/session-card";
import { HasuraCard } from "hasyx/components/hasura/card";
import { ProxyCard } from "hasyx/components/proxy/card";
import { UsersCard } from "hasyx/components/users/users-card";
import { NotificationCard } from "hasyx/components/notify";
// import { TelegramDebugCard } from "hasyx/components/auth/telegram-debug-card";
import { Session } from "next-auth";

interface DiagnosticsProps {
  serverSession: Session | null;
  sidebarData: SidebarData;
}

export default function Diagnostics({ serverSession, sidebarData }: DiagnosticsProps) {
  return (
    <SidebarLayout sidebarData={sidebarData} breadcrumb={[
      { title: 'Hasyx', link: '/' },
      { title: 'Diagnostics', link: '/hasyx/diagnostics' }
    ]}>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="grid auto-rows-min gap-4 md:grid-cols-2">
          <HasuraCard />
          <ProxyCard />
          <CredentialsSignInCard />
          <AuthActionsCard />
          <SessionCard serverSession={serverSession} />
          <NotificationCard />
          <UsersCard />
          {/* <TelegramDebugCard /> */}
        </div>
        <div className="grid auto-rows-min gap-4 md:grid-cols-3">
          <div className="aspect-video rounded-xl bg-muted/50" />
          <div className="aspect-video rounded-xl bg-muted/50" />
          <div className="aspect-video rounded-xl bg-muted/50" />
        </div>
        <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min" />
      </div>
    </SidebarLayout>
  );
} 