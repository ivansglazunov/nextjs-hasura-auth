"use client"

import React, { useEffect, useState, useRef } from "react";
import { Card, CardHeader, CardTitle } from "hasyx/components/ui/card";
import { Cyto, CytoNode, CytoEdge, CytoStyle } from "hasyx/lib/cyto";
import { useSubscription } from "hasyx";
import { Avatar, AvatarFallback, AvatarImage } from "hasyx/components/ui/avatar";
import Debug from '@/lib/debug';
import { Badge } from "hasyx/components/ui/badge";

const logClient = Debug('cyto:client');

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

  const onGraphLoaded = (cy) => {
    global.cy = cy;
    cy.zoom(1);
    cy.center();
  };

  const onInsert = (inserted, insertQuery) => {
    logClient("Cyto client: onInsert called", { inserted, insertQuery });
  };
  
  return (
    <div className="w-full h-full relative">
      <Cyto 
        onLoaded={onGraphLoaded}
        onInsert={onInsert}
        buttons={true}
        layout={{
          name: 'cola',
          nodeDimensionsIncludeLabels: true,
          fit: false
        }}
      >
        <CytoStyle stylesheet={stylesheet} />

        {users.map((user) => (<React.Fragment key={user.id}>
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
          {user.accounts.map((account) => (
              <CytoNode
                key={account.id} 
                element={{
                  id: `account-${account.id}`,
                  data: {
                    id: `account-${account.id}`,
                    label: account.provider,
                  },
                }}
              >
                <div className="w-[50px] h-[20px]">
                  <Badge variant="outline">{account?.provider}</Badge>
                </div>
              </CytoNode>
            ))}
            {user.accounts.map((account) => (
              <CytoEdge key={account.id} element={{
                id: `account-edge-${account.id}`,
                data: {
                  id: `account-edge-${account.id}`,
                  source: `user-${user.id}`,
                  target: `account-${account.id}`,
                },
              }} />
            ))}
        </React.Fragment>))}
      </Cyto>
    </div>
  );
}
