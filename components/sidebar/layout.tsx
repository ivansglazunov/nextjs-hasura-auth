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
import { UserProfileDropdown } from "./user-profile-dropdown";

interface SidebarLayoutProps {
  children: React.ReactNode;
  sidebarData: SidebarData;
  breadcrumb?: { title: string; link?: string }[];
}

export function SidebarLayout({ 
  children, 
  sidebarData, 
  breadcrumb = [],
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
              {breadcrumb.map((item, i) => (<React.Fragment key={i}>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href={item.link || '#'}>
                    {item.title}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {i < breadcrumb.length - 1 && (
                  <BreadcrumbSeparator className="hidden md:block" />
                )}
              </React.Fragment>))}
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto">
            <UserProfileDropdown />
          </div>
        </header>
        <div className="flex flex-1 flex-col">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
} 