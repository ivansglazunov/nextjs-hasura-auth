"use client"

import { useEffect, useState, useRef } from "react";
import { Card, CardHeader, CardTitle } from "hasyx/components/ui/card";
import { Cyto, CytoNode, CytoEdge, CytoStyle } from "@/lib/cyto";
import { useSubscription } from "hasyx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Стили для Cytoscape
const stylesheet = [
  {
    selector: 'node',
    style: {
      'background-color': 'transparent',
      'border-color': '#d3d3d3',
      'border-width': 1,
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
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  
  const { data: users = [] } = useSubscription({
    table: 'users',
    returning: ['id', 'image', 'name', 'created_at', 'updated_at'],
  });

  const { data: accounts = [] } = useSubscription({
    table: 'accounts',
    returning: ['id', 'user_id', 'provider'],
  });

  useEffect(() => {
    if (!users?.length) return;
    
    const nodes: any[] = [];
    const edges: any[] = [];

    for (const user of users) {
      nodes.push({
        id: `user-${user.id}`,
        data: {
          id: `user-${user.id}`,
          label: user.name,
          image: user.image,
          type: 'user',
        },
        position: { x: 0, y: 0 }
      });
    }

    for (const account of accounts) {
      nodes.push({
        id: `account-${account.id}`,
        data: {
          id: `account-${account.id}`,
          label: account.provider,
          image: account.provider_account_id,
          type: 'account',
        },
        position: { x: 0, y: 0 }
      });
      edges.push({
        id: `account-edge-${account.id}`,
        data: {
          id: `account-edge-${account.id}`,
          source: `user-${account.user_id}`,
          target: `account-${account.id}`,
        },
      });
    }

    setNodes(nodes);
    setEdges(edges);
  }, [users, accounts]);

  const onGraphLoaded = (cy) => {
    global.cy = cy;
    cy.zoom(1);
    cy.center();
  };

  const onInsert = (inserted, insertQuery) => {
    console.log("inserted", inserted, insertQuery);
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

        {nodes.map((node) => (
          node?.data?.type == 'user' ? <CytoNode 
            key={node.id}
            element={node}
          >
            <div className="bg-blue color-white opacity-50 w-[50px] h-[50px]">
              <Avatar className="w-full h-full">
                <AvatarImage src={node?.data?.image} />
                <AvatarFallback>{node?.data?.label?.split(' ').map(name => name[0]).join('')}</AvatarFallback>
              </Avatar>
            </div>
          </CytoNode> :
          node?.data?.type == 'account' ? <CytoNode 
            key={node.id} 
            element={node}
          >
            <div className="bg-red color-white opacity-50 w-[50px] h-[20px]">
              {node?.data?.label}
            </div>
          </CytoNode> : <div key={node.id}>{node?.data?.label || node?.data?.id}</div>
        ))}
        {edges.map((edge) => (
          <CytoEdge key={edge.id} element={edge} />
        ))}
      </Cyto>
    </div>
  );
}
