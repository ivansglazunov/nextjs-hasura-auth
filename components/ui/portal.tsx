"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface PortalProps {
  children: React.ReactNode;
  container?: HTMLElement | null;
  containerRef?: React.RefObject<HTMLElement>;
}

export const Portal = ({ children, container, containerRef }: PortalProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Support both direct container and containerRef approaches
  const targetContainer = 
    container || 
    (containerRef?.current) || 
    (typeof document !== "undefined" ? document.body : null);

  return mounted && targetContainer
    ? createPortal(children, targetContainer)
    : null;
}; 