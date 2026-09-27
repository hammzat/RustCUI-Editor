import type { Project, RectTransform, Vec2 } from "./types";

/** Reference height of Rust's UI canvas; offsets are measured in this space. */
export const REFERENCE_HEIGHT = 720;

/** Axis-aligned box in Rust space: (x, y) is the bottom-left corner, Y up. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function screenBox(aspect: number): Box {
  return { x: 0, y: 0, w: Math.round(REFERENCE_HEIGHT * aspect), h: REFERENCE_HEIGHT };
}

/** Round to a sane number of decimals to keep exported strings tidy. */
export function round(n: number, decimals = 3): number {
  const f = 10 ** decimals;
  const r = Math.round(n * f) / f;
  return Object.is(r, -0) ? 0 : r;
}

export function resolveRect(rt: RectTransform, parent: Box): Box {
  const x0 = parent.x + rt.anchorMin[0] * parent.w + rt.offsetMin[0];
  const y0 = parent.y + rt.anchorMin[1] * parent.h + rt.offsetMin[1];
  const x1 = parent.x + rt.anchorMax[0] * parent.w + rt.offsetMax[0];
  const y1 = parent.y + rt.anchorMax[1] * parent.h + rt.offsetMax[1];
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Keep anchors, recompute offsets so the element occupies `target`. */
export function fitWithOffsets(rt: RectTransform, target: Box, parent: Box): RectTransform {
  const ax0 = parent.x + rt.anchorMin[0] * parent.w;
  const ay0 = parent.y + rt.anchorMin[1] * parent.h;
  const ax1 = parent.x + rt.anchorMax[0] * parent.w;
  const ay1 = parent.y + rt.anchorMax[1] * parent.h;
  return {
    anchorMin: [...rt.anchorMin],
    anchorMax: [...rt.anchorMax],
    offsetMin: [round(target.x - ax0, 2), round(target.y - ay0, 2)],
    offsetMax: [round(target.x + target.w - ax1, 2), round(target.y + target.h - ay1, 2)],
  };
}

/** Keep offsets, recompute anchors so the element occupies `target`. */
export function fitWithAnchors(rt: RectTransform, target: Box, parent: Box): RectTransform {
  const pw = parent.w || 1;
  const ph = parent.h || 1;
  return {
    anchorMin: [
      round((target.x - rt.offsetMin[0] - parent.x) / pw, 4),
      round((target.y - rt.offsetMin[1] - parent.y) / ph, 4),
    ],
    anchorMax: [
      round((target.x + target.w - rt.offsetMax[0] - parent.x) / pw, 4),
      round((target.y + target.h - rt.offsetMax[1] - parent.y) / ph, 4),
    ],
    offsetMin: [...rt.offsetMin],
    offsetMax: [...rt.offsetMax],
  };
}

/** Change anchors while keeping the element visually in place. */
export function reanchor(rt: RectTransform, anchorMin: Vec2, anchorMax: Vec2, parent: Box): RectTransform {
  const current = resolveRect(rt, parent);
  return fitWithOffsets({ ...rt, anchorMin, anchorMax }, current, parent);
}

/** Convert everything to relative anchors with zero offsets (scales with any resolution). */
export function bakeToAnchors(rt: RectTransform, parent: Box): RectTransform {
  const current = resolveRect(rt, parent);
  return fitWithAnchors({ ...rt, offsetMin: [0, 0], offsetMax: [0, 0] }, current, parent);
}

export type AnchorPresetH = "left" | "center" | "right" | "stretch";
export type AnchorPresetV = "top" | "middle" | "bottom" | "stretch";

export function presetAnchors(h: AnchorPresetH, v: AnchorPresetV): { min: Vec2; max: Vec2 } {
  const hx: Record<AnchorPresetH, [number, number]> = {
    left: [0, 0],
    center: [0.5, 0.5],
    right: [1, 1],
    stretch: [0, 1],
  };
  const vy: Record<AnchorPresetV, [number, number]> = {
    bottom: [0, 0],
    middle: [0.5, 0.5],
    top: [1, 1],
    stretch: [0, 1],
  };
  return { min: [hx[h][0], vy[v][0]], max: [hx[h][1], vy[v][1]] };
}

export function matchPreset(rt: RectTransform): { h: AnchorPresetH | null; v: AnchorPresetV | null } {
  const hs: AnchorPresetH[] = ["left", "center", "right", "stretch"];
  const vs: AnchorPresetV[] = ["top", "middle", "bottom", "stretch"];
  const h =
    hs.find((p) => {
      const a = presetAnchors(p, "bottom");
      return a.min[0] === rt.anchorMin[0] && a.max[0] === rt.anchorMax[0];
    }) ?? null;
  const v =
    vs.find((p) => {
      const a = presetAnchors("left", p);
      return a.min[1] === rt.anchorMin[1] && a.max[1] === rt.anchorMax[1];
    }) ?? null;
  return { h, v };
}

/** Resolve every node's box in Rust space. */
export function layoutProject(project: Project, screen: Box): Map<string, Box> {
  const out = new Map<string, Box>();
  const walk = (id: string, parent: Box) => {
    const node = project.nodes[id];
    if (!node) return;
    const box = resolveRect(node.rect, parent);
    out.set(id, box);
    for (const c of node.children) walk(c, box);
  };
  for (const id of project.rootIds) walk(id, screen);
  return out;
}

/** Depth-first order == paint order == export order. */
export function walkOrder(project: Project): string[] {
  const out: string[] = [];
  const walk = (id: string) => {
    const node = project.nodes[id];
    if (!node) return;
    out.push(id);
    for (const c of node.children) walk(c);
  };
  project.rootIds.forEach(walk);
  return out;
}

/** Convert a Rust-space box into CSS top/left within a screen of height `screenH`. */
export function toCss(box: Box, screenH: number) {
  return { left: box.x, top: screenH - (box.y + box.h), width: box.w, height: box.h };
}
