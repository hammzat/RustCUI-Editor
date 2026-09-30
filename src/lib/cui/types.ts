/**
 * Data model for Rust CUI (Community UI) documents.
 *
 * Coordinates follow Rust / Unity conventions: origin in the bottom-left corner,
 * Y axis pointing up. Offsets are expressed in the 720px-high reference space
 * Rust scales its UI canvas from.
 */

export type Vec2 = [number, number];
/** RGBA, each channel 0..1 — exactly what Rust expects in `"r g b a"` strings. */
export type Color = [number, number, number, number];

export const LAYERS = ["Overall", "Overlay", "Hud.Menu", "Hud", "Under"] as const;
export type Layer = (typeof LAYERS)[number];

export const TEXT_ANCHORS = [
  "UpperLeft",
  "UpperCenter",
  "UpperRight",
  "MiddleLeft",
  "MiddleCenter",
  "MiddleRight",
  "LowerLeft",
  "LowerCenter",
  "LowerRight",
] as const;
export type TextAnchor = (typeof TEXT_ANCHORS)[number];

export const FONTS = [
  "RobotoCondensed-Bold.ttf",
  "RobotoCondensed-Regular.ttf",
  "DroidSansMono.ttf",
  "PermanentMarker.ttf",
] as const;

export const IMAGE_TYPES = ["Simple", "Sliced", "Tiled", "Filled"] as const;
export const VERTICAL_WRAP = ["Truncate", "Overflow"] as const;
export const LINE_TYPES = ["SingleLine", "MultiLineSubmit", "MultiLineNewline"] as const;

export interface RectTransform {
  anchorMin: Vec2;
  anchorMax: Vec2;
  offsetMin: Vec2;
  offsetMax: Vec2;
}

export type ComponentType =
  | "UnityEngine.UI.Image"
  | "UnityEngine.UI.RawImage"
  | "UnityEngine.UI.Text"
  | "UnityEngine.UI.Button"
  | "UnityEngine.UI.Outline"
  | "UnityEngine.UI.InputField"
  | "Countdown"
  | "NeedsCursor"
  | "NeedsKeyboard";

export type FieldValue = string | number | boolean | Color | Vec2;

export interface CuiComponent {
  type: ComponentType;
  /** Values keyed by the field keys declared in the component spec. */
  props: Record<string, FieldValue>;
}

export interface CuiNode {
  id: string;
  name: string;
  parentId: string | null;
  children: string[];
  rect: RectTransform;
  components: CuiComponent[];
  fadeOut: number;
  destroyUi: string;
  update: boolean;
  /** Editor-only flags, never exported. */
  hidden?: boolean;
  locked?: boolean;
  collapsed?: boolean;
}

export interface Project {
  name: string;
  /** Parent layer used for top-level elements. */
  layer: Layer;
  nodes: Record<string, CuiNode>;
  rootIds: string[];
}

/** A single element in the JSON accepted by `CuiHelper.AddUi`. */
export interface CuiJsonElement {
  name: string;
  parent: string;
  components: Array<Record<string, unknown> & { type: string }>;
  fadeOut?: number;
  destroyUi?: string;
  update?: boolean;
}
