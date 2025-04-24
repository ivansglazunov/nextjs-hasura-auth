"use client"

import { useEffect, useState } from "react";
import Debug from "./debug";
import React, { Component, ReactNode, RefCallback } from 'react';

const debug = Debug('aframe');

export function useAframe() {
  const [aframe, setAframe] = useState();
  useEffect(() => {
    // @ts-ignore
    import('aframe')
      .then((module) => setAframe(module))
      .catch((err) => debug("Error loading A-Frame:", err));
  }, []);
  return aframe;
}

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
  // Allow a ref prop named _ref (though useRef is preferred in modern React)
  _ref?: RefCallback<Element | null>;
  // className is a standard React prop, handled specially
  className?: string;
}


export class Entity extends Component<EntityProps> {
  // Add type for the A-Frame element reference
  el: Element | null = null;
  // Flag to differentiate Scene from Entity internally
  isScene: boolean = false;

  /**
   * In response to initial `ref` callback.
   */
  initEntity: RefCallback<Element | null> = (el) => {
    const props = this.props;

    if (!el) {
      return;
    }

    // Store element reference
    this.el = el;

    // Attach events.
    if (props.events) {
      for (const eventName in props.events) {
        addEventListeners(el, eventName, props.events[eventName]);
      }
    }

    // Update entity attributes based on initial props.
    // Pass null for prevProps on initial mount.
    updateAttributes(el, null, props);

    // Allow external ref via _ref prop.
    if (props._ref) {
      props._ref(el);
    }
  };

  /**
   * Handle updates after the initial render.
   */
  componentDidUpdate(prevProps: Readonly<EntityProps>): void {
    const el = this.el;
    const props = this.props;

     if (!el) return; // Should not happen if initEntity was called

    // Update events.
    updateEventListeners(el, prevProps.events || null, props.events || null);

    // Update entity attributes if option is enabled.
    if (options.runSetAttributeOnUpdates) {
      updateAttributes(el, prevProps, props);
    }
  }

  /**
   * Cleanup on unmount.
   */
  componentWillUnmount(): void {
    const el = this.el;
    const props = this.props;

    if (!el) return;

    // Remove events.
    if (props.events) {
      for (const eventName in props.events) {
        removeEventListeners(el, eventName, props.events[eventName]);
      }
    }

     // Optional: If _ref was used, notify parent of unmount (though usually not needed)
     if (props._ref) {
         props._ref(null);
     }
     this.el = null; // Clear reference
  }

  /**
   * Render A-Frame DOM with ref: https://facebook.github.io/react/docs/refs-and-the-dom.html
   */
  render(): ReactNode {
    const props = this.props;
    // Determine the element tag name: 'a-scene' if this.isScene, otherwise use props.primitive or default to 'a-entity'
    const elementName = this.isScene ? 'a-scene' : props.primitive || 'a-entity';

    // Let through props that are OK to render initially during createElement.
    // Currently, this includes basic HTML attributes. Other props are set via setAttribute later.
    const reactProps: Record<string, any> = {};
    for (const propName in props) {
      // Include standard HTML/React attributes valid during creation.
      // A-Frame specific attributes will be handled by setAttribute.
      if (['className', 'id'].includes(propName) || propName.startsWith('data-')) {
         // Special handling for className -> class for HTML element
         if (propName === 'className') {
            reactProps['class'] = props[propName];
         } else {
            reactProps[propName] = props[propName];
         }
      }
      // We will NOT pass A-Frame component props like 'position', 'geometry', 'renderer', 'webxr' here yet.
      // They will be handled by `setAttribute` in `initEntity` and `componentDidUpdate`.
    }

    // Pass children directly to React.createElement
    return React.createElement(
      elementName,
      { ref: this.initEntity, ...reactProps }, // Pass ref and initial allowed props
      props.children
    );
  }
}

// Define SceneProps extending EntityProps if Scene has specific props (currently none)
interface SceneProps extends EntityProps {}

/**
 * Render <a-scene>.
 * <a-scene> extends from <a-entity> in A-Frame so we reuse <Entity/>.
 */
export class Scene extends Entity {
  // Use constructor to set the isScene flag
  constructor(props: SceneProps) {
    super(props);
    this.isScene = true;
  }
  // Inherits render and other methods from Entity
}

// Export default (optional, if needed for compatibility)
// export default { Entity, Scene, options };

// Re-export named exports for standard JS/TS module usage
export { Entity as AframeEntity, Scene as AframeScene, options as aframeOptions };
// Note: Renaming exports to avoid potential conflicts if 'Entity' or 'Scene' are used elsewhere.
// Keep original names if preferred, but be mindful of naming collisions.
