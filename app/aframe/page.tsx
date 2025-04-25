import React from 'react'; // Import React

import sidebar from "@/app/sidebar"; // Убедитесь, что путь правильный
import { AppSidebar } from "hasyx/components/app-sidebar";
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
import { AframeProvider } from '@/lib/aframe';

// This page needs to be a client component for A-Frame
export default function AframePage() {
  // Стили для контейнера сцены, чтобы она занимала доступное пространство
  const sceneContainerStyle: React.CSSProperties = {
    position: 'relative', // Нужно для абсолютного позиционирования сцены внутри
    flexGrow: 1,          // Занимает все доступное вертикальное пространство
    width: '100%',
    height: 'calc(100vh - 4rem)', // Пример: высота viewport минус высота хедера
    overflow: 'hidden',    // Предотвратить лишние скроллы
    backgroundColor: 'white',
  };

  return (
    <SidebarProvider>
      {/* Убедитесь, что activeUrl правильный */}
      <AppSidebar activeUrl={'/aframe'} data={sidebar} />
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
        {/* A-Frame Scene Container - Применяем стили */}
        <div style={sceneContainerStyle}>
          <AframeProvider>
            <AframeClient />
          </AframeProvider>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

// For static export (Capacitor)
export const dynamic = 'force-static';
