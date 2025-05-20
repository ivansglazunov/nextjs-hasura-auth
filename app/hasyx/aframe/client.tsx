'use client'

// Remove static import of A-Frame - we'll import it dynamically
import { AframeEntity as Entity, AframeScene as Scene } from 'hasyx/lib/aframe'; // Use the aliased exports
import React, { useEffect, useRef, useState } from 'react'; // Add useState for tracking

// This page needs to be a client component for A-Frame
export default function AframeClient() {
  const sceneRef = useRef<any>(null); // Use 'any' for now to bypass type issues
  const logSent = useRef(false); // Flag to send only once
  const [aframeLoaded, setAframeLoaded] = useState(false);

  const sceneStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 0, // Make sure the scene doesn't overlap UI
  };

  // First effect - load A-Frame dynamically only on the client side
  useEffect(() => {
    // Dynamically import A-Frame only on the client
    const loadAframe = async () => {
      try {
        await import('aframe');
        console.log('A-Frame loaded successfully');
        setAframeLoaded(true);
      } catch (error) {
        console.error('Failed to load A-Frame:', error);
      }
    };
    
    loadAframe();
  }, []);

  // Second effect - set up event listener after A-Frame is loaded
  useEffect(() => {
    if (!aframeLoaded) return; // Skip if A-Frame isn't loaded yet
    
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
  }, [aframeLoaded]); // Run this effect when aframeLoaded changes to true

  // Show loading state if A-Frame is not yet loaded
  if (!aframeLoaded) {
    return <div>Loading A-Frame...</div>;
  }

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
