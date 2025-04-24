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
    {/* Ensure A-Frame can run on the client */}
    <AframeProvider>
      <Scene embedded style={sceneStyle} renderer="alpha: true; colorManagement: true;"> 
        {/* White background - REMOVED */}
        {/* <a-sky color="#FFFFFF"></a-sky> */}

        {/* Black box on the floor */}
        {/* @ts-ignore */}
        <Entity geometry={{ primitive: 'box' }} material={{ color: 'black' }} position={{ x: 0, y: 0.5, z: -3 }} />

        {/* Basic Camera & Cursor - Можно оставить Entity или использовать a-camera */}
        {/* @ts-ignore */}
        <Entity primitive="a-camera">
          {/* @ts-ignore */}
          <Entity primitive="a-cursor" />
        </Entity>
      </Scene>
    </AframeProvider>
  </>)
}
