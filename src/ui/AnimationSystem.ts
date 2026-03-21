/**
 * Advanced animation utilities for screen transitions,
 * FLIP animations, staggering, and value tweening.
 */
export class AnimationSystem {
  /**
   * FLIP animation: record positions, make DOM changes, animate from old to new.
   * @param elements Elements to track
   * @param changeFn Function that mutates the DOM
   * @param duration Animation duration in ms
   */
  static async flip(
    elements: HTMLElement[],
    changeFn: () => void,
    duration = 300,
  ): Promise<void> {
    // First: record current positions
    const rects = elements.map((el) => el.getBoundingClientRect());

    // Perform DOM changes
    changeFn();

    // Last: get new positions and Invert + Play
    const animations = elements.map((el, i) => {
      const newRect = el.getBoundingClientRect();
      const dx = rects[i].left - newRect.left;
      const dy = rects[i].top - newRect.top;
      const sw = rects[i].width / newRect.width;
      const sh = rects[i].height / newRect.height;

      return el.animate(
        [
          {
            transform: `translate(${dx}px, ${dy}px) scale(${sw}, ${sh})`,
          },
          {
            transform: 'translate(0, 0) scale(1, 1)',
          },
        ],
        {
          duration,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'forwards',
        },
      );
    });

    await Promise.all(animations.map((a) => a.finished));
  }

  /**
   * Stagger animation: apply the same CSS class to multiple elements
   * with incremental delay.
   */
  static stagger(
    elements: HTMLElement[],
    className: string,
    delayMs = 80,
  ): void {
    elements.forEach((el, i) => {
      el.style.animationDelay = `${i * delayMs}ms`;
      el.classList.add(className);
    });
  }

  /**
   * Smooth value transition using requestAnimationFrame.
   * Useful for HP bars, XP bars, counters.
   */
  static tweenValue(
    from: number,
    to: number,
    duration: number,
    onUpdate: (value: number) => void,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const start = performance.now();
      const delta = to - from;

      function tick(now: number): void {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        onUpdate(from + delta * eased);

        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          onUpdate(to);
          resolve();
        }
      }

      requestAnimationFrame(tick);
    });
  }

  /**
   * Screen transition: slide one screen out and another in.
   */
  static async screenTransition(
    outgoing: HTMLElement,
    incoming: HTMLElement,
    direction: 'left' | 'right' | 'up' | 'down' = 'left',
  ): Promise<void> {
    const duration = 450;
    // Smooth deceleration — no overshoot, no "banging"
    const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';

    const translations: Record<string, { out: string; in: string }> = {
      left: {
        out: 'translateX(-40%)',
        in: 'translateX(40%)',
      },
      right: {
        out: 'translateX(40%)',
        in: 'translateX(-40%)',
      },
      up: {
        out: 'translateY(-40%)',
        in: 'translateY(40%)',
      },
      down: {
        out: 'translateY(40%)',
        in: 'translateY(-40%)',
      },
    };

    const t = translations[direction];

    // Position incoming off-screen
    incoming.style.transform = t.in;
    incoming.style.opacity = '0';

    const outAnim = outgoing.animate(
      [
        { transform: 'translateX(0) translateY(0)', opacity: '1' },
        { transform: t.out, opacity: '0' },
      ],
      { duration, easing, fill: 'forwards' },
    );

    const inAnim = incoming.animate(
      [
        { transform: t.in, opacity: '0' },
        { transform: 'translateX(0) translateY(0)', opacity: '1' },
      ],
      { duration, easing, fill: 'forwards' },
    );

    await Promise.all([outAnim.finished, inAnim.finished]);

    // Clean up inline styles
    incoming.style.transform = '';
    incoming.style.opacity = '';
  }

  /**
   * Shake effect for damage or errors.
   */
  static async shake(
    element: HTMLElement,
    intensity = 6,
  ): Promise<void> {
    const keyframes: Keyframe[] = [
      { transform: 'translateX(0)' },
      { transform: `translateX(-${intensity}px) rotate(-1deg)` },
      { transform: `translateX(${intensity * 0.8}px) rotate(1deg)` },
      { transform: `translateX(-${intensity * 0.6}px) rotate(-0.5deg)` },
      { transform: `translateX(${intensity * 0.4}px) rotate(0.5deg)` },
      { transform: `translateX(-${intensity * 0.2}px)` },
      { transform: 'translateX(0)' },
    ];

    const anim = element.animate(keyframes, {
      duration: 400,
      easing: 'ease-out',
    });
    await anim.finished;
  }

  /**
   * Pop-in effect for new elements appearing.
   */
  static async popIn(element: HTMLElement, delay = 0): Promise<void> {
    element.style.opacity = '0';
    element.style.transform = 'scale(0)';

    if (delay > 0) {
      await new Promise<void>((r) => setTimeout(r, delay));
    }

    const anim = element.animate(
      [
        { opacity: '0', transform: 'scale(0)' },
        { opacity: '1', transform: 'scale(1.12)', offset: 0.6 },
        { opacity: '1', transform: 'scale(1)' },
      ],
      {
        duration: 300,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'forwards',
      },
    );
    await anim.finished;
  }
}
