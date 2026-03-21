/**
 * Dev mode — toggled via a session cookie.
 *
 * Set in browser console:  document.cookie = "devmode=true"
 * Clear:                   document.cookie = "devmode=false"
 *
 * Session cookies disappear when the browser tab closes.
 */

const COOKIE_NAME = 'devmode';

/** Check whether dev mode is active. */
export function isDevMode(): boolean {
  return document.cookie.split(';').some(
    (c) => c.trim().startsWith(`${COOKIE_NAME}=true`),
  );
}

/** Enable or disable dev mode (session cookie — no expiry). */
export function setDevMode(enabled: boolean): void {
  document.cookie = `${COOKIE_NAME}=${enabled}; path=/; SameSite=Lax`;
}
