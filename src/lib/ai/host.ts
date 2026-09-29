"use client";

import { useEditor } from "@/store/editor";
import type { EditorHost } from "./executor";

/** EditorHost backed by the live Zustand store. */
export const storeHost: EditorHost = {
  getProject: () => useEditor.getState().project,
  commit: (project) => useEditor.getState().applyProject(project),
  aspect: () => useEditor.getState().view.aspect,
  selectedId: () => useEditor.getState().selectedId,
  selectByName: (name) => {
    const s = useEditor.getState();
    if (name === null) {
      s.select(null);
      return true;
    }
    const node = Object.values(s.project.nodes).find((n) => n.name === name);
    if (!node) return false;
    s.select(node.id);
    return true;
  },
};
