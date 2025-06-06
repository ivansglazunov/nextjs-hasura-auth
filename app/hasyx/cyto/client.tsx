"use client"

import Debug from '@/lib/debug';
import { useSubscription } from "hasyx/lib/hasyx-client";
import { Button as EntityButton, Card as EntityCard } from 'hasyx/lib/entities';
import { HasyxConstructor, HasyxConstructorButton } from "hasyx/lib/constructor";
import { Cyto, CytoEdge, CytoNode, CytoStyle } from "hasyx/lib/cyto";
import React, { useState, useCallback, useMemo } from "react";
import hasyxSchema from '../hasura-schema.json';
import { Button } from 'hasyx/components/ui/button';
import { Plus, X } from 'lucide-react';
import {
  getObjectRelationsByTypename,
  getArrayRelationsByTypename,
  getIdFieldsByTypename,
} from 'hasyx/lib/constructor';

const debug = Debug('cyto');

// Стили для Cytoscape
const stylesheet = [
  {
    selector: 'node',
    style: {
      'background-color': '#000000',
      'background-opacity': 0,
      'shape': 'rectangle',
      'width': 150,
      'height': 50
    }
  },
  {
    selector: 'edge',
    style: {
      'width': 2,
      'line-color': '#d3d3d3',
      'target-arrow-color': '#d3d3d3',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier'
    }
  }
];

const RowParser = (schema) => (rowObjectWithTypename) => {
  const typename = rowObjectWithTypename?.__typename;
  if (!typename) {
    return { objectRelations: {}, arrayRelations: {}, idFields: [] };
  }

  const objectRelations = getObjectRelationsByTypename(schema, typename);
  const arrayRelations = getArrayRelationsByTypename(schema, typename);
  const idFields = getIdFieldsByTypename(schema, typename);

  return { objectRelations, arrayRelations, idFields };
}

const parseRow = RowParser(hasyxSchema);

const CytoEntityEdge = ({ source, target }) => (
  <CytoEdge element={{
    id: `edge-${source.__typename}-${source.id}-${target.__typename}-${target.id}`,
    data: {
      id: `edge-${source.__typename}-${source.id}-${target.__typename}-${target.id}`,
      source: `${source.__typename}-${source.id}`,
      target: `${target.__typename}-${target.id}`,
    },
  }} />
);

const EntitityByConstructor = ({ object, handleEntityClick }) => {
  if (!object || !object.id || !object.__typename) return null;

  const nodeId = `${object.__typename}-${object.id}`;

  const { objectRelations, arrayRelations } = useMemo(() => parseRow(object), [object]);

  const childrenAndEdges = useMemo(() => {
    const children = new Map();
    const edges = new Map();

    // Object relations
    for (const fieldName in objectRelations) {
      const relatedObject = object[fieldName];
      if (relatedObject && relatedObject.id) {
        const targetTypename = relatedObject.__typename || objectRelations[fieldName];
        const relatedWithTypename = { ...relatedObject, __typename: targetTypename };
        const relatedNodeId = `${relatedWithTypename.__typename}-${relatedWithTypename.id}`;

        if (!children.has(relatedNodeId)) {
          children.set(relatedNodeId, <EntitityByConstructor key={relatedNodeId} object={relatedWithTypename} handleEntityClick={handleEntityClick} />);
        }

        const edgeId = `edge-${nodeId}-${relatedNodeId}`;
        if (!edges.has(edgeId)) {
          edges.set(edgeId, <CytoEntityEdge key={edgeId} source={object} target={relatedWithTypename} />);
        }
      }
    }

    // Array relations
    for (const fieldName in arrayRelations) {
      const relatedArray = object[fieldName];
      if (Array.isArray(relatedArray)) {
        relatedArray.forEach(relatedObject => {
          if (relatedObject && relatedObject.id) {
            const targetTypename = relatedObject.__typename || arrayRelations[fieldName];
            const relatedWithTypename = { ...relatedObject, __typename: targetTypename };
            const relatedNodeId = `${relatedWithTypename.__typename}-${relatedWithTypename.id}`;

            if (!children.has(relatedNodeId)) {
              children.set(relatedNodeId, <EntitityByConstructor key={relatedNodeId} object={relatedWithTypename} handleEntityClick={handleEntityClick} />);
            }

            const edgeId = `edge-${nodeId}-${relatedNodeId}`;
            if (!edges.has(edgeId)) {
              edges.set(edgeId, <CytoEntityEdge key={edgeId} source={object} target={relatedWithTypename} />);
            }
          }
        });
      }
    }

    return { children: Array.from(children.values()), edges: Array.from(edges.values()) };
  }, [object, objectRelations, arrayRelations, handleEntityClick, nodeId]);

  return (
    <>
      <CytoNode
        element={{
          id: nodeId,
          data: {
            id: nodeId,
            label: object.name || object.title || object.provider || object.id
          },
        }}
      >
        <EntityButton
          data={object}
          className="w-auto max-w-[140px]"
          onClick={() => handleEntityClick(object)}
        />
      </CytoNode>
      {childrenAndEdges.edges}
      {childrenAndEdges.children}
    </>
  );
};

const QueryManager = ({ queries, setQueries }) => {
  const addQuery = () => {
    const newQuery = {
      table: 'users',
      where: {},
      returning: ['id', 'name'],
      limit: 10,
    };
    setQueries(prev => [...prev, newQuery]);
  };

  const removeQuery = (index) => {
    setQueries(prev => prev.filter((_, i) => i !== index));
  };

  const updateQuery = (index, updatedQuery) => {
    setQueries(prev => prev.map((q, i) => (i === index ? updatedQuery : q)));
  };

  return (<>
    {queries.map((query, index) => (
      <div key={index} className="flex items-center">
        <HasyxConstructorButton
          value={query}
          onChange={(newQuery) => updateQuery(index, newQuery)}
          defaultTable="users"
          schema={hasyxSchema}
        >
          <span className="max-w-[100px] truncate">{query.table}</span>
        </HasyxConstructorButton>
        <Button variant="outline" size="icon" className="square ml-1" onClick={() => removeQuery(index)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    ))}
    <Button variant="outline" size="sm" className="square" onClick={addQuery}>
      <Plus/>
    </Button>
  </>)
}

const QueryLoader = ({ query, renderer }) => {
  const { data: results = [] } = useSubscription(query);
  const graphElements = useMemo(() => {
    if (!results) return [];
    return results.map(renderer);
  }, [results, renderer]);
  return <>{graphElements}</>;
};

export default function Client() {
  const [queries, setQueries] = useState<any[]>([
    {
      table: 'users',
      where: {},
      returning: ['id', 'name', { 'accounts': { 'returning': ['id', 'provider'] } }],
      limit: 10,
    }
  ]);

  const [selectedEntity, setSelectedEntity] = useState<any>(null);

  const onGraphLoaded = useCallback((cy) => {
    if (global) (global as any).cy = cy;
    cy.zoom(1);
    cy.center();
  }, []);

  const onInsert = useCallback((inserted, insertQuery) => {
    debug("Cyto client: onInsert called", { inserted, insertQuery });
  }, []);

  const layoutConfig = useMemo(() => ({
    name: 'cola',
    nodeDimensionsIncludeLabels: true,
    fit: false
  }), []);

  const handleEntityClick = useCallback((entityData: any) => {
    setSelectedEntity(entityData);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedEntity(null);
  }, []);

  const renderer = useCallback((item) => (
    <EntitityByConstructor
      key={`${item.__typename}-${item.id}`}
      object={item}
      handleEntityClick={handleEntityClick}
    />
  ), [handleEntityClick]);

  return (
    <div className="w-full h-full relative">
      <Cyto
        onLoaded={onGraphLoaded}
        onInsert={onInsert}
        buttons={true}
        layout={layoutConfig}
        leftTop={
          <div className="w-96">
            <QueryManager queries={queries} setQueries={setQueries} />
          </div>
        }
      >
        <CytoStyle stylesheet={stylesheet} />
        {queries.map((query, index) => (
          <QueryLoader key={index} query={query} renderer={renderer} />
        ))}
      </Cyto>

      {/* Modal for entity details */}
      {selectedEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleCloseModal}>
          <div className='w-1/3' onClick={e => e.stopPropagation()}>
            <EntityCard
              data={selectedEntity}
              onClose={handleCloseModal}
            />
          </div>
        </div>
      )}
    </div>
  );
}
