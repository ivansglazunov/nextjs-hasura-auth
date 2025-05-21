"use client"

import Debug from '@/lib/debug';
import { useSubscription } from "hasyx";
import { Avatar, AvatarFallback, AvatarImage } from "hasyx/components/ui/avatar";
import { Badge } from "hasyx/components/ui/badge";

import { Cyto, CytoEdge, CytoNode, CytoStyle } from "hasyx/lib/cyto";
import React, { useCallback, useMemo } from "react";

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
      'height': 80
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
    returning: ['id', 'image', 'name', 'created_at', 'updated_at', { accounts: { returning: ['id', 'provider'] } }],
  });

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

  return (
    <div className="w-full h-full relative">
      <Cyto 
        onLoaded={onGraphLoaded}
        onInsert={onInsert}
        buttons={true}
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
            <div className="w-[50px] h-[50px]">
              <Avatar className="w-full h-full">
                <AvatarImage src={user?.image} />
                <AvatarFallback>{user?.name?.split(' ').map(name => name[0]).join('')}</AvatarFallback>
              </Avatar>
            </div>
          </CytoNode>
          {(user.accounts || []).map((account) => (<React.Fragment key={account.id}>
            <CytoNode element={{
              id: `account-${account.id}`,
              data: {
                id: `account-${account.id}`,
                label: account.provider,
              },
            }}>
              <div className="w-[50px] h-[20px]">
                <Badge variant="outline">{account?.provider}</Badge>
              </div>
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
    </div>
  );
}
