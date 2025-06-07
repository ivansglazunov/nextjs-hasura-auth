# Hasyx Data Renderer for Graph Visualizations

`hasyx/lib/renderer.tsx` Documentation

## Overview

The `hasyx/lib/renderer.tsx` module provides a powerful and automated way to render data from Hasyx GraphQL queries directly into a graph visualization using the `hasyx/lib/cyto` components. It's designed to recursively traverse your data's relationships (both object and array relations) and automatically generate a network of nodes and edges, dramatically simplifying the process of visualizing complex, interconnected data.

This renderer acts as a bridge between the `HasyxConstructorButton` (for building queries) and the `Cyto` component (for displaying graphs).

## Core Components

### 1. `<QueriesManager />`

A UI component that allows users to dynamically build and manage a list of Hasyx queries.

**Key Props:**

*   `queries`: The current array of query objects.
*   `setQueries`: A state setter function (`(queries) => void`) to update the array of queries.
*   `schema`: The Hasura schema JSON, used by the underlying `HasyxConstructorButton` to provide table and column options.

### 2. `<QueriesRenderer />`

The main component that takes a set of queries and renders the results. It subscribes to each query and passes the resulting data items to a renderer function.

**Key Props:**

*   `queries`: An array of Hasyx query objects to execute.
*   `schema`: The Hasura schema JSON, passed down to child renderers.
*   `renderer?: (object: any) => React.ReactNode`: An optional custom render function for each data object returned by the queries. If not provided, it defaults to using `CytoNodeRenderer`.
*   `onClick?: (object: any) => void`: A callback function passed down to nodes, typically for handling click events.
*   `EntityButtonComponent?`: An optional component to render the node's content. Defaults to `hasyx/lib/entities/Button`.

### 3. `<CytoNodeRenderer />`

This is the recursive workhorse of the library. For a given data object, it performs the following steps:

1.  Renders a `<EntityCytoNode>` for the object itself.
2.  Uses `RowParser` to inspect the object's `__typename` and discover its relationships from the schema.
3.  For each related object (from both one-to-one and one-to-many relations), it:
    *   Recursively renders a `<CytoNodeRenderer>` for that related object.
    *   Renders a `<CytoEdgeRenderer>` to create a visual link from the parent to the child object.

This process continues, automatically building out the entire graph of connected data.

**Key Props:**

*   `object`: The data object to render (must include `id` and `__typename`).
*   `schema`: The Hasura schema.
*   `onClick?`: Click handler.
*   `EntityButtonComponent?`: The component for rendering the node.

### 4. `<CytoEdgeRenderer />`

A simple wrapper component that creates a `<CytoEdge>` between two data objects.

**Key Props:**

*   `source`: The source data object.
*   `target`: The target data object.

### 5. `RowParser()`

A utility higher-order function that takes the schema and returns a parsing function. This parser, when given a data object, returns its object relations, array relations, and ID fields based on the schema.

## Comprehensive Usage Example

This example demonstrates how to combine `QueriesManager` and `QueriesRenderer` to create a dynamic, user-configurable graph that visualizes users and their related links.

```tsx
"use client";

import React, { useState } from 'react';
import { Cyto, CytoStyle } from 'hasyx/lib/cyto';
import { QueriesManager, QueriesRenderer } from 'hasyx/lib/renderer';
import hasyxSchema from 'hasyx/public/hasura-schema.json';

// Define some base styles for our graph nodes and edges
const myStylesheet = [
  {
    selector: 'node',
    style: {
      'background-color': 'transparent',
      'background-opacity': 0,
    }
  },
  {
    selector: 'edge',
    style: {
      'width': 1.5,
      'line-color': 'var(--muted-foreground)',
      'target-arrow-color': 'var(--muted-foreground)',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
    }
  }
];

export default function MyDataGraphPage() {
  // State to hold the queries defined by the user
  const [queries, setQueries] = useState([
    {
      table: 'users',
      where: {},
      returning: [
        'id',
        'name',
        'email',
        {
          links: { // Assuming a 'links' array relationship on 'users'
            returning: ['id', 'url', 'title'],
            limit: 5,
          }
        }
      ],
      limit: 3,
    }
  ]);
  
  const handleNodeClick = (object: any) => {
    console.log('Node clicked:', object);
    // You could open a details panel here, for example
  };

  return (
    <div className="w-full h-screen flex flex-col">
      <header className="p-2 border-b flex items-center gap-2">
        <h2 className="font-semibold">Graph Queries:</h2>
        {/* The QueriesManager allows the user to change what's shown on the graph */}
        <QueriesManager queries={queries} setQueries={setQueries} schema={hasyxSchema} />
      </header>
      <main className="flex-grow">
        <Cyto
          layout={{ name: 'cola', fit: false, nodeDimensionsIncludeLabels: true }}
          buttons={true}
        >
          {/* Apply styles */}
          <CytoStyle stylesheet={myStylesheet} />

          {/* 
            The magic happens here! 
            QueriesRenderer takes the queries, fetches the data, and recursively 
            renders the entire graph of users and their associated links.
          */}
          <QueriesRenderer
            queries={queries}
            schema={hasyxSchema}
            onClick={handleNodeClick}
          />
        </Cyto>
      </main>
    </div>
  );
}
```

## Summary

The `hasyx/lib/renderer` module provides a declarative and highly automated pipeline for visualizing data. By simply defining your queries, you can render rich, interactive, and interconnected graph diagrams with minimal boilerplate code, letting the renderer handle the complexities of data traversal and component generation. 