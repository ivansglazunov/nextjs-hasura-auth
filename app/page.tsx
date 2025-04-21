import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

import pckg from "@/package.json"

import { HasuraCard } from "@/components/hasura/card"
import { ProxyCard } from "@/components/proxy/card"
import { CredentialsSignInCard } from "@/components/auth/credentials-signin-card"
import { SessionCard } from "@/components/auth/session-card"
import { AuthActionsCard } from "@/components/auth/auth-actions-card"
import { UsersCard } from "@/components/users/users-card"

// Imports for getting server-side session
import { getServerSession } from "next-auth/next"
import authOptions from "@/app/api/auth/[...nextauth]/options" 
import { Session } from "next-auth" // Import Session type

// Now this is an async server component
export default async function Page() {
  // Get session on the server
  const session: Session | null = await getServerSession(authOptions);

  return (
    <SidebarProvider>
      <AppSidebar activeUrl={'/'} />
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
