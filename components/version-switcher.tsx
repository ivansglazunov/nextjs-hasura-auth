"use client"

import * as React from "react"
import { Check, ChevronsUpDown, GalleryVerticalEnd } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "hasyx/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "hasyx/components/ui/sidebar"

import Image from "next/image"
import { Label } from 'hasyx/components/ui/label'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function ProjectAndVersion({
  name,
  logo,
  version,
}: {
  name: string;
  logo?: string;
  version: string;
}) {    
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <div className="flex size-8 items-center justify-center">
            <Image src={`${basePath}/${logo || 'logo.svg'}`} alt="Hasyx Logo" width={32} height={32} />
          </div>
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="font-semibold">{name}</span>
            <span className="">v{version}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
