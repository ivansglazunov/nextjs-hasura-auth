import React from 'react'; // Import React

import sidebar from "@/app/sidebar"; // Make sure the path is correct
import { Sidebar } from "hasyx/components/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "hasyx/components/ui/breadcrumb";
import { Separator } from "hasyx/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "hasyx/components/ui/sidebar";
import pckg from "hasyx/package.json";
import AframeClient from './client';
import { AframeProvider } from 'hasyx/lib/aframe';

// This page needs to be a client component for A-Frame
export default function AframePage() {
  // Styles for the scene container to make it fill available space
  const sceneContainerStyle: React.CSSProperties = {
    position: 'relative', // Needed for absolute positioning of scene inside
    flexGrow: 1,          // Occupies all available vertical space
    width: '100%',
    height: 'calc(100vh - 4rem)', // Example: viewport height minus header height
    overflow: 'hidden',    // Prevent extra scrolling
    backgroundColor: 'white',
  };

  return (
    <SidebarProvider>
      {/* Make sure that activeUrl is correct */}
      <Sidebar activeUrl={'/aframe'} data={sidebar} />
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
                <BreadcrumbPage>A-Frame</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        {/* A-Frame Scene Container - Apply styles */}
        <div style={sceneContainerStyle}>
          <AframeProvider>
            <AframeClient />
          </AframeProvider>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

