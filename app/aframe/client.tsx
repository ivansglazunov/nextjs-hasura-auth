'use client'

import { AframeProvider } from '@/lib/aframe';
// import 'aframe'; // REMOVED static import
// Важно: Используйте '*' импорт, если стандартный не работает с вашей версией
// import * as aframeReact from 'aframe-react';
// const { Entity, Scene } = aframeReact;
// ИЛИ попробуйте именованный импорт, но он может не сработать из-за старости пакета
// @ts-ignore
import { Entity, Scene } from 'aframe-react';
import React from 'react'; // Import React and useEffect


// This page needs to be a client component for A-Frame
export default function AframeClient() {
  const sceneStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 0, // Убедитесь, что сцена не перекрывает UI
  };

  return (<>
    <AframeProvider>
      <Scene
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
    </AframeProvider>
  </>)
}
