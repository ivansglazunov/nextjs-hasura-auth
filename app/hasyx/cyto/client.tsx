"use client"

import Debug from '@/lib/debug';
import { useSubscription } from "hasyx";
import { Button as EntityButton, Card as EntityCard } from 'hasyx/lib/entities';
import { HasyxConstructorButton } from "hasyx/lib/constructor";

import { Cyto, CytoEdge, CytoNode, CytoStyle } from "hasyx/lib/cyto";
import React, { useState, useCallback, useMemo } from "react";

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

export default function Client() {
  const { data: users = [] } = useSubscription({
    table: 'users',
    returning: ['id', 'image', 'name', 'created_at', 'updated_at', { accounts: { returning: ['id', 'provider', '__typename'] } }],
  });

  const [selectedEntity, setSelectedEntity] = useState<any>(null);

  const onGraphLoaded = useCallback((cy) => {
    global.cy = cy;
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

  const [queryState, setQueryState] = useState<any>({
    table: 'users',
    where: {},
    returning: [],
    limit: undefined,
    offset: undefined,
    order_by: undefined
  });

  const handleEntityClick = useCallback((entityData: any) => {
    setSelectedEntity(entityData);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedEntity(null);
  }, []);

  return (
    <div className="w-full h-full relative">
      <Cyto 
        onLoaded={onGraphLoaded}
        onInsert={onInsert}
        buttons={true}
        buttonsChildren={
          <HasyxConstructorButton
            value={queryState}
            onChange={setQueryState}
            defaultTable="users"
          />
        }
        layout={layoutConfig}
      >
        <CytoStyle stylesheet={stylesheet} />

        {(users || []).map((user) => (<React.Fragment key={user.id}>
          <CytoNode 
            key={user.id}
            element={{
              id: `user-${user.id}`,
              data: {
                id: `user-${user.id}`,
                label: user.name,
                image: user.image,
              },
            }}
          >
            <EntityButton 
              data={{ ...user, __typename: 'users' }}
              className="w-auto max-w-[140px]"
              onClick={() => handleEntityClick({ ...user, __typename: 'users' })}
            />
          </CytoNode>
          {(user.accounts || []).map((account) => (<React.Fragment key={account.id}>
            <CytoNode element={{
              id: `account-${account.id}`,
              data: {
                id: `account-${account.id}`,
                label: account.provider,
              },
            }}>
              <EntityButton 
                data={{ ...account, __typename: 'accounts' }}
                className="w-auto max-w-[120px]"
                onClick={() => handleEntityClick({ ...account, __typename: 'accounts' })}
              />
            </CytoNode>
            <CytoEdge element={{
              id: `account-edge-${account.id}`,
              data: {
                id: `account-edge-${account.id}`,
                source: `user-${user.id}`,
                target: `account-${account.id}`,
              },
            }} />
          </React.Fragment>))}
        </React.Fragment>))}
      </Cyto>

      {/* Modal for entity details */}
      {selectedEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <EntityCard 
            data={selectedEntity}
            onClose={handleCloseModal}
          />
        </div>
      )}
    </div>
  );
}
