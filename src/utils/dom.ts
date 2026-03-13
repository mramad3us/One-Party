/** Creates an HTML element with optional attributes and children. */
export function el(
  tag: string,
  attrs?: Record<string, string>,
  children?: (HTMLElement | string)[],
): HTMLElement {
  const element = document.createElement(tag);

  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      element.setAttribute(key, value);
    }
  }

  if (children) {
    for (const child of children) {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(child);
      }
    }
  }

  return element;
}

/** Creates an SVG icon element using a <use> reference. */
export function svg(id: string, className?: string): SVGElement {
  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgEl.setAttribute('class', `icon${className ? ` ${className}` : ''}`);
  const useEl = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  useEl.setAttribute('href', `#${id}`);
  svgEl.appendChild(useEl);
  return svgEl;
}

/** Creates a text node. */
export function text(content: string): Text {
  return document.createTextNode(content);
}

/** querySelector shorthand. Returns the first matching element or null. */
export function $(selector: string, parent?: HTMLElement): HTMLElement | null {
  return (parent ?? document).querySelector(selector);
}

/** querySelectorAll shorthand. Returns matches as an array. */
export function $$(selector: string, parent?: HTMLElement): HTMLElement[] {
  return Array.from((parent ?? document).querySelectorAll(selector));
}

/** Adds one or more CSS classes to an element. */
export function addClass(element: HTMLElement, ...classes: string[]): void {
  element.classList.add(...classes);
}

/** Removes one or more CSS classes from an element. */
export function removeClass(element: HTMLElement, ...classes: string[]): void {
  element.classList.remove(...classes);
}

/** Toggles a CSS class on an element, with optional force flag. */
export function toggleClass(element: HTMLElement, className: string, force?: boolean): void {
  element.classList.toggle(className, force);
}

/** Returns a promise that resolves when the element's CSS transition ends. */
export function onTransitionEnd(element: HTMLElement): Promise<void> {
  return new Promise<void>((resolve) => {
    const handler = (): void => {
      element.removeEventListener('transitionend', handler);
      resolve();
    };
    element.addEventListener('transitionend', handler);
  });
}
