"use client"

import { Button } from "hasyx/components/ui/button";
import cytoscape from 'cytoscape';
import edgeConnections from 'cytoscape-edge-connections';
import { createContext, forwardRef, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import dagre from 'cytoscape-dagre';
import cola from 'cytoscape-cola';
import edgehandles from 'cytoscape-edgehandles';
// @ts-ignore
import nodeHtmlLabel from 'cytoscape-node-html-label/dist/cytoscape-node-html-label';
import dynamic from 'next/dynamic';
import { useDebounceCallback } from '@react-hook/debounce';
import { Portal } from "hasyx/components/ui/portal";
import cloneDeep from 'lodash/cloneDeep';
import difference from 'lodash/difference';
import flatten from 'lodash/flatten';
import isEqual from 'lodash/isEqual';
import { useResizeDetector } from 'react-resize-detector';
import Debug from './debug';

const logMain = Debug('cyto:main');
const logNode = Debug('cyto:node');
const logEdge = Debug('cyto:edge');

const CytoscapeComponent = dynamic<any>(
  // @ts-ignore
  () => import('react-cytoscapejs').then((m) => m.default),
  { ssr: false }
);

cytoscape.use(dagre);
cytoscape.use(cola);
cytoscape.use(edgeConnections);
cytoscape.use(edgehandles);


let cytoscapeLasso;
let cytoscapeTidyTree;
if (typeof (window) === 'object') {
  import('cytoscape-lasso/dist/cytoscape-lasso').then((m) => {
    cytoscapeLasso = m.default;
    cytoscape.use(cytoscapeLasso);
  });
  import('cytoscape-tidytree').then((m) => {
    cytoscapeTidyTree = m.default;
    cytoscape.use(cytoscapeTidyTree);
  });

  nodeHtmlLabel(cytoscape);
}


if (typeof useDebounceCallback !== 'function') {
  const useDebounceCallback = (callback, delay) => {
    const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    return useCallback((...args) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    }, [callback, delay]);
  };
}

export const Cyto = memo(function Graph({
  onLoaded: _onLoaded,
  onInsert,

  buttons = true,
  buttonsChildren = null,
  layout: _layout,

  children = null,
}: {
  onLoaded?: (cy) => void;
  onInsert?: (inserted, insertQuery) => void;

  spaceId?: any;
  onSpaceId?: (id) => void;
  containerId?: any;
  onContainerId?: (id) => void;

  buttons?: boolean;
  buttonsChildren?: any,
  layout?: any;

  children?: any;
}) {
  const [_cy, setCy] = useState<any>();
  const cyRef = useRef<any>(undefined); cyRef.current = _cy;
  const ceRef = useRef<any>(undefined);
  const layoutRef = useRef<any>(undefined);
  const overlayRef = useRef<any>(undefined);
  const bgRef = useRef<any>(undefined);
  const rootRef = useRef<any>(undefined);
  const { width, height } = useResizeDetector({ targetRef: rootRef });
  const [viewport, setViewport] = useState<{ zoom: number; pan: { x: number; y: number; } }>({ zoom: 1, pan: { x: 0, y: 0 } });


  const gridColor = '#747474';

  const onLoaded = useCallback((cy) => {
    logMain('Graph onLoaded', cy);
    if (_cy) return;
    setCy(cy); cyRef.current = cy;

    const viewport = (event) => {
      const pan = cy.pan();
      const zoom = cy.zoom();

      const translateX = pan.x;
      const translateY = pan.y;


      logMain('[DEBUG_VIEWPORT]', {
        eventSource: event?.type,
        pan,
        zoom,
        translateX,
        translateY,

        overlayTransform: `translate(${translateX}px, ${translateY}px) scale(${zoom})`,
        bgPosition: `${translateX}px ${translateY}px`,
        bgSize: `${zoom * 3}em ${zoom * 3}em`,
      });


      if (bgRef.current) {
        bgRef.current.style['background-size'] = `${zoom * 3}em ${zoom * 3}em`;
        bgRef.current.style['background-position'] = `${translateX}px ${translateY}px`;
      }

      if (overlayRef.current && pan) {

        overlayRef.current.style['transform'] = `translate(${translateX}px, ${translateY}px) scale(${zoom})`;
      }
    };

    const mouseover = (event) => {
      const linkId = +(event?.target?.id ? event?.target.id() : 0);
    };

    const mouseout = (event) => {
      const linkId = +(event?.target?.id ? event?.target.id() : 0);
    };

    const ehpreviewoff = (event, source, target, preview) => {

    };

    const ehcomplete = (event, source, target, added) => {
      const s = source.data();
      const t = target.data();
      added.remove();
      logMain('ehcomplete', s, t);
    };

    const bgtap = (event) => {
      logMain('bgtap', event);
    };

    const onNodeAdd = (evt) => {
      cy.emit(`node:created:${evt.target.id()}`, [evt.target]);
    };

    cy.on("add", "node", onNodeAdd);

    cy.on('ehpreviewoff', ehpreviewoff);
    cy.on('ehcomplete', ehcomplete);
    cy.on('tap', bgtap);

    cy.on('viewport', viewport);
    cy.on('mouseover', mouseover);
    cy.on('mouseout', mouseout);

    const nodes = cy.nodes();
    const edges = cy.edges();

    relayout();

    _onLoaded && _onLoaded(cy);

    return () => {
      cy.removeListener('viewport', viewport);
      cy.removeListener('mouseover', mouseover);
      cy.removeListener('mouseout', mouseout);

      cy.removeListener('ehpreviewoff', ehpreviewoff);
      cy.removeListener('ehcomplete', ehcomplete);
      cy.removeListener('tap', bgtap);

      cy.off("add", "node", onNodeAdd);
    };
  }, [_cy]);

  const [styles, setStyles] = useState({});
  const stylesRef = useRef<any>(styles);
  stylesRef.current = styles;
  const style = useCallback((i: number, styleSheet?: any) => {
    setStyles(prevStyles => {
      const updatedStyles = { ...prevStyles };
      if (!styleSheet) {
        delete updatedStyles[i];
      } else {
        updatedStyles[i] = styleSheet;
      }
      return updatedStyles;
    });
  }, []);

  const newStylesheets = useCallback(() => {
    const e = bgRef.current;
    const stylesheets = [
      ...(flatten(Object.values(styles)))
    ];
    const _stylesheets: any = cloneDeep(stylesheets);
    for (let s in _stylesheets) {
      const st = _stylesheets[s].style;
    }
    return _stylesheets;
  }, [styles]);

  const elements = useMemo(() => [], []);

  const layout = useMemo(() => (typeof (_layout) === 'object' ? _layout : typeof (_layout) === 'function' ? _layout(_cy) : {
    name: 'cola',
    refresh: 10,
    maxSimulationTime: 100,
    fit: false,
    nodeDimensionsIncludeLabels: true,
    edgeLength: function (edge) {
      const baseLength = 100;
      const extraLength = 10;
      const sourceNode = edge.source();
      const targetNode = edge.target();

      const sourceConnectedEdges = sourceNode.connectedEdges().length;
      const targetConnectedEdges = targetNode.connectedEdges().length;

      return baseLength + (sourceConnectedEdges + targetConnectedEdges) * extraLength;
    },
  }), [_layout]);

  const relayout = useDebounceCallback((callback?: () => any) => {
    if (!cyRef.current) return;
    let lay = layoutRef.current;
    if (lay) {
      lay.stop && lay.stop();
      lay.destroy && lay.destroy();
    }
    layoutRef.current = lay = cyRef.current.elements().layout(layout);
    lay.run();
    cyRef.current.once('layoutready', () => setTimeout(() => { logMain('RELAYOUT'); }, 300));
    callback && callback();
  }, 300);

  const [cytoscape, setCytoscape] = useState<any>(null);
  useEffect(() => {
    if (!!rootRef.current) setCytoscape(
      <CytoscapeComponent
        cy={onLoaded}
        elements={elements}
        layout={layout}
        stylesheet={newStylesheets()}
        panningEnabled={true}
        pan={viewport?.pan}
        zoom={viewport?.zoom}
        style={{ width: '100%', height: '100%' }}
      />
    );
  }, [onLoaded, newStylesheets]);

  const center = useCallback(() => {
    if (!_cy) return;
    _cy.pan({ x: 0, y: 0 });
    _cy.zoom(1);
    relayout();
  }, [_cy]);

  const centeredRef = useRef(false);
  useEffect(() => {
    if (!!_cy && !centeredRef.current) {
      center();
      centeredRef.current = true;
    }
  }, [_cy]);

  const [insert, setInsert] = useState<{ from?: any; to?: any; containerId?: any; } | null>(null);
  const [insertOpen, setInsertOpen] = useState<any>(false);
  useEffect(() => {
    if (!insertOpen) setInsert(null);
  }, [insertOpen]);

  useEffect(() => {
    if (insert) setInsertOpen(true);
  }, [insert]);

  const [eh, setEh] = useState<any>(null);
  const ehRef = useRef(eh); ehRef.current = eh;
  const toggleDrawMode = useCallback(() => {
    if (!_cy) return;
    if (eh) {
      eh.disableDrawMode();
      eh.destroy();
      setEh(null);
    } else {
      const eh = _cy.edgehandles({
        canLink: (source, target) => {
          const s = source.data();
          const t = target.data();
          const sCan = typeof (s.canLink) === 'function' ? s.canLink(source, target) : !!s.canLink;
          const tCan = typeof (t.canLink) === 'function' ? t.canLink(source, target) : !!t.canLink;
          return (sCan && tCan);
        },
        edgeParams: (source, target) => {
          const s = source.data();
          const t = target.data();
          logMain('edgeParams', source, s, target, t);
          return {};
        },
      });
      eh.enableDrawMode();
      setEh(eh);
    }
  }, [_cy, eh]);

  const returning = (<>
    <div className="relative w-full h-full" ref={rootRef}>
      {!!insertOpen && !!insert && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <h3 className="text-lg font-medium mb-2">Create Link</h3>
            <p>From: {insert.from}</p>
            <p>To: {insert.to}</p>
            <p>Container: {insert.containerId}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                onClick={() => setInsertOpen(false)}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onInsert && onInsert(
                    { from: insert.from, to: insert.to, containerId: insert.containerId },
                    { from: insert.from, to: insert.to, containerId: insert.containerId }
                  );
                  setInsertOpen(false);
                }}
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
      <div
        ref={bgRef}
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(${gridColor} .1em, transparent .1em), linear-gradient(90deg, ${gridColor} .1em, transparent .1em)`,
          backgroundSize: `3em 3em`,
          backgroundPosition: `0px 0px`
        }}
      />
      {cytoscape}
      <div
        className="absolute right-4 top-4 flex flex-col items-end gap-2"
        style={{
          pointerEvents: 'none',
        }}
      >
        {!!buttons && (
          <>
            <Button
              style={{ pointerEvents: 'all', width: '3em', height: '3em', padding: 0 }}
              onClick={() => relayout()}
              variant="outline"
            >
              🔄
            </Button>
            <Button
              style={{ pointerEvents: 'all', width: '3em', height: '3em', padding: 0 }}
              onClick={center}
              variant="outline"
            >
              ⚪
            </Button>
            <Button
              style={{ pointerEvents: 'all', width: '3em', height: '3em', padding: 0 }}
              onClick={toggleDrawMode}
              variant={!!eh ? 'default' : 'outline'}
            >
              ✏️
            </Button>
          </>
        )}
        {buttonsChildren}
      </div>
    </div>
  </>);

  const classesRef = useRef<{ [id: string]: { [className: string]: number } }>({});

  return <CytoContext.Provider value={{ cyRef, layout, layoutRef, relayout, style, cy: _cy, classesRef, overlayRef }}>
    {returning}
    {!!_cy && <div
      ref={overlayRef}
      className="absolute left-0 top-0"
      style={{
        transformOrigin: 'top left',
        pointerEvents: 'none'
      }}
    >
      {children}
    </div>}
  </CytoContext.Provider>
});

export const CytoContext = createContext<any>(null);
export function useGraph() {
  return useContext(CytoContext);
}

export const CytoElementsContext = createContext(undefined);
CytoElementsContext.displayName = 'GraphElementsContext';


let nodesIterator = 1;


interface CytoNodeProps {
  element?: {
    id: string;
    data: {
      id?: string;
      parent?: string;
      [key: string]: any;
    };
    position?: { x?: number; y?: number };
    classes?: string[];
    locked?: boolean;
    grabbable?: boolean;
  };
  ghost?: boolean;
  children?: any;
  onAdded?: (el: any, cy: any) => void;
  onClick?: (e: any) => void;
  onGhost?: (e: any) => void;
  onUnghost?: (e: any) => void;
  onMount?: (element: any) => void;
  onUnmount?: (element: any) => void;
  [key: string]: any;
}

const CytoNodeComponentCore: React.FC<CytoNodeProps & { forwardedRef: React.Ref<any> }> = (props) => {
  const { forwardedRef, element, ghost, children, onAdded, ...restProps } = props;

  const internalElRef = useRef<any>(null);
  const refToUse = (forwardedRef && typeof forwardedRef === 'object' && 'current' in forwardedRef)
    ? forwardedRef
    : internalElRef;

  const { cy, relayout, overlayRef } = useContext(CytoContext);
  const i = useMemo(() => nodesIterator++, []);
  const cls = useMemo(() => `ni-${i}${ghost ? '-ghost' : ''}`, [i, ghost]);
  const parent: any = useContext(CytoElementsContext);
  
  const id = useMemo(() => `${element?.id || element?.data?.id}`, [element]);
  if (!id) {
    logNode("Error: GraphNode !props.element.id && !props.element.data.id. Element:", element);
    throw new Error(`GraphNode !props.element.id && !props.element.data.id`);
  }


  const [htmlElement, setHtmlElement] = useState<HTMLDivElement | null>(null);
  const boxRefCallback = useCallback((node: HTMLDivElement | null) => {
    logNode(`GraphNode [${id}] boxRefCallback called with node:`, node);
    if (node) {
      setHtmlElement(node);
    } else {
      setHtmlElement(null);
    }
  }, [id]);


  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
    if (props.onMount) props.onMount(element);
    return () => {
      if (props.onUnmount) props.onUnmount(element);
    };
  }, [element, props.onMount, props.onUnmount]);

  const [cytoscapeNode, setCytoscapeNode] = useState<any>(null);

  useEffect(() => {
    if (!cy) return;

    let cyEl = cy.$id(id);
    const isNew = !cyEl.length;

    const dataForCy = {
      linkId: id,
      id,
      label: element?.data?.label || id,
      parent: (parent && parent.id()) || undefined,
      ...element?.data
    };

    if (isNew) {
      const newElData = {
        group: 'nodes' as const,
        data: dataForCy,
        position: element?.position,
        classes: [cls, ...(element?.classes || [])],
        locked: element?.locked,
        grabbable: element?.grabbable,
      };
      cyEl = cy.add(newElData);

      if (ghost) cyEl.emit('ghost');
      if (onAdded) onAdded(cyEl, cy);
    } else {
      cyEl.addClass(cls);
      logNode(`GraphNode [${id}] prepare update. element.data:`, element?.data, 'dataForCy:', dataForCy);
      if (element?.data && !isEqual(cyEl.data(), dataForCy)) {
        logNode(`GraphNode [${id}] Updating data in Cytoscape. Old:`, cyEl.data(), 'New:', dataForCy);
        cyEl.data(dataForCy);
      }

      if (typeof element?.locked === 'boolean' && cyEl.locked() !== element.locked) cyEl[element.locked ? 'lock' : 'unlock']();
      if (typeof element?.grabbable === 'boolean' && cyEl.grabbable() !== element.grabbable) cyEl[element.grabbable ? 'grabify' : 'ungrabify']();
      if (!ghost) {
        const classes = cyEl.classes() as string[];
        const hasGhostVariant = classes.some(c => c.startsWith('ni-') && c.endsWith('-ghost'));
        if (hasGhostVariant) cyEl.emit('unghost');
      }
    }

    (refToUse as React.MutableRefObject<any>).current = cyEl;
    if (typeof forwardedRef === 'function') {
      forwardedRef(cyEl);
    }
    setCytoscapeNode(cyEl);

    const { onClick, onGhost, onUnghost } = restProps;
    const clickHandler = (e: any) => onClick && onClick(e);
    const ghostHandler = (e: any) => onGhost && onGhost(e);
    const unghostHandler = (e: any) => onUnghost && onUnghost(e);

    if (cyEl && typeof cyEl.on === 'function') {
      cyEl.on('click', clickHandler);
      cyEl.on('ghost', ghostHandler);
      cyEl.on('unghost', unghostHandler);
    }

    return () => {
      if (cyEl && typeof cyEl.off === 'function') {
        cyEl.off('click', clickHandler);
        cyEl.off('ghost', ghostHandler);
        cyEl.off('unghost', unghostHandler);
      }

      const currentInstanceCyNode = cy && typeof cy.$id === 'function' ? cy.$id(id) : null;
      if (currentInstanceCyNode && currentInstanceCyNode.length && typeof currentInstanceCyNode.inside === 'function' && currentInstanceCyNode.inside()) {
        currentInstanceCyNode.removeClass(cls);
        const classesArr = currentInstanceCyNode.classes();
        const remainingNiClasses = Array.isArray(classesArr) ? classesArr.filter(c => typeof c === 'string' && c.startsWith('ni-')) : [];

        if (remainingNiClasses.length === 0) {
          currentInstanceCyNode.remove();
        } else if (!ghost && remainingNiClasses.some(c => c.endsWith('-ghost'))) {
          currentInstanceCyNode.emit('ghost');
        }
      }
      if (setCytoscapeNode) setCytoscapeNode(null);
    };
  }, [
    cy, 
    id, 
    ghost, 
    JSON.stringify(element?.data),
    element?.locked,
    element?.grabbable,
    JSON.stringify(element?.classes),
    cls, 
    onAdded, 
    refToUse,
    forwardedRef,
    restProps.onClick, 
    restProps.onGhost, 
    restProps.onUnghost,
    setCytoscapeNode,
    parent
  ]);

  const onPositionCallbackRef = useRef<((p: { x: number, y: number }) => void) | null>(null);
  useEffect(() => {
    onPositionCallbackRef.current = (p: { x: number, y: number }) => {
      if (htmlElement) {

        const transformString = `translate(calc(${p.x}px - 50%), calc(${p.y}px - 50%))`;

        logNode('[DEBUG_NODE_POS]', {
          eventSource: 'onPositionCallbackRef',
          nodeId: id,
          position: p,
          transformString,
        });

        htmlElement.style.transform = transformString;
      }
    };
  }, [id, htmlElement]);


  useEffect(() => {
    if (!children && !ghost) {
        logNode(`GraphNode [${id}] Positioning/Resize effect: No children and not a ghost node. Skipping.`);
        return;
    }
    if (!isMounted || !cytoscapeNode || !cytoscapeNode.length || !cytoscapeNode.inside() || (children && !htmlElement)) {
        if (!isMounted) logNode(`GraphNode [${id}] Positioning effect: Not mounted yet.`);
        if (!cytoscapeNode) logNode(`GraphNode [${id}] Positioning effect: cytoscapeNode is null.`);
        else if (!cytoscapeNode.length) logNode(`GraphNode [${id}] Positioning effect: cytoscapeNode has no length (empty collection).`);
        else if (!cytoscapeNode.inside()) logNode(`GraphNode [${id}] Positioning effect: cytoscapeNode is not inside the graph.`);
        if (children && !htmlElement) logNode(`GraphNode [${id}] Positioning effect: htmlElement (for children) is null.`);
        return;
    }

    const currentCyEl = cytoscapeNode;

    if (htmlElement) {
      const p = currentCyEl.position();
      logNode(`GraphNode [${id}] Positioning effect (run): currentCyEl ready. Position from cy:`, p, 'Transforming htmlElement:', htmlElement);
      if (p && onPositionCallbackRef.current) {
        onPositionCallbackRef.current(p);
      } else if (!p) {
        logNode(`GraphNode [${id}] Positioning effect (run): currentCyEl.position() returned null/undefined.`);
      }
    } else if (children) {
        logNode(`GraphNode [${id}] Positioning effect (run): htmlElement is null despite children being present. Cannot set initial transform.`);
    }


    const handlePositionEvent = (e: any) => {
      logNode(`GraphNode [${id}] 'position' event triggered. Event target position:`, e.target.position());
      if (onPositionCallbackRef.current) {
        onPositionCallbackRef.current(e.target.position());
      }
    };
    currentCyEl.on('position', handlePositionEvent);


    if (htmlElement) {
      const p = currentCyEl.position();
      if (p && onPositionCallbackRef.current) {
        onPositionCallbackRef.current(p);
      }
    }

    let animationFrameId: number | null = null;
    let observer: ResizeObserver | null = null;


    if (htmlElement) {
      logNode(`GraphNode [${id}] Setting up ResizeObserver as htmlElement is available.`);
      observer = new ResizeObserver(entries => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(() => {
          for (let entry of entries) {
            if (entry.target === htmlElement && htmlElement && currentCyEl && currentCyEl.length && currentCyEl.inside()) {
              const { width, height } = entry.contentRect;
              logNode(`GraphNode [${id}] ResizeObserver: HTML element size w=${width}, h=${height}`);
              const parseDim = (v: any): number => typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : 0;
              const currentCyWidth = parseDim(currentCyEl.style('width'));
              const currentCyHeight = parseDim(currentCyEl.style('height'));
              logNode(`GraphNode [${id}] ResizeObserver: Current CyNode size w=${currentCyWidth}, h=${currentCyHeight}`);

              if (width > 0 && height > 0 && (Math.abs(currentCyWidth - width) > 0.5 || Math.abs(currentCyHeight - height) > 0.5)) {
                logNode(`GraphNode [${id}] ResizeObserver: Updating CyNode size to w=${width}, h=${height}`);
                currentCyEl.style({ 'width': width, 'height': height });
                if (relayout) {
                  logNode(`GraphNode [${id}] ResizeObserver: Triggering relayout.`);
                  relayout();
                }
              }
            }
          }
        });
      });

      observer.observe(htmlElement);

      const initialWidth = htmlElement.offsetWidth;
      const initialHeight = htmlElement.offsetHeight;
      logNode(`GraphNode [${id}] Initial HTML size: w=${initialWidth}, h=${initialHeight}`);
      if (initialWidth > 0 && initialHeight > 0 && currentCyEl && currentCyEl.length && currentCyEl.inside()) {
        const parseDim = (v: any): number => typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : 0;
        const currentCyWidth = parseDim(currentCyEl.style('width'));
        const currentCyHeight = parseDim(currentCyEl.style('height'));
        logNode(`GraphNode [${id}] Initial CyNode size: w=${currentCyWidth}, h=${currentCyHeight}`);
        if (Math.abs(currentCyWidth - initialWidth) > 0.5 || Math.abs(currentCyHeight - initialHeight) > 0.5) {
          logNode(`GraphNode [${id}] Initial Sync: Updating CyNode size to w=${initialWidth}, h=${initialHeight}`);
          currentCyEl.style({ 'width': initialWidth, 'height': initialHeight });
          if (relayout) {
            logNode(`GraphNode [${id}] Initial Sync: Triggering relayout.`);
            relayout();
          }
        }
      }
    } else if (children) {
      logNode(`GraphNode [${id}] ResizeObserver setup skipped: htmlElement is null despite children being present.`);
    }

    return () => {
      if (currentCyEl && currentCyEl.length && currentCyEl.inside()) currentCyEl.off('position', handlePositionEvent);
      if (htmlElement && observer) {
        observer.unobserve(htmlElement);
      }
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (observer) observer.disconnect();
    };
  }, [id, relayout, isMounted, cytoscapeNode, onPositionCallbackRef, htmlElement, children, ghost]);

  return <>
    <CytoElementsContext.Provider value={cytoscapeNode}>
      {children && (
        <Portal containerRef={overlayRef}>
          <div
            ref={boxRefCallback}
            style={{
              position: 'absolute',
              pointerEvents: 'all',
            }}
          >
            {isMounted && children}
          </div>
        </Portal>
      )}
    </CytoElementsContext.Provider>
  </>;
};


const cytoNodePropsAreEqual = (
  prevProps: Readonly<CytoNodeProps>,
  nextProps: Readonly<CytoNodeProps>
): boolean => {
  if (prevProps.ghost !== nextProps.ghost) return false;
  if (prevProps.element?.id !== nextProps.element?.id) return false;
  if (!isEqual(prevProps.element?.data, nextProps.element?.data)) return false;
  if (!isEqual(prevProps.element?.position, nextProps.element?.position)) return false;
  if (!isEqual(prevProps.element?.classes, nextProps.element?.classes)) return false;
  if (prevProps.element?.locked !== nextProps.element?.locked) return false;
  if (prevProps.element?.grabbable !== nextProps.element?.grabbable) return false;
  if (prevProps.children !== nextProps.children) return false;
  return true;
};

const ForwardedCytoNodeComponent = forwardRef<any, CytoNodeProps>((props, ref) => {
  return <CytoNodeComponentCore {...props} forwardedRef={ref} />;
});

ForwardedCytoNodeComponent.displayName = 'GraphNode';

export const CytoNode = memo(ForwardedCytoNodeComponent, cytoNodePropsAreEqual);

let edgesIterator = 1;
export const CytoEdge = memo(function GraphEdge({
  element,
  children = null,
  ...props
}: {
  element: {
    id: string;
    data: {
      id: string;
      source: string;
      target: string;
      [key: string]: any;
    };
    classes?: string[];
    [key: string]: any;
  };
  children?: any;
  [key: string]: any
}) {
  const { cy, relayout, classesRef } = useContext(CytoContext);
  const i = useMemo(() => edgesIterator++, []);
  const cls = useMemo(() => `ei-${i}`, []);

  const id = useMemo(() => {
    const eid = element?.id || element?.data?.id;
    if (!eid) {
      if (element?.data?.source && element?.data?.target) {
        logEdge(`GraphEdge: Missing id for edge between ${element.data.source} and ${element.data.target}. Generating fallback: edge-${element.data.source}-${element.data.target}-${i}`);
        return `edge-${element.data.source}-${element.data.target}-${i}`;
      }
      const fallbackId = `generated-edge-${i}`;
      logEdge(`GraphEdge: element.id or element.data.id is required, and source/target are also missing. Using insecure fallback ID: ${fallbackId}. Element data: ${JSON.stringify(element?.data)}`);
      return fallbackId;
    }
    return `${eid}`;
  }, [element, i]);

  const [isMounted, setIsMounted] = useState(false);
  const mount = useCallback(() => {
    logEdge(`GraphEdge [${id}] mount called (all ghost nodes ready). Setting isMounted to true.`);
    setIsMounted(true);
  }, [id]);

  const addEdgeToCytoscape = useCallback(() => {
    if (!cy || !element?.data?.source || !element?.data?.target) {
      logEdge(`GraphEdge [${id}] addEdgeToCytoscape: cy instance or source/target data missing. Element:`, element);
      return;
    }
    if (!isMounted) {
      logEdge(`GraphEdge [${id}] addEdgeToCytoscape: Not mounted yet (ghosts not ready).`);
      return;
    }

    logEdge(`GraphEdge [${id}] addEdgeToCytoscape: Proceeding. Element:`, element);
    const sourceId = element.data.source;
    const targetId = element.data.target;

    let cyEdgeInstance = cy.$id(id);
    if (cyEdgeInstance.length > 0) {
      logEdge(`GraphEdge [${id}] addEdgeToCytoscape: Edge with ID '${id}' already exists. Ensuring instance class '${cls}' is present.`);
      if (!cyEdgeInstance.hasClass(cls)) {
        cyEdgeInstance.addClass(cls);
      }
      return;
    }

    const tryRecreate = () => {
      logEdge(`GraphEdge [${id}] tryRecreate: SourceID=${sourceId}, TargetID=${targetId}`);
      const sourceNode = cy.$id(sourceId);
      const targetNode = cy.$id(targetId);
      logEdge(`GraphEdge [${id}] tryRecreate: Source node '${sourceId}' found: ${sourceNode.length > 0}, Target node '${targetId}' found: ${targetNode.length > 0}`);

      if (!sourceNode.length || !targetNode.length) {
        if (!sourceNode.length) logEdge(`GraphEdge [${id}] tryRecreate: Source node ${sourceId} NOT FOUND in Cytoscape when trying to create edge.`);
        if (!targetNode.length) logEdge(`GraphEdge [${id}] tryRecreate: Target node ${targetId} NOT FOUND in Cytoscape when trying to create edge.`);
        return;
      }

      const edgeDataForCytoscape = {
        group: 'edges' as const,
        data: {
          ...(element.data || {}),
        },
        classes: [cls, ...(element.classes || [])],
      };
      edgeDataForCytoscape.data.id = id;

      logEdge(`GraphEdge [${id}] tryRecreate: Adding edge to Cytoscape:`, edgeDataForCytoscape);
      const addedEdge = cy.add(edgeDataForCytoscape);

      const onClickHandler = (e: any) => {
        logEdge(`GraphEdge [${id}] onClick event`, { event: e, edge: addedEdge, props });
        props.onClick && props.onClick(e);
      };
      addedEdge.on('click', onClickHandler);
      
      const handlers = addedEdge.scratch('_cytoReactHandlers') || {};
      handlers.onClick = onClickHandler;
      addedEdge.scratch('_cytoReactHandlers', handlers);
    };

    const sourceNode = cy.$id(sourceId);
    const targetNode = cy.$id(targetId);
    let waitingForSource = false;
    let waitingForTarget = false;

    if (!sourceNode.length) {
      waitingForSource = true;
      logEdge(`GraphEdge [${id}] addEdgeToCytoscape: Source node ${sourceId} not found. Waiting for node:created:${sourceId}`);
      cy.once(`node:created:${sourceId}`, () => {
        logEdge(`GraphEdge [${id}] addEdgeToCytoscape: node:created:${sourceId} event received.`);
        tryRecreate();
      });
    }
    if (!targetNode.length) {
      waitingForTarget = true;
      logEdge(`GraphEdge [${id}] addEdgeToCytoscape: Target node ${targetId} not found. Waiting for node:created:${targetId}`);
      cy.once(`node:created:${targetId}`, () => {
        logEdge(`GraphEdge [${id}] addEdgeToCytoscape: node:created:${targetId} event received.`);
        tryRecreate();
      });
    }

    if (!waitingForSource && !waitingForTarget) {
      logEdge(`GraphEdge [${id}] addEdgeToCytoscape: Both source and target nodes found initially.`);
      tryRecreate();
    }
  }, [cy, element, isMounted, id, cls, props.onClick]);

  useEffect(() => {
    logEdge(`GraphEdge [${id}] main effect. isMounted: ${isMounted}, element.id: ${element?.id}, element.data.id: ${element?.data?.id}, element.data.source: ${element?.data?.source}, element.data.target: ${element?.data?.target}`);
    if (!cy || !isMounted || !element?.data?.source || !element?.data?.target) {
      if(!cy) logEdge(`GraphEdge [${id}] main effect: cy not available.`);
      if(!isMounted) logEdge(`GraphEdge [${id}] main effect: not mounted (ghosts not ready).`);
      if(!element?.data?.source || !element?.data?.target) logEdge(`GraphEdge [${id}] main effect: source or target missing in element.data.`);
      return;
    }

    let cyEdge = cy.$id(id);
    
    if (!cyEdge.length) {
      logEdge(`GraphEdge [${id}] main effect: Edge does not exist in Cytoscape. Calling addEdgeToCytoscape.`);
      addEdgeToCytoscape();
    } else {
      logEdge(`GraphEdge [${id}] main effect: Edge ${id} exists. Checking for data updates.`);
      const currentCyData = cyEdge.data();
      
      const elementDataForComparison = { ...element.data, id };

      let needsUpdate = false;
      for (const key in elementDataForComparison) {
        if (!isEqual(currentCyData[key], elementDataForComparison[key])) {
          needsUpdate = true;
          break;
        }
      }
      for (const key in currentCyData) {
          if (elementDataForComparison.hasOwnProperty(key) && elementDataForComparison[key] === undefined && currentCyData[key] !== undefined) {
              needsUpdate = true;
              break;
          }
      }

      if (needsUpdate) {
        logEdge(`GraphEdge [${id}] main effect: Data changed. Updating edge data. New:`, element.data, `Old in Cy:`, currentCyData);
        cyEdge.data(element.data);
      } else {
        logEdge(`GraphEdge [${id}] main effect: Data for edge ${id} seems unchanged.`);
      }

      if (!cyEdge.hasClass(cls)) {
        logEdge(`GraphEdge [${id}] main effect: Adding instance class '${cls}' to existing edge.`);
        cyEdge.addClass(cls);
      }
    }
  }, [cy, element, isMounted, id, cls, addEdgeToCytoscape, relayout]);

  useEffect(() => {
    return () => {
      if (cy) {
        const edgeToRemove = cy.$id(id);
        if (edgeToRemove.length) {
          logEdge(`GraphEdge [${id}] Unmounting React component: Removing edge '${id}' from Cytoscape.`);
          edgeToRemove.remove();
        } else {
          logEdge(`GraphEdge [${id}] Unmounting React component: Edge '${id}' not found in Cytoscape for removal.`);
        }
      }
    };
  }, [cy, id]);

  const prevClassesRef = useRef<string[]>([]);
  useEffect(() => {
    if (!cy || !isMounted || !classesRef?.current) {
      return;
    }

    const cyEdge = cy.$id(id);
    if (!cyEdge.length) {
      return; 
    }

    const contextClassCounts = classesRef.current;
    const previousElementClasses = prevClassesRef.current;
    const nextElementClasses = element?.classes || [];

    if (!isEqual(previousElementClasses, nextElementClasses)) {
      logEdge(`GraphEdge [${id}] Classes prop changed. Previous:`, previousElementClasses, `Next:`, nextElementClasses);
      const removed = difference(previousElementClasses, nextElementClasses);
      const added = difference(nextElementClasses, previousElementClasses);

      contextClassCounts[id] = contextClassCounts[id] || {};
      const edgeSpecificClassCounts = contextClassCounts[id];

      removed.forEach(className => {
        edgeSpecificClassCounts[className] = (edgeSpecificClassCounts[className] || 1) - 1;
        if (edgeSpecificClassCounts[className] <= 0) {
          logEdge(`GraphEdge [${id}] Removing class '${className}' from Cytoscape element for edge ${id}.`);
          cyEdge.removeClass(className);
          delete edgeSpecificClassCounts[className]; 
        }
      });

      added.forEach(className => {
        edgeSpecificClassCounts[className] = (edgeSpecificClassCounts[className] || 0) + 1;
        if (edgeSpecificClassCounts[className] === 1) { 
          logEdge(`GraphEdge [${id}] Adding class '${className}' to Cytoscape element for edge ${id}.`);
          cyEdge.addClass(className);
        }
      });
      prevClassesRef.current = [...nextElementClasses];
    }
  }, [cy, id, isMounted, element?.classes, classesRef]);

  useEffect(() => {
    return () => {
      if (!classesRef?.current || !classesRef.current[id] || !prevClassesRef.current) return;
      
      const contextClassCounts = classesRef.current;
      const edgeSpecificClassCounts = contextClassCounts[id];
      const classesThisInstanceManaged = prevClassesRef.current;

      logEdge(`GraphEdge [${id}] Unmounting React component: Cleaning up its classes in classesRef. Classes managed:`, classesThisInstanceManaged);
      classesThisInstanceManaged.forEach(className => {
        if (edgeSpecificClassCounts && edgeSpecificClassCounts[className]) {
          edgeSpecificClassCounts[className]--;
          if (edgeSpecificClassCounts[className] <= 0) {
            delete edgeSpecificClassCounts[className];
          }
        }
      });
      if (edgeSpecificClassCounts && Object.keys(edgeSpecificClassCounts).length === 0) {
        delete contextClassCounts[id];
      }
    };
  }, [id, classesRef]);

  const ghostsRef = useRef(0);
  const ghostMounted = useCallback(() => {
    ghostsRef.current++;
    logEdge(`GraphEdge [${id}] ghostMounted. ghostsRef.current: ${ghostsRef.current}`);
    if (ghostsRef.current >= 2) {
      mount(); 
    }
  }, [id, mount]);

  const onNodeMount = useCallback((type: string, nodeEl: any) => {
    logEdge(`GraphEdge [${id}] CytoNode ${type} (ghost) mounted:`, nodeEl?.id, 'Calling ghostMounted.');
    ghostMounted();
  }, [ghostMounted, id]);

  const onNodeUnmount = useCallback((type: string, nodeEl: any) => {
    logEdge(`GraphEdge [${id}] CytoNode ${type} (ghost) unmounted:`, nodeEl?.id);
  }, [id]);

  const mountedStateRef = useRef(false);
  useEffect(() => {
    if (isMounted && !mountedStateRef.current) {
      logEdge(`GraphEdge [${id}] Main edge component isMounted=true. Calling props.onMount.`);
      mountedStateRef.current = true;
      props.onMount && props.onMount(element);
    }
    return () => {
      if (mountedStateRef.current) {
        logEdge(`GraphEdge [${id}] Main edge component unmounting. Calling props.onUnmount.`);
        mountedStateRef.current = false;
        props.onUnmount && props.onUnmount(element);
      }
    };
  }, [isMounted, element, props.onMount, props.onUnmount]);

  return <>
    <CytoNode
      element={{ id: element.data.source, data: { id: element.data.source } }}
      ghost={true}
      onMount={(el) => onNodeMount('source', el)}
      onUnmount={(el) => onNodeUnmount('source', el)}
    />
    <CytoNode
      element={{ id: element.data.target, data: { id: element.data.target } }}
      ghost={true}
      onMount={(el) => onNodeMount('target', el)}
      onUnmount={(el) => onNodeUnmount('target', el)}
    />
  </>;
}, (prevProps, nextProps) => {
  if (prevProps.element?.id !== nextProps.element?.id) return false;
  if (!isEqual(prevProps.element?.data, nextProps.element?.data)) return false;
  if (!isEqual(prevProps.element?.classes, nextProps.element?.classes)) return false;
  if (prevProps.onClick !== nextProps.onClick) return false;
  if (prevProps.onMount !== nextProps.onMount) return false;
  if (prevProps.onUnmount !== nextProps.onUnmount) return false;
  return true;
});

let stylesIterator = 1;
export const CytoStyle = memo(function GraphStyle({
  stylesheet,
}: {
  stylesheet?: any;
}) {
  const i = useMemo(() => stylesIterator++, []);
  const { style } = useContext(CytoContext);

  useEffect(() => {
    if (style) {
      style(i, stylesheet);
    }
    return () => {
      if (style) {
        style(i, undefined);
      }
    };
  }, [i, style, stylesheet]);

  return null;
}, (p, n) => isEqual(p.stylesheet, n.stylesheet));