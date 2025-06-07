"use client"

import Debug from '@/lib/debug';
import { Cyto, CytoStyle } from "hasyx/lib/cyto";
import { Card as EntityCard, Button as EntityButton } from '../../../lib/entities';
import { QueriesManager, QueriesRenderer } from 'hasyx/lib/renderer';
import { useCallback, useMemo, useState } from "react";
import projectSchema from '../hasura-schema.json';

const debug = Debug('cyto');

// Стили для Cytoscape
const stylesheet = [
  {
    selector: 'node',
    style: {
      'background-color': 'var(--foreground)',
      'background-opacity': 0,
      'shape': 'circle',
      'width': 10,
      'height': 10,
      'border-radius': 10,
      'color': 'var(--foreground)',
    }
  },
  {
    selector: 'node.entity',
    style: {
      'background-opacity': 1,
      'shape': 'circle',
      'label': 'data(label)',
      'text-valign': 'center',
      'text-halign': 'right',
      'text-margin-x': 10,
    }
  },
  {
    selector: 'node.entity.avatar',
    style: {
      'background-image': 'data(image)',
      'background-fit': 'cover cover',
      'background-opacity': 1,
      'width': 50,
      'height': 50,
      'shape': 'circle',
      'label': 'data(label)',
    }
  },
  {
    selector: 'node.entity.opened',
    style: {
      'background-opacity': 0,
      'shape': 'rectangle',
    }
  },
  {
    selector: 'edge',
    style: {
      'width': 2,
      'line-color': 'var(--foreground)',
      'target-arrow-color': 'var(--foreground)',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier'
    }
  }
];

export default function Client() {
  const [queries, setQueries] = useState<any[]>([
    {
      table: 'users',
      where: {},
      returning: ['id', 'name', 'image', { 'accounts': { 'returning': ['id', 'provider'] } }],
      limit: 10,
    }
  ]);

  const [selectedEntity, setSelectedEntity] = useState<any>(null);

  const onGraphLoaded = useCallback((cy) => {
    if (global) (global as any).cy = cy;
    cy.zoom(1);
    cy.center();
  }, []);

  const layoutConfig = useMemo(() => ({
    name: 'cola',
    nodeDimensionsIncludeLabels: true,
    fit: false
  }), []);

  const closeModal = useCallback(() => setSelectedEntity(null), []);

  return (
    <div className="w-full h-full relative">
      <Cyto
        onLoaded={onGraphLoaded}
        buttons={true}
        layout={layoutConfig}
        leftTop={<QueriesManager queries={queries} setQueries={setQueries} schema={projectSchema} />}
      >
        <CytoStyle stylesheet={stylesheet} />
        <QueriesRenderer
          queries={queries}
          schema={projectSchema}
          onClick={setSelectedEntity}
          EntityButtonComponent={EntityButton}
        />
      </Cyto>

      {/* Modal for entity details */}
      {selectedEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeModal}>
          <div className='w-1/3' onClick={e => e.stopPropagation()}>
            <EntityCard
              data={selectedEntity}
              onClose={closeModal}
            />
          </div>
        </div>
      )}
    </div>
  );
}
