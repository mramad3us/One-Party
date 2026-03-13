/**
 * SVG icon system. Loads the sprite sheet and provides
 * helpers to create icon elements and icon buttons.
 */
export class IconSystem {
  private static loaded = false;

  /** Load sprite.svg and inject into the document body. */
  static async init(): Promise<void> {
    if (IconSystem.loaded) return;

    try {
      const resp = await fetch(
        new URL('../icons/sprite.svg', import.meta.url).href,
      );
      const text = await resp.text();
      const container = document.createElement('div');
      container.style.display = 'none';
      container.innerHTML = text;
      document.body.insertBefore(container, document.body.firstChild);
      IconSystem.loaded = true;
    } catch (err) {
      console.error('Failed to load icon sprite:', err);
    }
  }

  /**
   * Create an inline SVG element referencing a symbol from the sprite.
   * @param name Icon name without "icon-" prefix (e.g. "sword")
   * @param className Additional CSS classes
   */
  static icon(name: string, className?: string): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const classes = ['icon'];
    if (className) classes.push(className);
    svg.setAttribute('class', classes.join(' '));
    svg.setAttribute('aria-hidden', 'true');

    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    const id = name.startsWith('icon-') ? name : `icon-${name}`;
    use.setAttribute('href', `#${id}`);
    svg.appendChild(use);

    return svg;
  }

  /**
   * Create a button element containing an icon.
   * @param name Icon name
   * @param label Accessible label
   * @param onClick Click handler
   * @param className Additional CSS classes for the button
   */
  static iconButton(
    name: string,
    label: string,
    onClick: () => void,
    className?: string,
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = `btn btn-ghost${className ? ` ${className}` : ''}`;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    btn.appendChild(IconSystem.icon(name));
    btn.addEventListener('click', onClick);
    return btn;
  }
}
