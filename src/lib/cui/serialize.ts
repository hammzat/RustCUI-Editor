import { round, walkOrder } from "./geometry";
import { COMPONENT_SPECS, defaultProps, valuesEqual, type FieldSpec } from "./specs";
import {
  LAYERS,
  type Color,
  type ComponentType,
  type CuiComponent,
  type CuiJsonElement,
  type CuiNode,
  type FieldValue,
  type Layer,
  type Project,
  type RectTransform,
  type Vec2,
} from "./types";
import { uid } from "../uid";

export const fmtNum = (n: number, d = 3) => String(round(n, d));
export const fmtColor = (c: Color) => c.map((v) => fmtNum(v, 3)).join(" ");
export const fmtVec2 = (v: Vec2) => `${fmtNum(v[0], 4)} ${fmtNum(v[1], 4)}`;

export function parseNumbers(value: unknown, count: number, fallback: number[]): number[] {
  if (typeof value !== "string") return fallback;
  const parts = value.trim().split(/[\s,]+/).map(Number);
  return Array.from({ length: count }, (_, i) =>
    Number.isFinite(parts[i]) ? parts[i] : (fallback[i] ?? 0),
  );
}

// ---------------------------------------------------------------- export

export interface ExportOptions {
  /** Skip fields that equal Rust's defaults. */
  minimal?: boolean;
}

function fieldToJson(f: FieldSpec, v: FieldValue): unknown {
  switch (f.kind) {
    case "color":
      return fmtColor(v as Color);
    case "vec2":
      return fmtVec2(v as Vec2);
    case "int":
      return Math.round(Number(v));
    case "float":
      return round(Number(v), 3);
    default:
      return v;
  }
}

export function componentToJson(c: CuiComponent, opts: ExportOptions = {}): Record<string, unknown> & { type: string } {
  const spec = COMPONENT_SPECS[c.type];
  const out: Record<string, unknown> & { type: string } = { type: c.type };
  for (const f of spec.fields) {
    const v = c.props[f.key] ?? f.default;
    if (opts.minimal !== false && !f.required && valuesEqual(v, f.default)) continue;
    out[f.json] = fieldToJson(f, v);
  }
  return out;
}

export function rectToJson(rt: RectTransform, opts: ExportOptions = {}) {
  const out: Record<string, unknown> & { type: string } = {
    type: "RectTransform",
    anchormin: fmtVec2(rt.anchorMin),
    anchormax: fmtVec2(rt.anchorMax),
  };
  const zero = (v: Vec2) => v[0] === 0 && v[1] === 0;
  if (opts.minimal === false || !zero(rt.offsetMin)) out.offsetmin = fmtVec2(rt.offsetMin);
  if (opts.minimal === false || !zero(rt.offsetMax)) out.offsetmax = fmtVec2(rt.offsetMax);
  return out;
}

export function parentName(project: Project, node: CuiNode): string {
  return node.parentId ? (project.nodes[node.parentId]?.name ?? project.layer) : project.layer;
}

export function exportJson(project: Project, opts: ExportOptions = {}): CuiJsonElement[] {
  return walkOrder(project).map((id) => {
    const node = project.nodes[id];
    const el: CuiJsonElement = {
      name: node.name,
      parent: parentName(project, node),
      components: [...node.components.map((c) => componentToJson(c, opts)), rectToJson(node.rect, opts)],
    };
    if (node.fadeOut > 0) el.fadeOut = round(node.fadeOut, 3);
    if (node.destroyUi) el.destroyUi = node.destroyUi;
    if (node.update) el.update = true;
    return el;
  });
}

// ---------------------------------------------------------------- validation

export interface Problem {
  level: "error" | "warning";
  nodeId?: string;
  message: string;
}

export function validate(project: Project): Problem[] {
  const problems: Problem[] = [];
  const seen = new Map<string, string>();
  for (const id of walkOrder(project)) {
    const node = project.nodes[id];
    if (!node.name.trim()) {
      problems.push({ level: "error", nodeId: id, message: "Element has an empty name" });
    } else if (seen.has(node.name)) {
      problems.push({ level: "error", nodeId: id, message: `Duplicate name "${node.name}" — Rust matches parents by name` });
    } else {
      seen.set(node.name, id);
    }
    if ((LAYERS as readonly string[]).includes(node.name)) {
      problems.push({ level: "error", nodeId: id, message: `"${node.name}" is a reserved layer name` });
    }
    const graphics = node.components.filter((c) => COMPONENT_SPECS[c.type].graphic);
    if (graphics.length > 1) {
      problems.push({
        level: "error",
        nodeId: id,
        message: `"${node.name}" has ${graphics.length} graphic components (${graphics
          .map((g) => COMPONENT_SPECS[g.type].label)
          .join(", ")}); Unity allows only one`,
      });
    }
    const types = new Set(node.components.map((c) => c.type));
    if (types.has("Countdown") && !types.has("UnityEngine.UI.Text")) {
      problems.push({ level: "warning", nodeId: id, message: `"${node.name}": Countdown needs a Text component` });
    }
    if (types.has("UnityEngine.UI.Outline") && graphics.length === 0) {
      problems.push({ level: "warning", nodeId: id, message: `"${node.name}": Outline has no graphic to outline` });
    }
    const w = node.rect.anchorMax[0] - node.rect.anchorMin[0];
    const h = node.rect.anchorMax[1] - node.rect.anchorMin[1];
    if (w < 0 || h < 0) {
      problems.push({ level: "warning", nodeId: id, message: `"${node.name}": anchorMax is smaller than anchorMin` });
    }
  }
  const all = Object.values(project.nodes);
  const hasButtons = all.some((n) => n.components.some((c) => c.type === "UnityEngine.UI.Button"));
  const needsCursor = all.some((n) => n.components.some((c) => c.type === "NeedsCursor"));
  if (hasButtons && !needsCursor) {
    problems.push({ level: "warning", message: "There are buttons but no NeedsCursor component — players can't click them" });
  }
  return problems;
}

// ---------------------------------------------------------------- import

export function fieldFromJson(f: FieldSpec, raw: unknown): FieldValue {
  switch (f.kind) {
    case "color":
      return parseNumbers(raw, 4, f.default as number[]) as Color;
    case "vec2":
      return parseNumbers(raw, 2, f.default as number[]) as Vec2;
    case "int":
    case "float": {
      const n = Number(raw);
      return Number.isFinite(n) ? n : (f.default as number);
    }
    case "bool":
      return raw === true || raw === "true" || raw === 1;
    case "enum": {
      const s = String(raw);
      return f.options.includes(s) ? s : (f.default as string);
    }
    default:
      return raw == null ? "" : String(raw);
  }
}

export interface ImportResult {
  project: Project;
  warnings: string[];
  /** Parent names of root nodes that are neither layers nor imported elements. */
  externalParents: Record<string, string>;
}

export function blankRect(): RectTransform {
  return { anchorMin: [0, 0], anchorMax: [1, 1], offsetMin: [0, 0], offsetMax: [0, 0] };
}

/** Parse the JSON passed to `CuiHelper.AddUi` (an array of elements). */
export function importJson(text: string, name = "Imported UI"): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON: ${(e as Error).message}`);
  }
  if (data && typeof data === "object" && !Array.isArray(data) && Array.isArray((data as { elements?: unknown }).elements)) {
    data = (data as { elements: unknown[] }).elements;
  }
  if (!Array.isArray(data)) throw new Error("Expected an array of CUI elements");

  const warnings: string[] = [];
  const nodes: Record<string, CuiNode> = {};
  const byName = new Map<string, string>();
  const rootIds: string[] = [];
  let layer: Layer | null = null;
  const externalParents: Record<string, string> = {};

  data.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") {
      warnings.push(`Element #${index} is not an object — skipped`);
      return;
    }
    const el = raw as Partial<CuiJsonElement>;
    const id = uid();
    const node: CuiNode = {
      id,
      name: typeof el.name === "string" && el.name ? el.name : `Element_${index}`,
      parentId: null,
      children: [],
      rect: blankRect(),
      components: [],
      fadeOut: Number(el.fadeOut) || 0,
      destroyUi: typeof el.destroyUi === "string" ? el.destroyUi : "",
      update: el.update === true,
    };
    for (const c of Array.isArray(el.components) ? el.components : []) {
      if (!c || typeof c !== "object") continue;
      const type = String((c as { type?: unknown }).type ?? "");
      if (type === "RectTransform") {
        const r = c as Record<string, unknown>;
        node.rect = {
          anchorMin: parseNumbers(r.anchormin, 2, [0, 0]) as Vec2,
          anchorMax: parseNumbers(r.anchormax, 2, [1, 1]) as Vec2,
          offsetMin: parseNumbers(r.offsetmin, 2, [0, 0]) as Vec2,
          offsetMax: parseNumbers(r.offsetmax, 2, [0, 0]) as Vec2,
        };
        continue;
      }
      const spec = COMPONENT_SPECS[type as ComponentType];
      if (!spec) {
        warnings.push(`"${node.name}": unsupported component "${type}" was dropped`);
        continue;
      }
      const props = defaultProps(spec.type);
      for (const f of spec.fields) {
        const src = c as Record<string, unknown>;
        if (f.json in src) props[f.key] = fieldFromJson(f, src[f.json]);
      }
      node.components.push({ type: spec.type, props });
    }

    const parent = typeof el.parent === "string" ? el.parent : "Hud";
    const parentId = byName.get(parent);
    if (parentId) {
      node.parentId = parentId;
      nodes[parentId].children.push(id);
    } else {
      rootIds.push(id);
      if ((LAYERS as readonly string[]).includes(parent)) {
        if (layer && layer !== parent) warnings.push(`Mixed root layers; using "${layer}" for all`);
        layer ??= parent as Layer;
      } else {
        externalParents[id] = parent;
        warnings.push(`"${node.name}": parent "${parent}" not found — placed at root`);
      }
    }
    if (byName.has(node.name)) warnings.push(`Duplicate element name "${node.name}"`);
    byName.set(node.name, id);
    nodes[id] = node;
  });

  return { project: { name, layer: layer ?? "Overlay", nodes, rootIds }, warnings, externalParents };
}
