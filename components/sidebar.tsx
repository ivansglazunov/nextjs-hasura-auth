"use client";
import {
  Sidebar as SidebarComponent,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarRail,
} from "hasyx/components/ui/sidebar";
import { ProjectAndVersion } from "hasyx/components/version-switcher";
import { ThemeSwitcher } from "./theme-switcher";
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface SidebarItem {
  title: string;
  url: string;
  items?: SidebarItem[];
  collapse?: boolean;
}

export interface SidebarData {
  name: string;
  version: string;
  logo?: string;
  logoLight?: string;
  logoDark?: string;
  navMain: SidebarItem[];
}

export function Sidebar({ data }: { data: SidebarData }) {
  const pathname = usePathname();
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [manuallyCollapsed, setManuallyCollapsed] = useState<Set<string>>(new Set());
  
  // Load manually collapsed sections from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-collapsed-sections');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setManuallyCollapsed(new Set(parsed));
        } catch (error) {
          console.warn('Failed to parse saved collapsed sections:', error);
        }
      }
    }
  }, []);
  
  // Check if current path is within a section or item
  const isPathInSection = (item: SidebarItem): boolean => {
    // Direct URL match
    if (item.url === pathname || item.url === pathname + "/") return true;
    
    // For Documentation section, check if we're on any doc page
    if (item.title === "Documentation" && pathname.startsWith("/hasyx/doc")) {
      return true;
    }
    
    // For individual documents, check if current path matches the document
    if (pathname.startsWith("/hasyx/doc/") && item.url.startsWith("/hasyx/doc/")) {
      const currentDoc = pathname.split("/hasyx/doc/")[1]?.split("#")[0];
      const itemDoc = item.url.split("/hasyx/doc/")[1]?.split("#")[0];
      if (currentDoc === itemDoc) {
        return true;
      }
    }
    
    // Check sub-items recursively
    if (item.items) {
      return item.items.some(subItem => isPathInSection(subItem));
    }
    
    return false;
  };

  // Initialize collapsed state based on current path and manual preferences
  useEffect(() => {
    const newCollapsedSections = new Set<string>();
    
    // Helper function to process items recursively
    const processItems = (items: SidebarItem[]) => {
      items.forEach(item => {
        if (item.collapse) {
          const isCurrentSection = isPathInSection(item);
          const isManuallyExpanded = manuallyCollapsed.has(`expand-${item.title}`);
          const isManuallyCollapsed = manuallyCollapsed.has(item.title);
          
          // Debug logging
          console.log(`Processing item: ${item.title}`, {
            isCurrentSection,
            isManuallyExpanded,
            isManuallyCollapsed,
            pathname,
            itemUrl: item.url
          });
          
          // Default behavior: collapse all documents except current one
          // But respect manual user preferences
          if (isManuallyCollapsed) {
            // User manually collapsed this - keep it collapsed
            newCollapsedSections.add(item.title);
            console.log(`Collapsing ${item.title} - manually collapsed`);
          } else if (isManuallyExpanded) {
            // User manually expanded this - keep it expanded
            // Don't add to collapsed sections
            console.log(`Keeping ${item.title} expanded - manually expanded`);
          } else {
            // Default behavior: collapse all documents unless we're specifically on that document page
            // For documents, only expand if we're on the exact document page (not just in /hasyx/doc)
            if (pathname.startsWith("/hasyx/doc/") && item.url.startsWith("/hasyx/doc/")) {
              // We're on a specific document page - check if this is the current document
              const currentDoc = pathname.split("/hasyx/doc/")[1]?.split("#")[0];
              const itemDoc = item.url.split("/hasyx/doc/")[1]?.split("#")[0];
              if (currentDoc === itemDoc) {
                console.log(`Keeping ${item.title} expanded - is current document`);
                // Don't add to collapsed sections
              } else {
                newCollapsedSections.add(item.title);
                console.log(`Collapsing ${item.title} - not current document`);
              }
            } else {
              // We're not on a specific document page, collapse all documents
              newCollapsedSections.add(item.title);
              console.log(`Collapsing ${item.title} - not on document page`);
            }
          }
        }
        
        // Process nested items
        if (item.items) {
          processItems(item.items);
        }
      });
    };
    
    processItems(data.navMain);
    setCollapsedSections(newCollapsedSections);
  }, [pathname, data.navMain, manuallyCollapsed]);

  // Toggle collapse state for a section
  const toggleSection = (sectionTitle: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      const wasCollapsed = newSet.has(sectionTitle);
      
      if (wasCollapsed) {
        newSet.delete(sectionTitle);
      } else {
        newSet.add(sectionTitle);
      }
      
      // Update manual preferences
      setManuallyCollapsed(prevManual => {
        const newManual = new Set(prevManual);
        
        if (wasCollapsed) {
          // User manually expanded - remember this preference
          newManual.delete(sectionTitle);
          newManual.add(`expand-${sectionTitle}`);
        } else {
          // User manually collapsed - remember this preference
          newManual.add(sectionTitle);
          newManual.delete(`expand-${sectionTitle}`);
        }
        
        // Save to localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('sidebar-collapsed-sections', JSON.stringify(Array.from(newManual)));
        }
        
        return newManual;
      });
      
      return newSet;
    });
  };

  // Recursive function to render sidebar items
  const renderSidebarItems = (items: SidebarItem[]) => {
    return items.map((item) => {
      const isCurrentSection = isPathInSection(item);
      const isCollapsed = item.collapse && collapsedSections.has(item.title);
      const shouldShowContent = !item.collapse || !isCollapsed;
      
      return (
        <SidebarGroup key={item.title}>
          <SidebarGroupLabel 
            className={item.collapse ? "cursor-pointer flex items-center justify-between hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md px-2 py-1 transition-colors" : ""}
            onClick={item.collapse ? () => toggleSection(item.title) : undefined}
          >
            <span className="sidebar-text-truncate" title={item.title}>{item.title}</span>
            {item.collapse && (
              isCollapsed ? 
                <ChevronRight className="h-4 w-4 flex-shrink-0" /> : 
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
            )}
          </SidebarGroupLabel>
          {shouldShowContent && (
            <SidebarGroupContent>
              <SidebarMenu>
                {item?.items?.map((subItem) => {
                  // Check if this subItem is collapsible
                  if (subItem.collapse) {
                    // This is a collapsible document - render it as a collapsible section
                    const isSubItemCollapsed = collapsedSections.has(subItem.title);
                    const shouldShowSubContent = !isSubItemCollapsed;
                    
                    return (
                      <SidebarMenuItem key={subItem.title}>
                        <SidebarMenuButton 
                          asChild={!subItem.collapse}
                          isActive={isPathInSection(subItem)}
                          className={subItem.collapse ? "cursor-pointer flex items-center justify-between" : ""}
                          onClick={subItem.collapse ? () => toggleSection(subItem.title) : undefined}
                        >
                          {subItem.collapse ? (
                            <>
                              <span className="sidebar-sub-text-truncate" title={subItem.title}>{subItem.title}</span>
                              {isSubItemCollapsed ? 
                                <ChevronRight className="h-4 w-4 flex-shrink-0" /> : 
                                <ChevronDown className="h-4 w-4 flex-shrink-0" />
                              }
                            </>
                          ) : (
                            <a href={subItem.url} className="sidebar-sub-text-truncate" title={subItem.title}>{subItem.title}</a>
                          )}
                        </SidebarMenuButton>
                        {/* Render sub-items if they exist and section is not collapsed */}
                        {shouldShowSubContent && subItem.items && subItem.items.length > 0 && (
                          <SidebarMenuSub>
                            {subItem.items.map((subSubItem) => {
                              // Better active state detection for sub-items (headings)
                              const isSubSubItemActive = subSubItem.url === pathname || 
                                                        pathname.includes(subSubItem.url) ||
                                                        (typeof window !== 'undefined' && window.location.href.includes(subSubItem.url));
                              
                              return (
                                <SidebarMenuSubItem key={subSubItem.title}>
                                  <SidebarMenuSubButton 
                                    asChild
                                    isActive={isSubSubItemActive}
                                    className="w-full"
                                  >
                                    <a href={subSubItem.url} className="sidebar-subsub-text-truncate w-full max-w-full" title={subSubItem.title}>{subSubItem.title}</a>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        )}
                      </SidebarMenuItem>
                    );
                  } else {
                    // Regular non-collapsible item
                    const isSubItemActive = subItem.url === pathname || 
                                          subItem.url === pathname + "/" ||
                                          (pathname.startsWith("/hasyx/doc/") && subItem.url.includes(pathname.split("#")[0]));
                    
                    return (
                      <SidebarMenuItem key={subItem.title}>
                        <SidebarMenuButton asChild isActive={isSubItemActive}>
                          <a href={subItem.url} className="sidebar-sub-text-truncate" title={subItem.title}>{subItem.title}</a>
                        </SidebarMenuButton>
                        {/* Render sub-items if they exist */}
                        {subItem.items && subItem.items.length > 0 && (
                          <SidebarMenuSub>
                            {subItem.items.map((subSubItem) => {
                              // Better active state detection for sub-items (headings)
                              const isSubSubItemActive = subSubItem.url === pathname || 
                                                        pathname.includes(subSubItem.url) ||
                                                        (typeof window !== 'undefined' && window.location.href.includes(subSubItem.url));
                              
                              return (
                                <SidebarMenuSubItem key={subSubItem.title}>
                                  <SidebarMenuSubButton 
                                    asChild
                                    isActive={isSubSubItemActive}
                                    className="w-full"
                                  >
                                    <a href={subSubItem.url} className="sidebar-subsub-text-truncate w-full max-w-full" title={subSubItem.title}>{subSubItem.title}</a>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        )}
                      </SidebarMenuItem>
                    );
                  }
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>
      );
    });
  };
  
  return (
    <SidebarComponent>
      <SidebarHeader>
        <ProjectAndVersion
          name={data.name}
          logo={data.logo}
          version={data.version}
        />
      </SidebarHeader>
      <SidebarContent>
        <ThemeSwitcher style={{ margin: 16 }} />
        {/* Render all navigation items */}
        {renderSidebarItems(data.navMain)}
      </SidebarContent>
      <SidebarRail />
    </SidebarComponent>
  )
}
