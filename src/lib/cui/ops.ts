import { produce } from "immer";
import { layoutProject, round, screenBox, walkOrder } from "./geometry";
import { exportJson, fieldFromJson, importJson, parseNumbers, validate } from "./serialize";
import { COMPONENT_SPECS, defaultProps } from "./specs";
import { LAYERS, type ComponentType, type CuiNode, type Layer, type Project, type Vec2 } from "./types";

/**
 * Pure, name-based edit operations on a project. They take and return immutable
 * projects and throw `Error` with a human-readable message on invalid input —
 * this is the surface exposed to AI tools (in-app assistant and MCP).
 */

type Json = Record<string, unknown>;

const isLayer = (s: unknown): s is Layer => typeof s === "string" && (LAYERS as readonly string[]).includes(s);

function byName(project: Project): Map<string, CuiNode> {
  return new Map(Object.values(project.nodes).map((n) => [n.name, n]));
}

function mustFind(project: Project, name: unknown): CuiNode {
  if (typeof name !== "string" || !name) throw new Error("`name` must be a non-empty string");
  const node = byName(project).get(name);
  if (!node) throw new Error(`Element "${name}" not found. Call get_project to see existing names.`);
  return node;
}

function subtreeIds(project: Project, id: string): string[] {
  const out: string[] = [];
  const walk = (nid: string) => {
    out.push(nid);
    project.nodes[nid]?.children.forEach(walk);
  };
  walk(id);
  return out;
}

export function describeProject(project: Project, aspect: number, selectedId?: string | null) {
  const screen = screenBox(aspect);
  const layout = layoutProject(project, screen);
  const boxes: Record<string, [number, number, number, number]> = {};
  for (const id of walkOrder(project)) {
    const b = layout.get(id)!;
    boxes[project.nodes[id].name] = [round(b.x, 1), round(b.y, 1), round(b.w, 1), round(b.h, 1)];
  }
  return {
    name: project.name,
    layer: project.layer,
    screen: { width: screen.w, height: screen.h, note: "Rust reference space; offsets are in these pixels, origin bottom-left, Y up" },
    selected: selectedId ? (project.nodes[selectedId]?.name ?? null) : null,
    elements: exportJson(project),
    boxes: { format: "[x, y, width, height] resolved in screen space (bottom-left origin)", ...boxes },
    problems: validate(project).map((p) => `${p.level}: ${p.message}`),
  };
}

export function appendElements(project: Project, elements: unknown): { project: Project; added: string[]; warnings: string[] } {
  if (!Array.isArray(elements) || elements.length === 0) throw new Error("`elements` must be a non-empty array");
  const existing = byName(project);
  const { project: imported, warnings, externalParents } = importJson(JSON.stringify(elements));

  const clashes = Object.values(imported.nodes)
    .map((n) => n.name)
    .filter((n) => existing.has(n));
  if (clashes.length) {
    throw new Error(`Element name(s) already exist: ${clashes.join(", ")}. Use update_element or pick unique names.`);
  }

  const resolved = new Set<string>();
  const next = produce(project, (d) => {
    Object.assign(d.nodes, imported.nodes);
    for (const rootId of imported.rootIds) {
      const parentName = externalParents[rootId];
      const parent = parentName ? existing.get(parentName) : undefined;
      if (parent) {
        d.nodes[rootId].parentId = parent.id;
        d.nodes[parent.id].children.push(rootId);
        resolved.add(parentName!);
      } else {
        d.rootIds.push(rootId);
      }
    }
  });
  const kept = warnings.filter((w) => ![...resolved].some((p) => w.includes(`parent "${p}" not found`)));
  const rootLayers = elements
    .map((e) => (e && typeof e === "object" ? (e as Json).parent : undefined))
    .filter(isLayer);
  if (rootLayers.some((l) => l !== project.layer)) {
    kept.push(`Top-level parent differs from the project layer "${project.layer}" — the project layer is used on export`);
  }
  return { project: next, added: Object.values(imported.nodes).map((n) => n.name), warnings: kept };
}

export interface UpdateInput {
  name: string;
  rename?: string;
  fadeOut?: number;
  destroyUi?: string;
  update?: boolean;
  rect?: Json;
  components?: Json[];
  removeComponents?: string[];
}

export function updateElement(project: Project, input: UpdateInput): Project {
  const node = mustFind(project, input.name);
  if (input.rename !== undefined) {
    if (typeof input.rename !== "string" || !input.rename.trim()) throw new Error("`rename` must be a non-empty string");
    if (input.rename !== node.name && byName(project).has(input.rename)) {
      throw new Error(`Element "${input.rename}" already exists`);
    }
  }
  return produce(project, (d) => {
    const n = d.nodes[node.id];
    if (input.rename) {
      // Keep the "Parent.Child" naming convention for descendants.
      const old = n.name;
      for (const id of subtreeIds(project, node.id)) {
        const c = d.nodes[id];
        if (id === node.id) c.name = input.rename;
        else if (c.name.startsWith(old + ".")) c.name = input.rename + c.name.slice(old.length);
      }
    }
    if (input.fadeOut !== undefined) n.fadeOut = Math.max(0, Number(input.fadeOut) || 0);
    if (input.destroyUi !== undefined) n.destroyUi = String(input.destroyUi);
    if (input.update !== undefined) n.update = Boolean(input.update);
    if (input.rect) {
      const r = input.rect;
      const pick = (key: string, cur: Vec2): Vec2 => (key in r ? (parseNumbers(r[key], 2, cur) as Vec2) : cur);
      n.rect = {
        anchorMin: pick("anchormin", n.rect.anchorMin),
        anchorMax: pick("anchormax", n.rect.anchorMax),
        offsetMin: pick("offsetmin", n.rect.offsetMin),
        offsetMax: pick("offsetmax", n.rect.offsetMax),
      };
    }
    for (const t of input.removeComponents ?? []) {
      n.components = n.components.filter((c) => c.type !== t);
    }
    for (const raw of input.components ?? []) {
      const type = String(raw?.type ?? "");
      if (type === "RectTransform") throw new Error("Use `rect` to change the RectTransform");
      const spec = COMPONENT_SPECS[type as ComponentType];
      if (!spec) throw new Error(`Unknown component type "${type}". Known: ${Object.keys(COMPONENT_SPECS).join(", ")}`);
      let comp = n.components.find((c) => c.type === spec.type);
      if (!comp) {
        comp = { type: spec.type, props: defaultProps(spec.type) };
        n.components.push(comp);
      }
      for (const f of spec.fields) {
        if (f.json in raw) comp.props[f.key] = fieldFromJson(f, raw[f.json]);
      }
    }
  });
}

export function deleteElements(project: Project, names: unknown): { project: Project; removed: string[] } {
  if (!Array.isArray(names) || names.length === 0) throw new Error("`names` must be a non-empty array");
  const nodes = names.map((n) => mustFind(project, n));
  const removed: string[] = [];
  const next = produce(project, (d) => {
    for (const node of nodes) {
      if (!d.nodes[node.id]) continue; // already removed as a descendant
      const siblings = node.parentId ? d.nodes[node.parentId]?.children : d.rootIds;
      if (siblings) siblings.splice(siblings.indexOf(node.id), 1);
      for (const id of subtreeIds(project, node.id)) {
        if (d.nodes[id]) removed.push(d.nodes[id].name);
        delete d.nodes[id];
      }
    }
  });
  return { project: next, removed };
}

export function moveElement(project: Project, name: unknown, parent: unknown, index?: unknown): Project {
  const node = mustFind(project, name);
  const target = parent == null || isLayer(parent) ? null : mustFind(project, parent);
  if (target && subtreeIds(project, node.id).includes(target.id)) {
    throw new Error("Cannot move an element into itself or its descendant");
  }
  return produce(project, (d) => {
    const from = node.parentId ? d.nodes[node.parentId].children : d.rootIds;
    from.splice(from.indexOf(node.id), 1);
    const to = target ? d.nodes[target.id].children : d.rootIds;
    const i = typeof index === "number" ? Math.max(0, Math.min(index, to.length)) : to.length;
    to.splice(i, 0, node.id);
    d.nodes[node.id].parentId = target?.id ?? null;
  });
}

export function replaceProject(
  project: Project,
  elements: unknown,
  opts: { name?: unknown; layer?: unknown } = {},
): { project: Project; warnings: string[] } {
  if (!Array.isArray(elements)) throw new Error("`elements` must be an array");
  const { project: imported, warnings } = importJson(JSON.stringify(elements), project.name);
  if (typeof opts.name === "string" && opts.name) imported.name = opts.name;
  if (isLayer(opts.layer)) imported.layer = opts.layer;
  else if (!elements.length) imported.layer = project.layer;
  return { project: imported, warnings };
}
