let counter = 0;

/** Short unique id for editor-internal references (never exported). */
export function uid(): string {
  counter = (counter + 1) % 1e6;
  return `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
