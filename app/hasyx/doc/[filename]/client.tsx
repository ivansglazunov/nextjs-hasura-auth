"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { getMarkdownFile, type MarkdownFile } from "hasyx/lib/doc";
import { SidebarLayout } from "hasyx/components/sidebar/layout";
import sidebar from "@/app/sidebar";
import { Button } from "hasyx/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Hash } from "lucide-react";

export default function DocFilePageClient() {
  const params = useParams();
  const filename = params.filename as string;
  const [markdownFile, setMarkdownFile] = useState<MarkdownFile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (filename) {
      getMarkdownFile(decodeURIComponent(filename))
        .then(setMarkdownFile)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [filename]);

  useEffect(() => {
    // Handle hash navigation
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.substring(1);
      const element = document.getElementById(hash);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [markdownFile]);

  if (loading) {
    return (
      <SidebarLayout 
        sidebarData={sidebar} 
        breadcrumb={[
          { title: 'Hasyx' },
          { title: 'Documentation', link: '/hasyx/doc' },
          { title: 'Loading...' }
        ]}
      >
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-muted rounded w-full mb-2"></div>
            <div className="h-4 bg-muted rounded w-2/3 mb-2"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  if (!markdownFile) {
    return (
      <SidebarLayout 
        sidebarData={sidebar} 
        breadcrumb={[
          { title: 'Hasyx' },
          { title: 'Documentation', link: '/hasyx/doc' },
          { title: 'Not Found' }
        ]}
      >
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Document Not Found</h1>
            <p className="text-muted-foreground mb-6">
              The requested markdown file could not be found.
            </p>
            <Link href="/hasyx/doc">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Documentation
              </Button>
            </Link>
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
        { title: 'Documentation', link: '/hasyx/doc' },
        { title: markdownFile.title }
      ]}
    >
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-none">
          <div className="mb-6">
            <Link href="/hasyx/doc">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Documentation
              </Button>
            </Link>
            <div className="text-sm text-muted-foreground mb-2">
              {markdownFile.path}
            </div>
          </div>

          <article className="prose prose-neutral dark:prose-invert max-w-none">
            <Markdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[
                rehypeSlug,
                [rehypeAutolinkHeadings, { behavior: 'wrap' }]
              ]}
              components={{
                h1: ({ children, id }) => (
                  <h1 id={id} className="group relative">
                    {children}
                    {id && (
                      <a
                        href={`#${id}`}
                        className="absolute -left-6 top-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Link to this heading"
                      >
                        <Hash className="h-5 w-5" />
                      </a>
                    )}
                  </h1>
                ),
                h2: ({ children, id }) => (
                  <h2 id={id} className="group relative">
                    {children}
                    {id && (
                      <a
                        href={`#${id}`}
                        className="absolute -left-6 top-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Link to this heading"
                      >
                        <Hash className="h-5 w-5" />
                      </a>
                    )}
                  </h2>
                ),
                h3: ({ children, id }) => (
                  <h3 id={id} className="group relative">
                    {children}
                    {id && (
                      <a
                        href={`#${id}`}
                        className="absolute -left-6 top-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Link to this heading"
                      >
                        <Hash className="h-5 w-5" />
                      </a>
                    )}
                  </h3>
                ),
                h4: ({ children, id }) => (
                  <h4 id={id} className="group relative">
                    {children}
                    {id && (
                      <a
                        href={`#${id}`}
                        className="absolute -left-6 top-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Link to this heading"
                      >
                        <Hash className="h-5 w-5" />
                      </a>
                    )}
                  </h4>
                ),
                h5: ({ children, id }) => (
                  <h5 id={id} className="group relative">
                    {children}
                    {id && (
                      <a
                        href={`#${id}`}
                        className="absolute -left-6 top-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Link to this heading"
                      >
                        <Hash className="h-5 w-5" />
                      </a>
                    )}
                  </h5>
                ),
                h6: ({ children, id }) => (
                  <h6 id={id} className="group relative">
                    {children}
                    {id && (
                      <a
                        href={`#${id}`}
                        className="absolute -left-6 top-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Link to this heading"
                      >
                        <Hash className="h-5 w-5" />
                      </a>
                    )}
                  </h6>
                ),
              }}
            >
              {markdownFile.content}
            </Markdown>
          </article>
        </div>
      </div>
    </SidebarLayout>
  );
} 