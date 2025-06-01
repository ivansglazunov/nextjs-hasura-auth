"use client"

import sidebar from "@/app/sidebar";
import pckg from "@/package.json";
import { SidebarLayout } from "hasyx/components/sidebar/layout";
import { useState } from "react";
import dynamic from "next/dynamic";

const Client = dynamic(() => import("./client"), { ssr: false });

// Now this is an async server component
export default function Page() {
  return (
    <SidebarLayout sidebarData={sidebar} breadcrumb={[{ title: pckg.name, link: '/' }]}>
      <Client />
    </SidebarLayout>
  );
}
