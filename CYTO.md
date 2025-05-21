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
*   `children`: Child elements, typically `CytoNode`, `CytoEdge`, and `CytoStyle`.

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
*   `children?: React.ReactNode`: **Important Feature!** If any HTML markup is passed as a child to `CytoNode`, this markup will be rendered as the node's content.
    *   **Automatic Sizing:** The Cytoscape node's size will automatically adjust to the dimensions of this HTML markup, thanks to `ResizeObserver`.
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
      'background-color': '#f0f0f0', // Background color of the Cytoscape element itself (will be hidden by HTML)
      'border-width': 0, // Remove standard border as HTML will be used
      // 'width' and 'height' will be automatically set based on HTML content size
    }
  },
  {
    selector: '.user-node', // Specific styles for user nodes
    style: {
      // Specific Cytoscape styles can be added if needed for something not covered by HTML
    }
  },
  {
    selector: '.account-node', // Specific styles for account nodes
    style: {
      // ...
    }
  },
  {
    selector: 'edge', // Styles for edges
    style: {
      'width': 2,
      'line-color': '#9dbaea',
      'target-arrow-color': '#9dbaea',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'label': 'data(label)', // Display edge label
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
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);

  // 2. Load or form data for the graph
  useEffect(() => {
    // Simulate data loading
    const initialUsers = [
      { id: 'user1', name: 'Alice', image: 'https://example.com/alice.png' },
      { id: 'user2', name: 'Bob', image: 'https://example.com/bob.png' },
    ];
    const initialAccounts = [
      { id: 'acc1', provider: 'GitHub', userId: 'user1' },
      { id: 'acc2', provider: 'Google', userId: 'user1' },
      { id: 'acc3', provider: 'GitLab', userId: 'user2' },
    ];

    const graphNodes = [
      ...initialUsers.map(user => ({
        // 'element' for CytoNode is the standard Cytoscape element format
        id: user.id,
        data: { ...user, type: 'user' }, // Add 'type' for styling or logic
        classes: ['user-node'], // Add class for Cytoscape styles
        // position: { x: Math.random() * 200, y: Math.random() * 200 } // Initial positions can be set
      })),
      ...initialAccounts.map(account => ({
        id: account.id,
        data: { ...account, type: 'account' },
        classes: ['account-node'],
      })),
    ];

    const graphEdges = initialAccounts.map(account => ({
      // 'element' for CytoEdge also expects standard Cytoscape edge format
      id: `edge-${account.id}`,
      data: { 
        id: `edge-${account.id}`, 
        source: account.userId, 
        target: account.id,
        label: 'owns' // Label for the edge
      },
      // classes: ['special-edge'] // A class can be added to the edge
    }));

    setNodes(graphNodes);
    setEdges(graphEdges);
  }, []);

  const handleNodeClick = (event: any) => {
    const node = event.target;
    console.log('Node clicked:', node.id(), node.data());
    // For example, open node details in a sidebar
  };
  
  const handleEdgeClick = (event: any) => {
    const edge = event.target;
    console.log('Edge clicked:', edge.id(), edge.data());
  };

  const handleGraphLoaded = (cyInstance: any) => {
    console.log('Graph is fully loaded!', cyInstance);
    // Any operations with 'cyInstance' can be performed directly here
    // For example, set up Cytoscape event handlers
    cyInstance.on('tap', 'node', (evt: any) => {
      // This handler will duplicate onClick on CytoNode, but shown for example
      // console.log('Cytoscape tap on node:', evt.target.id());
    });
  };

  return (
    <div style={{ width: '100%', height: '600px', border: '1px solid #ccc' }}>
      <Cyto
        onLoaded={handleGraphLoaded}
        layout={{ 
          name: 'cola', // Try also 'dagre' or 'breadthfirst'
          nodeDimensionsIncludeLabels: true, // Consider labels for layout size calculations
          fit: true, // Fit graph to container after loading
          padding: 30,
          animate: true,
        }}
        buttons={true} // Enable standard buttons
        buttonsChildren={<CustomGraphButtons />} // Add custom buttons
      >
        {/* 3. Apply styles using CytoStyle */}
        <CytoStyle stylesheet={myStylesheet} />

        {/* 4. Render nodes */}
        {nodes.map((nodeProps) => (
          <CytoNode
            key={nodeProps.id}
            element={nodeProps} // 'element' contains id, data, classes, position
            onClick={handleNodeClick}
          >
            {/* 
              This is custom HTML markup for the node.
              The size of this div will determine the Cytoscape node's size.
              Its content will be displayed on top of the Cytoscape node.
            */}
            {nodeProps.data.type === 'user' ? (
              <div style={{
                padding: '10px',
                background: '#a9def9',
                borderRadius: '8px',
                border: '1px solid #6c99b8',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '2px 2px 5px rgba(0,0,0,0.1)',
                minWidth: '150px' // Minimum width for example
              }}>
                <Avatar>
                  <AvatarImage src={nodeProps.data.image} alt={nodeProps.data.name} />
                  <AvatarFallback>{nodeProps.data.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span>{nodeProps.data.name}</span>
              </div>
            ) : (
              <div style={{
                padding: '8px',
                background: '#e3f2fd',
                borderRadius: '4px',
                border: '1px solid #90caf9',
                textAlign: 'center',
                boxShadow: '1px 1px 3px rgba(0,0,0,0.05)',
                minWidth: '120px' // Minimum width for example
              }}>
                <strong>{nodeProps.data.provider}</strong>
                <br />
                <small>Account ID: {nodeProps.data.id}</small>
              </div>
            )}
          </CytoNode>
        ))}

        {/* 5. Render edges */}
        {edges.map((edgeProps) => (
          <CytoEdge
            key={edgeProps.id}
            element={edgeProps} // 'element' contains id, data (source, target, label), classes
            onClick={handleEdgeClick}
          />
        ))}
      </Cyto>
    </div>
  );
}
```

## Key Aspects and Benefits

*   **Declarativeness:** Graph description (nodes, edges, styles) is done in a familiar React style.
*   **Custom HTML in Nodes:** The ability to use any HTML markup and React components for node display offers immense design flexibility. Cytoscape node sizes automatically synchronize with your HTML content dimensions.
*   **Reactivity:** Changes in data (props `element` in `CytoNode` or `CytoEdge`, or `stylesheet` in `CytoStyle`) are reactively reflected in the graph.
*   **UI Framework Integration:** Easily integrates with existing components of your UI framework (e.g., `Avatar`, `Button` from your `components/ui`).
*   **Ease of Creation:** Significantly simplifies the creation of complex graph visualizations by abstracting many details of direct Cytoscape API interaction, while still providing access to it via `onLoaded` or `useGraph` if needed.
*   **Standard Cytoscape Elements:** The `element` props for `CytoNode` and `CytoEdge` expect data in the standard Cytoscape element format, making transition or integration with existing Cytoscape logic simpler.
*   **Reactive Styles:** The `<CytoStyle />` component allows adding or changing graph styles anywhere in the component tree, and these changes will be reactively applied to the graph.

This module provides a powerful tool for developers needing to visualize complex relationships and data structures in their React applications.
