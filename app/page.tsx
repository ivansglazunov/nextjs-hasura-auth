import { Sidebar } from "@/components/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "hasyx/components/ui/breadcrumb"
import { Separator } from "hasyx/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "hasyx/components/ui/sidebar"

import pckg from "hasyx/package.json"

import { AuthActionsCard } from "hasyx/components/auth/auth-actions-card"
import { CredentialsSignInCard } from "hasyx/components/auth/credentials-signin-card"
import { SessionCard } from "hasyx/components/auth/session-card"
import { HasuraCard } from "hasyx/components/hasura/card"
import { ProxyCard } from "hasyx/components/proxy/card"
import { UsersCard } from "hasyx/components/users/users-card"

// Imports for getting server-side session
import authOptions from "@/app/options"

import sidebar from "@/app/sidebar"
import useSsr, { SsrResult } from "@/lib/ssr"

// Now this is an async server component
export default async function Page() {
  // Get session on the server
  const { session } = await useSsr(authOptions) as SsrResult;
  // const session = null;
  return (
    <SidebarProvider>
      <Sidebar activeUrl={'/'} data={sidebar} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/">
                  {pckg.name}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Diagnostics</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="grid auto-rows-min gap-4 md:grid-cols-2">
            <HasuraCard/>
            <ProxyCard/>
            <CredentialsSignInCard />
            <AuthActionsCard />
            <SessionCard serverSession={session}/>
            <UsersCard />
          </div>
          <div className="grid auto-rows-min gap-4 md:grid-cols-3">
            <div className="aspect-video rounded-xl bg-muted/50" />
            <div className="aspect-video rounded-xl bg-muted/50" />
            <div className="aspect-video rounded-xl bg-muted/50" />
          </div>
          <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
