"use client"

import { Button } from 'hasyx/components/ui/button';
import {
  getArrayRelationsByTypename,
  getIdFieldsByTypename, getObjectRelationsByTypename, HasyxConstructorButton
} from "hasyx/lib/constructor";
import { CytoEdge } from "hasyx/lib/cyto";
import { Button as EntityButton, CytoNode as EntityCytoNode } from 'hasyx/lib/entities';
import { useSubscription } from "hasyx/lib/hasyx-client";
import hasyxSchema from 'hasyx/public/hasura-schema.json';
import { Plus, X } from 'lucide-react';
import React, { useCallback, useMemo } from "react";
import Debug from './debug';

const debug = Debug('renderer');

export const QueriesManager = ({ queries, setQueries, schema = hasyxSchema }) => {
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
          schema={schema}
        >
          <span className="max-w-[100px] truncate">{query.table}</span>
        </HasyxConstructorButton>
        <Button variant="outline" size="icon" className="square ml-1" onClick={() => removeQuery(index)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    ))}
    <Button variant="outline" size="sm" className="square" onClick={addQuery}>
      <Plus />
    </Button>
  </>)
}

export const QueryRenderer = ({ query, renderer }) => {
  const { data: results = [] } = useSubscription(query);
  const rendered = useMemo(() => results.map(renderer), [results, renderer]);
  return <>{rendered}</>;
};

export const QueriesRenderer = ({
  queries,
  schema,
  renderer,
  onClick,
  EntityButtonComponent = EntityButton,
}: {
  queries: any[],
  schema: any,
  renderer?: (object: any) => React.ReactNode,
  onClick?: (object: any) => void,
  EntityButtonComponent?: any,
}) => {
  const _renderer = useCallback((item) => (<CytoNodeRenderer
    key={`${item.__typename}-${item.id}`}
    object={item}
    onClick={onClick}
    schema={schema}
    EntityButtonComponent={EntityButtonComponent}
  />), [renderer]);
  const __renderer = renderer || _renderer;
  const rendered = useMemo(() => {
    return queries.map((query, index) => <QueryRenderer key={index} query={query} renderer={__renderer} />);
  }, [queries, renderer]);
  return <>{rendered}</>;
};

export const RowParser = (schema) => (rowObjectWithTypename) => {
  const typename = rowObjectWithTypename?.__typename;
  if (!typename) {
    return { objectRelations: {}, arrayRelations: {}, idFields: [] };
  }

  const objectRelations = getObjectRelationsByTypename(schema, typename);
  const arrayRelations = getArrayRelationsByTypename(schema, typename);
  const idFields = getIdFieldsByTypename(schema, typename);

  return { objectRelations, arrayRelations, idFields };
}

export const CytoEdgeRenderer = ({ source, target }) => (
  <CytoEdge element={{
    id: `edge-${source.__typename}-${source.id}-${target.__typename}-${target.id}`,
    data: {
      id: `edge-${source.__typename}-${source.id}-${target.__typename}-${target.id}`,
      source: `${source.id}`,
      target: `${target.id}`,
    },
  }} />
);

export const CytoNodeRenderer = ({
  object,
  onClick,
  schema,
  parseRow,
  EntityButtonComponent = EntityButton,
}: {
  object: any,
  onClick?: (object: any) => void,
  schema: any,
  parseRow?: (object: any) => { objectRelations: any, arrayRelations: any, idFields: any },
  EntityButtonComponent?: any,
}) => {
  const _parseRow = useMemo(() => parseRow || RowParser(schema), [schema]);

  if (!object || !object.id || !object.__typename) return null;

  const nodeId = `${object.__typename}-${object.id}`;

  const { objectRelations, arrayRelations } = useMemo(() => _parseRow(object), [object]);

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
          children.set(relatedNodeId, <CytoNodeRenderer key={relatedNodeId} object={relatedWithTypename} onClick={onClick} schema={schema} parseRow={_parseRow} EntityButtonComponent={EntityButtonComponent} />);
        }

        const edgeId = `edge-${nodeId}-${relatedNodeId}`;
        if (!edges.has(edgeId)) {
          edges.set(edgeId, <CytoEdgeRenderer key={edgeId} source={object} target={relatedWithTypename} />);
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
              children.set(relatedNodeId, <CytoNodeRenderer key={relatedNodeId} object={relatedWithTypename} onClick={onClick} schema={schema} parseRow={_parseRow} EntityButtonComponent={EntityButtonComponent} />);
            }

            const edgeId = `edge-${nodeId}-${relatedNodeId}`;
            if (!edges.has(edgeId)) {
              edges.set(edgeId, <CytoEdgeRenderer key={edgeId} source={object} target={relatedWithTypename} />);
            }
          }
        });
      }
    }

    return { children: Array.from(children.values()), edges: Array.from(edges.values()) };
  }, [object, objectRelations, arrayRelations, onClick, nodeId]);

  // const [opened, setOpened] = useState(false);

  return (
    <>
      <EntityCytoNode
        data={object}
        // onClick={() => setOpened(true)}
        // children={opened ? <EntityButtonComponent
        //   data={object}
        //   className="w-auto max-w-[140px]"
        //   onClick={() => onClick && onClick(object)}
        // /> : null}
        // classes={cn(opened ? 'opened' : '')}
      />
      {childrenAndEdges.edges}
      {childrenAndEdges.children}
    </>
  );
};
