"use client";

import { useEffect, useState } from "react";
import { getMarkdownFiles, type MarkdownFile } from "hasyx/lib/doc";
import { SidebarLayout } from "hasyx/components/sidebar/layout";
import sidebar from "@/app/sidebar";
import Link from "next/link";

export default function DocPage() {
  const [markdownFiles, setMarkdownFiles] = useState<MarkdownFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMarkdownFiles()
      .then(setMarkdownFiles)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <SidebarLayout 
        sidebarData={sidebar} 
        breadcrumb={[
          { title: 'Hasyx' },
          { title: 'Documentation', link: '/hasyx/doc' }
        ]}
      >
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-8">Documentation</h1>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-6 bg-card rounded-lg border animate-pulse">
                <div className="h-6 bg-muted rounded mb-2"></div>
                <div className="h-4 bg-muted rounded mb-4"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout 
      sidebarData={sidebar} 
      breadcrumb={[
        { title: 'Hasyx' },
        { title: 'Documentation', link: '/hasyx/doc' }
      ]}
    >
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Documentation</h1>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {markdownFiles.map((file) => (
            <Link
              key={file.filename}
              href={`/hasyx/doc/${encodeURIComponent(file.filename.replace('.md', ''))}`}
              className="block p-6 bg-card rounded-lg border hover:shadow-md transition-shadow"
            >
              <h2 className="text-xl font-semibold mb-2">{file.title}</h2>
              <p className="text-muted-foreground text-sm mb-4">
                {file.path}
              </p>
              {file.headings && file.headings.length > 1 && (
                <div className="text-sm">
                  <p className="font-medium mb-2">Contents:</p>
                  <ul className="space-y-1">
                    {file.headings.slice(1, 4).map((heading) => (
                      <li key={heading.id} className="text-muted-foreground">
                        {'  '.repeat(heading.level - 2)}• {heading.text}
                      </li>
                    ))}
                    {file.headings.length > 4 && (
                      <li className="text-muted-foreground">
                        ... and {file.headings.length - 4} more
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </Link>
          ))}
        </div>
        
        {markdownFiles.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No markdown files found in the project.</p>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
} 