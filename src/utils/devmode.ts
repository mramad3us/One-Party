/**
 * Dev mode — toggled via Settings menu, persisted in localStorage.
 */

const STORAGE_KEY = 'oneparty-devmode';

/** Check whether dev mode is active. */
export function isDevMode(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

/** Enable or disable dev mode. */
export function setDevMode(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}
