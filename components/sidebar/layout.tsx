"use client";

import React from 'react';
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
import { SidebarData } from "hasyx/components/sidebar";
import pckg from "hasyx/package.json";

interface SidebarLayoutProps {
  children: React.ReactNode;
  sidebarData: SidebarData;
  title: string;
  backLink?: string;
  backText?: string;
}

export function SidebarLayout({ 
  children, 
  sidebarData, 
  title,
  backLink = "/",
  backText = pckg.name
}: SidebarLayoutProps) {
  return (
    <SidebarProvider>
      <Sidebar data={sidebarData} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href={backLink}>
                  {backText}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
} 