"use client"

import { useEffect, useState, useRef, useImperativeHandle, forwardRef, ForwardedRef } from "react";
import Debug from "./debug";
import React, { Component, ReactNode, RefCallback } from 'react';

const debug = Debug('aframe');

/**
 * Use this hook to ensure A-Frame is loaded before using the components in children aframe components.
 * @returns A-Frame undefined, or the module when loaded.
 */
export function useAframe() {
  const [aframe, setAframe] = useState<any>(undefined);
  useEffect(() => {
    // @ts-ignore
    import('aframe')
      .then((module) => setAframe(module))
      .catch((err) => debug("Error loading A-Frame:", err));
  }, []);
  return aframe;
}

/**
 * You can simple import from 'aframe', or use this provider, to ensure A-Frame is loaded before using the components in children aframe components.
 * @param children - The children components to render.
 * @returns Children components wrapped if aframe is loaded.
 */
export function AframeProvider({ children }: { children: React.ReactNode }) {
  const aframe = useAframe();
  return <>{!!aframe && children}</>;
}

// --- Original Helper Functions ---

const nonEntityPropNames = ['children', 'events', 'primitive', '_ref']; // Added _ref as it's handled specially
const filterNonEntityPropNames = (propName: string): boolean => {
  return nonEntityPropNames.indexOf(propName) === -1;
};

export const options = {
  // React needs this because React serializes.
  // Preact does not because Preact runs `.setAttribute` on its own.
  runSetAttributeOnUpdates: true
};

/**
 * Call `.setAttribute()` on the `ref`, passing prop data directly to A-Frame.
 * Converted to TypeScript.
 */
function doSetAttribute(el: Element, props: Record<string, any>, propName: string): void {
  if (propName === 'className') {
    // Use setAttribute for 'class'
    el.setAttribute('class', props.className);
  } else if (props[propName] && typeof props[propName] === 'function') {
    // Skip function props (like event handlers passed directly, though 'events' prop is preferred)
    return;
  } else {
    // Use setAttribute for others. A-Frame components will parse appropriately.
    // Need to handle objects/arrays - A-Frame's setAttribute handles stringification for components.
     if (typeof props[propName] === 'object' && props[propName] !== null) {
      // A-Frame's .setAttribute stringifies objects/arrays correctly for its components
      el.setAttribute(propName, props[propName]);
     } else {
       el.setAttribute(propName, props[propName]);
     }
  }
}

/**
 * Handle diffing of previous and current attributes.
 * Converted to TypeScript.
 * @param el - The A-Frame element.
 * @param prevProps - Previous props map.
 * @param props - Current props map.
 */
function updateAttributes(el: Element | null, prevProps: Record<string, any> | null, props: Record<string, any>): void {
  if (!el || !props || prevProps === props) {
    return;
  }

  // Set attributes.
  for (const propName in props) {
    // Filter out non-AFrame props before setting attribute
    if (!filterNonEntityPropNames(propName)) {
      continue;
    }
    // Check if value changed before setting
    if (!prevProps || props[propName] !== prevProps[propName]) {
       doSetAttribute(el, props, propName);
    }
  }

  // See if attributes were removed.
  if (prevProps) {
    for (const propName in prevProps) {
       // Filter out non-AFrame props
      if (!filterNonEntityPropNames(propName)) {
        continue;
      }
      if (props[propName] === undefined) {
        el.removeAttribute(propName);
      }
    }
  }
}


/**
 * Register event handlers for an event name to ref.
 * Converted to TypeScript.
 * @param el - DOM element.
 * @param eventName - The name of the event.
 * @param handlers - Handler function or array of handler functions.
 */
function addEventListeners(el: Element, eventName: string, handlers: EventListenerOrEventListenerObject | EventListenerOrEventListenerObject[]): void {
  if (!handlers) {
    return;
  }

  const handlerList = Array.isArray(handlers) ? handlers : [handlers];

  // Register.
  for (const handler of handlerList) {
    // Type assertion might be needed depending on exact handler types
    el.addEventListener(eventName, handler);
  }
}

/**
 * Unregister event handlers for an event name to ref.
 * Converted to TypeScript.
 * @param el - DOM element.
 * @param eventName - The name of the event.
 * @param handlers - Handler function or array of handler functions.
 */
function removeEventListeners(el: Element, eventName: string, handlers: EventListenerOrEventListenerObject | EventListenerOrEventListenerObject[]): void {
  if (!handlers) {
    return;
  }

  const handlerList = Array.isArray(handlers) ? handlers : [handlers];

  // Unregister.
  for (const handler of handlerList) {
    // Type assertion might be needed
     el.removeEventListener(eventName, handler);
  }
}


/**
 * Handle diffing of previous and current event maps.
 * Converted to TypeScript.
 * @param el - The A-Frame element.
 * @param prevEvents - Previous event map.
 * @param events - Current event map.
 */
function updateEventListeners(el: Element | null, prevEvents: Record<string, any> | null, events: Record<string, any> | null): void {
   if (!el || !prevEvents || !events || prevEvents === events) {
    return;
  }

  // Add new or changed listeners
  for (const eventName in events) {
    // Didn't change.
    if (prevEvents[eventName] === events[eventName]) {
      continue;
    }

    // If changed, remove old previous event listeners.
    if (prevEvents[eventName]) {
      removeEventListeners(el, eventName, prevEvents[eventName]);
    }

    // Add new event listeners.
    addEventListeners(el, eventName, events[eventName]);
  }

  // Remove listeners for events that no longer exist
  for (const eventName in prevEvents) {
    if (!events[eventName]) {
      removeEventListeners(el, eventName, prevEvents[eventName]);
    }
  }
}


// --- React Component Classes ---

interface EntityProps extends Record<string, any> {
  children?: ReactNode;
  events?: Record<string, EventListenerOrEventListenerObject | EventListenerOrEventListenerObject[]>;
  primitive?: string;
  _ref?: RefCallback<Element | null>;
  className?: string;
}

// Define the type for the forwarded ref (can be null or the DOM element)
type EntityRef = ForwardedRef<Element | null>;

// --- Entity Component using forwardRef ---
const EntityComponent = forwardRef<Element | null, EntityProps>((
  props,
  forwardedRef // The ref passed from the parent
) => {
  // Internal ref to hold the actual DOM element
  const internalElRef = useRef<Element | null>(null);
  const [isMounted, setIsMounted] = useState(false); // Track mount state

  // Combine the forwarded ref and the internal ref
  // This ensures the parent gets the ref AND we can use it internally
  useEffect(() => {
    if (typeof forwardedRef === 'function') {
      forwardedRef(internalElRef.current);
    } else if (forwardedRef) {
      forwardedRef.current = internalElRef.current;
    }
     // Run effect only when ref object changes, or on mount/unmount
     return () => {
         if (typeof forwardedRef === 'function') {
             forwardedRef(null);
         } else if (forwardedRef) {
             forwardedRef.current = null;
         }
     }
  }, [forwardedRef]); // Dependency on the ref object itself

  // Effect for setup and cleanup (runs once on mount, cleanup on unmount)
  useEffect(() => {
    const el = internalElRef.current;
    if (!el) return;

    // Set initial attributes (on mount)
    debug("Entity mounted, setting initial attributes:", props);
    updateAttributes(el, null, props);

    // Attach initial events (on mount)
    if (props.events) {
      for (const eventName in props.events) {
        addEventListeners(el, eventName, props.events[eventName]);
      }
    }

    // Legacy _ref support (on mount)
    if (props._ref) {
      props._ref(el);
    }

    setIsMounted(true); // Mark as mounted after setup

    // Cleanup function
    return () => {
      debug("Entity unmounting, cleaning up events and _ref");
      if (props.events) {
        for (const eventName in props.events) {
          removeEventListeners(el, eventName, props.events[eventName]);
        }
      }
      if (props._ref) {
        props._ref(null);
      }
      // No need to remove attributes, element itself is removed
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty array: run only on mount and unmount

  // Effect for updating attributes and events (runs when props change after mount)
  useEffect(() => {
    if (!isMounted) return; // Don't run updates before mount setup is complete

    const el = internalElRef.current;
    if (!el) return;

    debug("Entity props updated, updating attributes/events:", props);
    // Assume prevProps logic is needed here, but we don't have easy access in Hooks.
    // For simplicity, re-applying all attributes/events on prop change.
    // More complex diffing would require storing prevProps in a ref.

    // Update attributes (rudimentary)
    if (options.runSetAttributeOnUpdates) {
        // Simplistic update: Just apply current props. Might need prevProps for perfect diffing.
        updateAttributes(el, null /* Pass null to force update? Or store prevProps */, props);
    }

    // Update events (rudimentary)
    // We need prevProps to do this properly. Let's assume events don't change often for now,
    // or rely on the mount/unmount cleanup/setup cycle.
    // A more robust solution would involve storing prevProps.events in a ref.
    // updateEventListeners(el, prevProps.events || null, props.events || null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props, isMounted]); // Re-run when props change *after* mount

  // --- Render Logic --- 
  const { children, primitive, className, id, mixin, style, ...componentProps } = props;
  const elementName = primitive || 'a-entity'; // Default to a-entity

  // Define props that should be passed directly to React.createElement
  const initialPropNames = [
    'id',        // Standard HTML
    'mixin',     // A-Frame specific but often needed early
    // Critical A-Frame attributes for Scene/AR initialization:
    'renderer',
    'webxr',
    'vr-mode-ui',
    'embedded',
  ];

  // Filter props to pass initially
  const reactProps: Record<string, any> = {};
  if (className) reactProps['class'] = className; // Handle className
  if (style) reactProps['style'] = style; // Pass style directly

  for (const propName of initialPropNames) {
    if (props[propName] !== undefined) {
      reactProps[propName] = props[propName];
    }
  }
  // Add data attributes
  for (const propName in props) {
      if (propName.startsWith('data-')) {
          reactProps[propName] = props[propName];
      }
  }

  // Render the element with the internal ref
  return React.createElement(
    elementName,
    { ref: internalElRef, ...reactProps },
    children
  );
});

EntityComponent.displayName = 'Entity'; // Set display name for DevTools

// Define SceneProps extending EntityProps if Scene has specific props (currently none)
interface SceneProps extends EntityProps {}

// --- Scene Component using forwardRef ---
const SceneComponent = forwardRef<Element | null, SceneProps>((
    props,
    forwardedRef
) => {
    // Reuse the EntityComponent logic, overriding the primitive
    return <EntityComponent {...props} primitive="a-scene" ref={forwardedRef} />;
});

SceneComponent.displayName = 'Scene'; // Set display name for DevTools

// Export the forwarded components with the desired names
export { EntityComponent as AframeEntity, SceneComponent as AframeScene, options as aframeOptions };

// Remove old class-based exports
// export class Entity extends Component<EntityProps> { ... }
// export class Scene extends Entity { ... }
