# `lib/cyto.tsx` Documentation (Graph Visualizations)

## Overview

The `lib/cyto.tsx` module provides a set of React components for integrating and managing Cytoscape.js graph visualizations within your Hasyx application. It allows you to declaratively describe graph nodes, edges, and styles, and easily embed custom HTML markup directly into graph nodes, all while retaining the benefits of the React ecosystem.

The primary goal of this module is to simplify the creation of interactive and customizable graph diagrams without detaching from your familiar UI framework.

## Core Components

### 1. `<Cyto />`

This is the root component for any graph visualization. It initializes a Cytoscape instance and provides context for child components (`CytoNode`, `CytoEdge`, `CytoStyle`).

**Key Props:**

*   `onLoaded?: (cy) => void`: A callback function invoked after the Cytoscape instance (`cy`) is initialized. Allows direct access to the Cytoscape API.
*   `onInsert?: (inserted, insertQuery) => void`: Callback for handling the creation of new edges (e.g., via the built-in edge drawing mode).
*   `layout?: any`: Node layout configuration. Can be an object (e.g., `{ name: 'cola', ... }`) or a function returning such an object. Defaults to `'cola'`.
*   `buttons?: boolean`: Whether to display standard control buttons (default `true`).
*   `buttonsChildren?: React.ReactNode`: Additional React elements to display in the buttons block.
*   `children`: Child elements, typically `CytoNode`, `CytoEdge`, and `CytoStyle`. **Crucially, this is where you'll directly map your data to graph elements!**

### 2. `<CytoNode />`

A component for defining a node in the graph.

**Key Props:**

*   `element`: An object describing the node in a Cytoscape-compatible format.
    *   `id: string`: Unique identifier for the node.
    *   `data: object`: Data associated with the node (e.g., `{ id: 'node1', label: 'Node 1', type: 'user' }`). The `id` in `data` must match `element.id`.
    *   `position?: { x: number, y: number }`: Initial position of the node.
    *   `classes?: string[]`: CSS classes for styling via the Cytoscape stylesheet.
    *   `locked?: boolean`: Lock the node.
    *   `grabbable?: boolean`: Whether the node can be dragged.
*   `children?: React.ReactNode`: **Important Feature!** If any HTML markup or React components are passed as children to `CytoNode`, this markup will be rendered as the node's content.
    *   **Automatic Sizing:** The Cytoscape node's size will automatically adjust to the dimensions of this HTML/React content, thanks to `ResizeObserver`.
    *   **Positioning:** The React element (your markup) will be positioned precisely over the corresponding Cytoscape node. Graph scaling and panning will be correctly applied to the HTML elements.
*   `onClick?: (event) => void`: Callback when the node is clicked.
*   `onMount?: (element) => void`: Callback when the node is mounted.
*   `onUnmount?: (element) => void`: Callback when the node is unmounted.

### 3. `<CytoEdge />`

A component for defining an edge (link) between nodes.

**Key Props:**

*   `element`: An object describing the edge.
    *   `id: string`: Unique identifier for the edge.
    *   `data: object`: Must contain `id`, `source` (ID of the source node), and `target` (ID of the target node). E.g., `{ id: 'edge1', source: 'node1', target: 'node2', label: 'connects' }`.
    *   `classes?: string[]`: CSS classes.
*   `onClick?: (event) => void`: Callback when the edge is clicked.

### 4. `<CytoStyle />`

Allows for declarative and reactive application of styles to the graph. Multiple `CytoStyle` instances can be used for different sets of styles.

**Key Props:**

*   `stylesheet`: An array of style objects in Cytoscape format. For example:
    ```javascript
    [
      { selector: 'node', style: { 'background-color': 'blue', 'label': 'data(label)' } },
      { selector: 'edge', style: { 'line-color': 'gray', 'width': 2 } }
    ]
    ```

### 5. `useGraph()`

A React hook to access the graph's context, including the Cytoscape instance (`cyRef.current`), `relayout` function, and other utilities from the `<Cyto />` component.

## Comprehensive Usage Example

This example demonstrates creating a simple graph with two types of nodes (users and their accounts), custom HTML rendering for nodes, and style application.

```tsx
"use client"

import React, { useEffect, useState } from 'react';
import { Cyto, CytoNode, CytoEdge, CytoStyle, useGraph } from '@/lib/cyto'; // Path to your module
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; // Example UI component
import { Button } from '@/components/ui/button';

// 1. Define styles for Cytoscape
const myStylesheet = [
  {
    selector: 'node', // Common styles for all nodes
    style: {
      'background-color': '#000000', // Base Cytoscape node background
      'background-opacity': 0,      // Make it transparent, as HTML content will be used
      'shape': 'rectangle',         // Define a shape (can be overridden by HTML content size)
      // 'width' and 'height' will be automatically determined by the HTML children of CytoNode
    }
  },
  {
    selector: '.user-node', // Styles for user nodes (applied if you add this class to CytoNode element)
    style: {
      // You can add specific Cytoscape styles here if needed for aspects not covered by HTML
    }
  },
  {
    selector: '.account-node', // Styles for account nodes
    style: {
      // ...
    }
  },
  {
    selector: 'edge', // Styles for edges
    style: {
      'width': 2,
      'line-color': '#d3d3d3',
      'target-arrow-color': '#d3d3d3',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'label': 'data(label)', // Display edge label if 'label' is in edge.data
      'font-size': '10px',
      'color': '#555',
      'text-outline-color': '#fff',
      'text-outline-width': 2,
    }
  },
  {
    selector: '.special-edge', // Example class for edges
    style: {
      'line-color': 'red',
      'target-arrow-color': 'red',
    }
  }
];

// Example data structure (e.g., from a hook like useSubscription)
interface Account {
  id: string;
  provider: string;
}

interface User {
  id: string;
  name: string;
  image?: string;
  accounts: Account[];
}

// Example custom button for the graph
const CustomGraphButtons = () => {
  const { cyRef, relayout } = useGraph(); // Access to cy instance and relayout function

  const handleZoomIn = () => {
    if (cyRef.current) cyRef.current.zoom(cyRef.current.zoom() * 1.2);
  };

  const handleZoomOut = () => {
    if (cyRef.current) cyRef.current.zoom(cyRef.current.zoom() * 0.8);
  };

  return (
    <>
      <Button onClick={handleZoomIn} style={{ pointerEvents: 'all' }}>Zoom In</Button>
      <Button onClick={handleZoomOut} style={{ pointerEvents: 'all' }}>Zoom Out</Button>
      <Button onClick={() => relayout()} style={{ pointerEvents: 'all' }}>Relayout</Button>
    </>
  );
};

export default function MyGraphPage() {
  // Imagine 'users' comes from a subscription or API call
  const [users, setUsers] = useState<User[]>([
    { 
      id: 'user1', name: 'Alice Wonderland', image: 'https://example.com/alice.png', 
      accounts: [
        { id: 'acc1-1', provider: 'GitHub' },
        { id: 'acc1-2', provider: 'Google' }
      ] 
    },
    { 
      id: 'user2', name: 'Bob The Builder', image: 'https://example.com/bob.png',
      accounts: [
        { id: 'acc2-1', provider: 'GitLab' }
      ]
    },
  ]);

  const handleNodeClick = (event: any) => {
    const node = event.target;
    console.log('Node clicked:', node.id(), node.data());
  };
  
  const handleEdgeClick = (event: any) => {
    const edge = event.target;
    console.log('Edge clicked:', edge.id(), edge.data());
  };

  const handleGraphLoaded = (cyInstance: any) => {
    console.log('Graph is fully loaded!', cyInstance);
    cyInstance.zoom(1); // Example: Set initial zoom
    cyInstance.center(); // Example: Center the graph
  };

  // **The Magic Happens Here: Direct Data Mapping to Graph Components!**
  // No more pre-processing data into separate nodes and edges arrays.
  // Just map your data directly within the <Cyto> component. How cool is that?!

  return (
    <div style={{ width: '100%', height: '600px', border: '1px solid #ccc' }}>
      <Cyto
        onLoaded={handleGraphLoaded}
        layout={{ 
          name: 'cola', 
          nodeDimensionsIncludeLabels: true,
          fit: false, // Usually false if you set zoom/center in onLoaded or want to preserve user's view
          padding: 30,
          animate: true,
        }}
        buttons={true} 
        buttonsChildren={<CustomGraphButtons />}
      >
        {/* 1. Apply styles using CytoStyle */}
        <CytoStyle stylesheet={myStylesheet} />

        {/* 2. Render nodes and edges by directly mapping your data source */}
        {(users || []).map((user) => (
          <React.Fragment key={user.id}>
            {/* User Node */}
            <CytoNode 
              element={{
                id: `user-${user.id}`, // Ensure unique IDs for Cytoscape
                data: { 
                  id: `user-${user.id}`, // Cytoscape internal data ID
                  label: user.name,      // Used by Cytoscape for layout if not using HTML labels
                  // ...any other user data you want accessible in Cytoscape
                },
                classes: ['user-node'] // Optional: for Cytoscape-specific styling
              }}
              onClick={handleNodeClick}
            >
              {/* Custom React Component for User Node! */}
              <div style={{
                padding: '10px',
                background: '#a9def9',
                borderRadius: '8px',
                border: '1px solid #6c99b8',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '2px 2px 5px rgba(0,0,0,0.1)',
                minWidth: '180px' 
              }}>
                <Avatar>
                  <AvatarImage src={user.image} alt={user.name} />
                  <AvatarFallback>{user.name?.split(' ').map(name => name[0]).join('')}</AvatarFallback>
                </Avatar>
                <span>{user.name}</span>
              </div>
            </CytoNode>

            {/* Account Nodes and Edges for this User */}
            {(user.accounts || []).map((account) => (
              <React.Fragment key={account.id}>
                <CytoNode 
                  element={{
                    id: `account-${account.id}`,
                    data: {
                      id: `account-${account.id}`,
                      label: account.provider,
                      // ...any other account data
                    },
                    classes: ['account-node']
                  }}
                  onClick={handleNodeClick}
                >
                  {/* Custom React Component for Account Node! */}
                  <div style={{
                    padding: '8px',
                    background: '#e3f2fd',
                    borderRadius: '4px',
                    border: '1px solid #90caf9',
                    textAlign: 'center',
                    boxShadow: '1px 1px 3px rgba(0,0,0,0.05)',
                    minWidth: '100px' 
                  }}>
                    {/* Example: Using a Badge component */}
                    {/* <Badge variant="outline">{account.provider}</Badge> */}
                    <strong>{account.provider}</strong>
                  </div>
                </CytoNode>

                {/* Edge connecting User to Account */}
                <CytoEdge 
                  element={{
                    id: `edge-${user.id}-${account.id}`,
                    data: {
                      id: `edge-${user.id}-${account.id}`,
                      source: `user-${user.id}`,       // ID of the source CytoNode
                      target: `account-${account.id}`, // ID of the target CytoNode
                      label: 'has account'           // Optional: label for the edge
                    },
                    // classes: ['special-edge'] // Optional: for specific edge styling
                  }}
                  onClick={handleEdgeClick}
                />
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}
      </Cyto>
    </div>
  );
}
```

## Key Aspects and Benefits

*   **Declarativeness & Direct Data Mapping:** This is where `hasyx/lib/cyto` truly shines! You can now directly map your data structures (like arrays of users, each with nested arrays of accounts) into `<CytoNode>` and `<CytoEdge>` components within your JSX. No more tedious pre-processing of data into separate `nodes` and `edges` arrays. Just map and render – it's that simple and incredibly powerful! This makes your graph definitions much more readable and aligned with the natural structure of your data.
*   **Full React Component Power in Nodes:** The ability to use any HTML markup and **your existing React components** for node display offers immense design flexibility. Cytoscape node sizes automatically synchronize with your HTML/React content dimensions. This means you can leverage your entire component library (like `Avatar`, `Badge`, custom cards, etc.) directly within your graph nodes.
*   **Reactivity:** Changes in your data source (e.g., the `users` array in the example) will reactively update the graph. Add a user, and a new node appears. Remove an account, and its node and edge disappear. All handled seamlessly by React's rendering lifecycle.
*   **UI Framework Integration:** Effortlessly integrates with components from your UI framework (e.g., `Avatar`, `Button` from `hasyx/components/ui` or any other library).
*   **Ease of Creation:** Radically simplifies the creation of complex, dynamic, and interactive graph visualizations by abstracting many details of direct Cytoscape API interaction, while still providing access to it via `onLoaded` or `useGraph` if needed.
*   **Standard Cytoscape Elements:** The `element` props for `CytoNode` and `CytoEdge` still expect data in the standard Cytoscape element format for their core definition (`id`, `data.id`, `data.source`, `data.target`), making transition or integration with existing Cytoscape logic simpler if necessary.
*   **Reactive Styles:** The `<CytoStyle />` component allows adding or changing graph styles anywhere in the component tree, and these changes will be reactively applied to the graph.

This module, with its enhanced direct data mapping and full React component support for nodes, provides an exceptionally powerful and developer-friendly tool for visualizing complex relationships and data structures in your React applications. It's a game-changer for graph visualization in React!
