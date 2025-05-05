'use client'

// Import A-Frame statically
import 'aframe';

// Import our forked components
import { AframeEntity as Entity, AframeScene as Scene } from '@/lib/aframe'; // Use the aliased exports
import React, { useEffect, useRef } from 'react'; // Restore imports


// This page needs to be a client component for A-Frame
export default function AframeClient() {
  const sceneRef = useRef<any>(null); // Use 'any' for now to bypass type issues
  const logSent = useRef(false); // Flag to send only once

  const sceneStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 0, // Make sure the scene doesn't overlap UI
  };

  // Effect to set up event listener and log after scene is loaded
  useEffect(() => {
    const sceneEl = sceneRef.current as any; // Cast to any to access addEventListener easily

    // Function to handle the logging logic
    const handleSceneLoad = () => {
      if (sceneEl && !logSent.current) {
        const sceneOuterHtml = sceneEl.outerHTML;
        logSent.current = true; // Set the flag

        // Log the HTML directly to the console
        console.log("--- A-Frame Scene Loaded outerHTML ---");
        console.log(sceneOuterHtml);
        console.log("--- End A-Frame Scene Loaded outerHTML ---");
      } else if (!sceneEl) {
          console.error("Scene element not found when 'loaded' event fired.");
      }
    };

    if (sceneEl) {
        // Check if the scene is already loaded (might happen with fast loading/re-renders)
        if (sceneEl.hasLoaded) {
            console.log("Scene already loaded, logging immediately.");
            handleSceneLoad();
        } else {
            console.log("Adding 'loaded' event listener to the scene.");
            sceneEl.addEventListener('loaded', handleSceneLoad);
        }
    } else {
        console.error("Scene element ref is not available on initial mount to add listener.");
    }

    // Cleanup function to remove the event listener
    return () => {
      if (sceneEl) {
        console.log("Removing 'loaded' event listener from the scene.");
        sceneEl.removeEventListener('loaded', handleSceneLoad);
      }
    };
  }, []); // Empty dependency array ensures this runs only once on mount to set up listener

  // Render the scene once A-Frame is loaded
  return (<>
    <Scene
      id="my-aframe-scene" // Adding ID for ref
      ref={(el) => { sceneRef.current = el; }} // Ensure ref callback returns void
      embedded style={sceneStyle} renderer="alpha: true; colorManagement: true;"
      webxr="requiredFeatures: local-floor; optionalFeatures: anchors, hit-test, dom-overlay, bounded-floor;" // Request AR features
      vr-mode-ui="enterAREnabled: true" // Ensure AR button is enabled
    >
      {/* @ts-ignore */}
      <Entity geometry={{ primitive: 'box' }} material={{ color: 'black' }} position={{ x: 0, y: 0.5, z: -3 }} />

      {/* @ts-ignore */}
      <Entity primitive="a-camera">
        {/* @ts-ignore */}
        <Entity primitive="a-cursor" />
      </Entity>
    </Scene>
  </>)
}
