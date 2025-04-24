"use client"

import { useEffect, useState } from "react";
import Debug from "./debug";

const debug = Debug('aframe');

export function useAframe() {
  const [aframe, setAframe] = useState();
  useEffect(() => {
    // @ts-ignore
    import('aframe')
      .then((module) => setAframe(module))
      .catch((err) => debug("Error loading A-Frame:", err));
  }, []);
  return aframe;
}

export function AframeProvider({ children }: { children: React.ReactNode }) {
  const aframe = useAframe();
  return <>{!!aframe && children}</>;
}
