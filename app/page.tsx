// Imports for getting server-side session

import { SidebarLayout } from "hasyx/components/sidebar/layout";
import sidebar from "@/app/sidebar";
import pckg from "@/package.json";

// Now this is an async server component
export default function Page() {
  return (
    <SidebarLayout sidebarData={sidebar} breadcrumb={[{ title: pckg.name, link: '/' }]}>
      <div className="flex flex-col items-center justify-center min-h-screen">
        <img 
          src="/logo.svg" 
          alt="Logo" 
          className="w-64 h-64"
        />
      </div>
    </SidebarLayout>
  );
}
