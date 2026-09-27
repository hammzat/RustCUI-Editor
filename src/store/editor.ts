"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { component, createPreset, shopTemplate, type PresetKind } from "@/lib/cui/factory";
import { fitWithAnchors, fitWithOffsets, layoutProject, screenBox, type Box } from "@/lib/cui/geometry";
import type { ComponentType, CuiNode, FieldValue, Project, RectTransform } from "@/lib/cui/types";
import { uid } from "@/lib/uid";

export type DragMode = "offsets" | "anchors";

export interface ViewState {
  aspect: number;
  /** null = fit to viewport */
  zoom: number | null;
  grid: boolean;
  snap: boolean;
  gridSize: number;
  dragMode: DragMode;
  hud: boolean;
  background: string;
  backgroundImage: string | null;
}

interface EditorState {
  project: Project;
  selectedId: string | null;
  hoveredId: string | null;
  past: Project[];
  future: Project[];
  lastKey: string | null;
  lastTime: number;
  clipboard: CuiNode[] | null;
  view: ViewState;

  select(id: string | null): void;
  hover(id: string | null): void;
  setView(patch: Partial<ViewState>): void;

  undo(): void;
  redo(): void;

  loadProject(p: Project): void;
  setProjectMeta(patch: Partial<Pick<Project, "name" | "layer">>): void;

  addPreset(kind: PresetKind, parentId?: string | null): void;
  removeNode(id: string): void;
  duplicate(id: string): void;
  copy(id: string): void;
  paste(): void;
  moveNode(id: string, parentId: string | null, index: number): void;

  updateNode(id: string, patch: Partial<Omit<CuiNode, "id" | "children" | "parentId">>, key?: string): void;
  toggleFlag(id: string, flag: "hidden" | "locked" | "collapsed"): void;
  setRect(id: string, rect: RectTransform, key?: string): void;
  setBox(id: string, box: Box, key?: string): void;

  addComponent(id: string, type: ComponentType): void;
  removeComponent(id: string, index: number): void;
  moveComponent(id: string, index: number, dir: -1 | 1): void;
  setField(id: string, index: number, field: string, value: FieldValue, key?: string): void;
}

const HISTORY_LIMIT = 200;
const COALESCE_MS = 1000;

export const DEFAULT_VIEW: ViewState = {
  aspect: 16 / 9,
  zoom: null,
  grid: false,
  snap: true,
  gridSize: 8,
  dragMode: "offsets",
  hud: true,
  background: "dusk",
  backgroundImage: null,
};

// ---------------------------------------------------------------- helpers

export function uniqueName(project: Project, base: string, except?: string): string {
  const taken = new Set(Object.values(project.nodes).filter((n) => n.id !== except).map((n) => n.name));
  if (!taken.has(base)) return base;
  const stem = base.replace(/_\d+$/, "");
  for (let i = 2; ; i++) {
    const name = `${stem}_${i}`;
    if (!taken.has(name)) return name;
  }
}

function collectSubtree(project: Project, id: string): CuiNode[] {
  const out: CuiNode[] = [];
  const walk = (nid: string) => {
    const n = project.nodes[nid];
    if (!n) return;
    out.push(n);
    n.children.forEach(walk);
  };
  walk(id);
  return out;
}

/** Deep-clone a subtree with fresh ids and unique names; returns root id. */
function insertClone(project: Project, subtree: CuiNode[], parentId: string | null, index?: number): string {
  const idMap = new Map<string, string>();
  subtree.forEach((n) => idMap.set(n.id, uid()));
  const root = subtree[0];
  const oldRootName = root.name;
  const newRootName = uniqueName(project, oldRootName);

  for (const src of subtree) {
    const copy: CuiNode = structuredClone(src);
    copy.id = idMap.get(src.id)!;
    copy.children = src.children.map((c) => idMap.get(c)!).filter(Boolean);
    copy.parentId = src === root ? parentId : idMap.get(src.parentId!)!;
    if (src === root) copy.name = newRootName;
    else if (src.name.startsWith(oldRootName + ".")) copy.name = newRootName + src.name.slice(oldRootName.length);
    copy.name = uniqueName(project, copy.name);
    project.nodes[copy.id] = copy;
  }
  const rootId = idMap.get(root.id)!;
  const siblings = parentId ? project.nodes[parentId].children : project.rootIds;
  siblings.splice(index ?? siblings.length, 0, rootId);
  return rootId;
}

function parentBox(project: Project, view: ViewState, node: CuiNode): Box {
  const screen = screenBox(view.aspect);
  if (!node.parentId) return screen;
  return layoutProject(project, screen).get(node.parentId) ?? screen;
}

function isDescendant(project: Project, ancestorId: string, id: string | null): boolean {
  let cur = id;
  while (cur) {
    if (cur === ancestorId) return true;
    cur = project.nodes[cur]?.parentId ?? null;
  }
  return false;
}

const safeStorage = createJSONStorage(() => ({
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      // Quota exceeded (large background image) — keep working in memory.
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
}));

// ---------------------------------------------------------------- store

export const useEditor = create<EditorState>()(
  persist(
    immer((set, get) => {
      /** Apply a recorded change; changes with the same key within a short window merge into one undo step. */
      const change = (recipe: (p: Project, s: EditorState) => void, key?: string) => {
        const before = get().project;
        const now = Date.now();
        set((s) => {
          const merge = key != null && s.lastKey === key && (now - s.lastTime < COALESCE_MS || key.startsWith("g:"));
          if (!merge) {
            s.past.push(before);
            if (s.past.length > HISTORY_LIMIT) s.past.shift();
          }
          s.future = [];
          s.lastKey = key ?? null;
          s.lastTime = now;
          recipe(s.project, s as EditorState);
        });
      };

      return {
        project: shopTemplate(),
        selectedId: null,
        hoveredId: null,
        past: [],
        future: [],
        lastKey: null,
        lastTime: 0,
        clipboard: null,
        view: DEFAULT_VIEW,

        select: (id) => set({ selectedId: id }),
        hover: (id) => {
          if (get().hoveredId !== id) set({ hoveredId: id });
        },
        setView: (patch) =>
          set((s) => {
            Object.assign(s.view, patch);
          }),

        undo: () =>
          set((s) => {
            const prev = s.past.pop();
            if (!prev) return;
            s.future.push(get().project);
            s.project = prev;
            s.lastKey = null;
            if (s.selectedId && !prev.nodes[s.selectedId]) s.selectedId = null;
          }),
        redo: () =>
          set((s) => {
            const next = s.future.pop();
            if (!next) return;
            s.past.push(get().project);
            s.project = next;
            s.lastKey = null;
            if (s.selectedId && !next.nodes[s.selectedId]) s.selectedId = null;
          }),

        loadProject: (p) => {
          change((_, s) => {
            s.project = p;
            s.selectedId = null;
          });
        },
        setProjectMeta: (patch) => change((p) => void Object.assign(p, patch), "meta"),

        addPreset: (kind, parentId) => {
          const project = get().project;
          const target = parentId === undefined ? get().selectedId : parentId;
          const parent = target ? project.nodes[target] : null;
          const base = kind.charAt(0).toUpperCase() + kind.slice(1);
          const prefix = parent ? `${parent.name}.` : "";
          const subtree = createPreset(kind, `${prefix}${base}`);
          let rootId = "";
          change((p, s) => {
            rootId = insertClone(p, subtree, parent?.id ?? null);
            s.selectedId = rootId;
          });
        },

        removeNode: (id) =>
          change((p, s) => {
            const node = p.nodes[id];
            if (!node) return;
            const siblings = node.parentId ? p.nodes[node.parentId].children : p.rootIds;
            const idx = siblings.indexOf(id);
            siblings.splice(idx, 1);
            for (const n of collectSubtree(p, id)) delete p.nodes[n.id];
            s.selectedId = siblings[Math.min(idx, siblings.length - 1)] ?? node.parentId ?? null;
          }),

        duplicate: (id) => {
          const project = get().project;
          const node = project.nodes[id];
          if (!node) return;
          const subtree = collectSubtree(project, id);
          const siblings = node.parentId ? project.nodes[node.parentId].children : project.rootIds;
          change((p, s) => {
            s.selectedId = insertClone(p, subtree, node.parentId, siblings.indexOf(id) + 1);
          });
        },

        copy: (id) => {
          const project = get().project;
          if (!project.nodes[id]) return;
          set({ clipboard: structuredClone(collectSubtree(project, id)) });
        },

        paste: () => {
          const { clipboard, selectedId, project } = get();
          if (!clipboard?.length) return;
          const target = selectedId && project.nodes[selectedId] ? selectedId : null;
          change((p, s) => {
            s.selectedId = insertClone(p, clipboard, target);
          });
        },

        moveNode: (id, parentId, index) => {
          const { project, view } = get();
          const node = project.nodes[id];
          if (!node || (parentId && isDescendant(project, id, parentId))) return;
          const screen = screenBox(view.aspect);
          const layout = layoutProject(project, screen);
          const worldBox = layout.get(id)!;
          const newParentBox = parentId ? layout.get(parentId)! : screen;
          change((p) => {
            const from = node.parentId ? p.nodes[node.parentId].children : p.rootIds;
            const oldIndex = from.indexOf(id);
            from.splice(oldIndex, 1);
            const to = parentId ? p.nodes[parentId].children : p.rootIds;
            const adjusted = from === to && oldIndex < index ? index - 1 : index;
            to.splice(Math.max(0, Math.min(adjusted, to.length)), 0, id);
            const n = p.nodes[id];
            if (n.parentId !== parentId) {
              n.parentId = parentId;
              // Keep the element where it is on screen, like Unity does.
              const fit = view.dragMode === "anchors" ? fitWithAnchors : fitWithOffsets;
              n.rect = fit(n.rect, worldBox, newParentBox);
            }
          });
        },

        updateNode: (id, patch, key) =>
          change((p) => {
            const n = p.nodes[id];
            if (n) Object.assign(n, patch);
          }, key ?? `node:${id}:${Object.keys(patch).join(",")}`),

        toggleFlag: (id, flag) => {
          if (flag === "collapsed") {
            // View-only state: not worth an undo step.
            set((s) => {
              const n = s.project.nodes[id];
              if (n) n.collapsed = !n.collapsed;
            });
            return;
          }
          change((p) => {
            const n = p.nodes[id];
            if (n) n[flag] = !n[flag];
          });
        },

        setRect: (id, rect, key) =>
          change((p) => {
            const n = p.nodes[id];
            if (n) n.rect = rect;
          }, key ?? `rect:${id}`),

        setBox: (id, box, key) => {
          const { project, view } = get();
          const node = project.nodes[id];
          if (!node) return;
          const pb = parentBox(project, view, node);
          const fit = view.dragMode === "anchors" ? fitWithAnchors : fitWithOffsets;
          const rect = fit(node.rect, box, pb);
          change((p) => {
            p.nodes[id].rect = rect;
          }, key ?? `rect:${id}`);
        },

        addComponent: (id, type) =>
          change((p) => {
            p.nodes[id]?.components.push(component(type));
          }),
        removeComponent: (id, index) =>
          change((p) => {
            p.nodes[id]?.components.splice(index, 1);
          }),
        moveComponent: (id, index, dir) =>
          change((p) => {
            const list = p.nodes[id]?.components;
            const to = index + dir;
            if (!list || to < 0 || to >= list.length) return;
            [list[index], list[to]] = [list[to], list[index]];
          }),
        setField: (id, index, field, value, key) =>
          change((p) => {
            const c = p.nodes[id]?.components[index];
            if (c) c.props[field] = value;
          }, key ?? `field:${id}:${index}:${field}`),
      };
    }),
    {
      name: "rustcui-editor",
      version: 1,
      storage: safeStorage,
      partialize: (s) => ({ project: s.project, view: s.view }),
      merge: (persisted, current) => {
        const p = persisted as Partial<EditorState> | undefined;
        return {
          ...current,
          project: p?.project ?? current.project,
          view: { ...DEFAULT_VIEW, ...p?.view },
        };
      },
    },
  ),
);

/** World-space box of a node for the current aspect ratio. */
export function nodeBox(project: Project, aspect: number, id: string): Box | undefined {
  return layoutProject(project, screenBox(aspect)).get(id);
}
