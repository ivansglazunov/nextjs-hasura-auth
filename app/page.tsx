'use client';

import { SidebarLayout } from "hasyx/components/sidebar/layout";
import sidebar from "@/app/sidebar";
import pckg from "@/package.json";
import { Cyto, CytoNode, CytoEdge, CytoStyle } from "hasyx/lib/cyto";

// Cytoscape styles for the graph
const graphStyles = [
  {
    selector: 'node',
    style: {
      'background-color': '#000',
      'background-opacity': 0,
      'shape': 'rectangle',
      'border-width': 0,
    }
  },
  {
    selector: 'edge',
    style: {
      'width': 2,
      'line-color': '#333',
      'target-arrow-color': '#333',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'opacity': 0.7,
    }
  },
  {
    selector: '.main-edge',
    style: {
      'width': 3,
      'line-color': '#555',
      'target-arrow-color': '#555',
      'opacity': 0.9,
    }
  }
];

// Feature node component
function FeatureNode({ 
  title, 
  size = "text-lg",
  color = "text-white",
  bgColor = "bg-gray-800",
  borderColor = "border-gray-600"
}: {
  title: string;
  size?: string;
  color?: string;
  bgColor?: string;
  borderColor?: string;
}) {
  return (
    <div className={`
      ${bgColor} ${borderColor} ${color} ${size}
      px-4 py-2 rounded-lg border 
      font-medium text-center
      hover:bg-gray-700 transition-colors
      shadow-lg
    `}>
      {title}
    </div>
  );
}

export default function Page() {
  const handleGraphLoaded = (cy: any) => {
    // Center and fit the graph
    cy.fit();
    cy.center();
    
    // Add some interactive behaviors
    cy.on('tap', 'node', (evt: any) => {
      const node = evt.target;
      console.log('Clicked node:', node.data('id'));
    });
  };

  return (
    <SidebarLayout sidebarData={sidebar} breadcrumb={[{ title: pckg.name, link: '/' }]}>
      <div className="w-full h-screen bg-black overflow-hidden">
        <Cyto
          onLoaded={handleGraphLoaded}
          layout={{
            name: 'cose',
            idealEdgeLength: 150,
            nodeOverlap: 20,
            refresh: 20,
            fit: true,
            padding: 50,
            randomize: false,
            componentSpacing: 100,
            nodeRepulsion: 8000,
            edgeElasticity: 100,
            animate: true,
            animationDuration: 1000,
          }}
          buttons={false}
        >
          <CytoStyle stylesheet={graphStyles} />

          {/* Central HASYX Node */}
          <CytoNode
            element={{
              id: 'hasyx-center',
              data: { id: 'hasyx-center', label: 'HASYX' },
              position: { x: 400, y: 300 }
            }}
          >
            <div className="flex flex-col items-center justify-center bg-black border-2 border-white rounded-xl p-6 shadow-2xl">
              <img 
                src="/logo.svg" 
                alt="Hasyx Logo" 
                className="w-16 h-16 mb-3"
              />
              <h1 className="text-3xl font-bold text-white">HASYX</h1>
              <p className="text-sm text-gray-300 mt-1">Next.js + Hasura + Everything</p>
            </div>
          </CytoNode>

          {/* Main impressive features - directly connected to center */}
          
          {/* AI Code Execution */}
          <CytoNode
            element={{
              id: 'ai-execution',
              data: { id: 'ai-execution', label: 'AI Code Execution' }
            }}
          >
            <FeatureNode 
              title="AI Code Execution"
              size="text-xl"
              color="text-orange-300"
              bgColor="bg-orange-900/30"
              borderColor="border-orange-500"
            />
          </CytoNode>

          {/* Dynamic Query Generator */}
          <CytoNode
            element={{
              id: 'query-generator',
              data: { id: 'query-generator', label: 'Dynamic Query Generator' }
            }}
          >
            <FeatureNode 
              title="Dynamic Query Generator"
              size="text-xl"
              color="text-blue-300"
              bgColor="bg-blue-900/30"
              borderColor="border-blue-500"
            />
          </CytoNode>

          {/* Real-time Subscriptions */}
          <CytoNode
            element={{
              id: 'realtime-subs',
              data: { id: 'realtime-subs', label: 'Real-time Subscriptions' }
            }}
          >
            <FeatureNode 
              title="Real-time Subscriptions"
              size="text-xl"
              color="text-green-300"
              bgColor="bg-green-900/30"
              borderColor="border-green-500"
            />
          </CytoNode>

          {/* TypeScript Engine */}
          <CytoNode
            element={{
              id: 'typescript-engine',
              data: { id: 'typescript-engine', label: 'TypeScript Engine' }
            }}
          >
            <FeatureNode 
              title="TypeScript Engine"
              size="text-xl"
              color="text-purple-300"
              bgColor="bg-purple-900/30"
              borderColor="border-purple-500"
            />
          </CytoNode>

          {/* Visual Query Constructor */}
          <CytoNode
            element={{
              id: 'visual-constructor',
              data: { id: 'visual-constructor', label: 'Visual Query Constructor' }
            }}
          >
            <FeatureNode 
              title="Visual Query Constructor"
              size="text-xl"
              color="text-pink-300"
              bgColor="bg-pink-900/30"
              borderColor="border-pink-500"
            />
          </CytoNode>

          {/* Cytoscape Graphs */}
          <CytoNode
            element={{
              id: 'cytoscape-graphs',
              data: { id: 'cytoscape-graphs', label: 'Interactive Graphs' }
            }}
          >
            <FeatureNode 
              title="Interactive Graphs"
              size="text-xl"
              color="text-cyan-300"
              bgColor="bg-cyan-900/30"
              borderColor="border-cyan-500"
            />
          </CytoNode>

          {/* Supporting features connected to main features */}
          
          {/* OpenRouter AI - connected to AI Execution */}
          <CytoNode
            element={{
              id: 'openrouter-ai',
              data: { id: 'openrouter-ai', label: 'OpenRouter AI' }
            }}
          >
            <FeatureNode 
              title="OpenRouter AI"
              color="text-orange-200"
              bgColor="bg-gray-800/50"
              borderColor="border-gray-600"
            />
          </CytoNode>

          {/* Terminal Emulation - connected to TypeScript Engine */}
          <CytoNode
            element={{
              id: 'terminal-emulation',
              data: { id: 'terminal-emulation', label: 'Terminal Emulation' }
            }}
          >
            <FeatureNode 
              title="Terminal Emulation"
              color="text-purple-200"
              bgColor="bg-gray-800/50"
              borderColor="border-gray-600"
            />
          </CytoNode>

          {/* GraphQL Proxy - connected to Query Generator */}
          <CytoNode
            element={{
              id: 'graphql-proxy',
              data: { id: 'graphql-proxy', label: 'GraphQL Proxy' }
            }}
          >
            <FeatureNode 
              title="GraphQL Proxy"
              color="text-blue-200"
              bgColor="bg-gray-800/50"
              borderColor="border-gray-600"
            />
          </CytoNode>

          {/* Type-safe Operations - connected to Query Generator */}
          <CytoNode
            element={{
              id: 'type-safe-ops',
              data: { id: 'type-safe-ops', label: 'Type-safe Operations' }
            }}
          >
            <FeatureNode 
              title="Type-safe Operations"
              color="text-blue-200"
              bgColor="bg-gray-800/50"
              borderColor="border-gray-600"
            />
          </CytoNode>

          {/* WebSocket Support - connected to Real-time Subscriptions */}
          <CytoNode
            element={{
              id: 'websocket-support',
              data: { id: 'websocket-support', label: 'WebSocket Support' }
            }}
          >
            <FeatureNode 
              title="WebSocket Support"
              color="text-green-200"
              bgColor="bg-gray-800/50"
              borderColor="border-gray-600"
            />
          </CytoNode>

          {/* JWT Authentication - connected to Real-time Subscriptions */}
          <CytoNode
            element={{
              id: 'jwt-auth',
              data: { id: 'jwt-auth', label: 'JWT Authentication' }
            }}
          >
            <FeatureNode 
              title="JWT Authentication"
              color="text-green-200"
              bgColor="bg-gray-800/50"
              borderColor="border-gray-600"
            />
          </CytoNode>

          {/* Interactive Diagrams - connected to Cytoscape */}
          <CytoNode
            element={{
              id: 'interactive-diagrams',
              data: { id: 'interactive-diagrams', label: 'Custom HTML Nodes' }
            }}
          >
            <FeatureNode 
              title="Custom HTML Nodes"
              color="text-cyan-200"
              bgColor="bg-gray-800/50"
              borderColor="border-gray-600"
            />
          </CytoNode>

          {/* Main edges - from center to main features */}
          <CytoEdge element={{ id: 'edge-center-ai', data: { id: 'edge-center-ai', source: 'hasyx-center', target: 'ai-execution' }, classes: ['main-edge'] }} />
          <CytoEdge element={{ id: 'edge-center-query', data: { id: 'edge-center-query', source: 'hasyx-center', target: 'query-generator' }, classes: ['main-edge'] }} />
          <CytoEdge element={{ id: 'edge-center-realtime', data: { id: 'edge-center-realtime', source: 'hasyx-center', target: 'realtime-subs' }, classes: ['main-edge'] }} />
          <CytoEdge element={{ id: 'edge-center-typescript', data: { id: 'edge-center-typescript', source: 'hasyx-center', target: 'typescript-engine' }, classes: ['main-edge'] }} />
          <CytoEdge element={{ id: 'edge-center-constructor', data: { id: 'edge-center-constructor', source: 'hasyx-center', target: 'visual-constructor' }, classes: ['main-edge'] }} />
          <CytoEdge element={{ id: 'edge-center-cyto', data: { id: 'edge-center-cyto', source: 'hasyx-center', target: 'cytoscape-graphs' }, classes: ['main-edge'] }} />

          {/* Secondary edges - from main features to supporting features */}
          <CytoEdge element={{ id: 'edge-ai-openrouter', data: { id: 'edge-ai-openrouter', source: 'ai-execution', target: 'openrouter-ai' } }} />
          <CytoEdge element={{ id: 'edge-typescript-terminal', data: { id: 'edge-typescript-terminal', source: 'typescript-engine', target: 'terminal-emulation' } }} />
          <CytoEdge element={{ id: 'edge-query-proxy', data: { id: 'edge-query-proxy', source: 'query-generator', target: 'graphql-proxy' } }} />
          <CytoEdge element={{ id: 'edge-query-typesafe', data: { id: 'edge-query-typesafe', source: 'query-generator', target: 'type-safe-ops' } }} />
          <CytoEdge element={{ id: 'edge-realtime-websocket', data: { id: 'edge-realtime-websocket', source: 'realtime-subs', target: 'websocket-support' } }} />
          <CytoEdge element={{ id: 'edge-realtime-jwt', data: { id: 'edge-realtime-jwt', source: 'realtime-subs', target: 'jwt-auth' } }} />
          <CytoEdge element={{ id: 'edge-cyto-diagrams', data: { id: 'edge-cyto-diagrams', source: 'cytoscape-graphs', target: 'interactive-diagrams' } }} />

        </Cyto>
      </div>
    </SidebarLayout>
  );
}
