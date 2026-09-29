"use client";

import { useEditor } from "@/store/editor";
import type { EditorHost, ToolImage } from "./executor";

/** Transparent 1x1 GIF used when an external image can't be embedded (CORS). */
const PLACEHOLDER = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

async function screenshot({ hideHud }: { hideHud?: boolean }): Promise<ToolImage> {
  const stage = document.querySelector<HTMLElement>("[data-stage]");
  if (!stage) throw new Error("The canvas is not visible");
  const { toJpeg } = await import("html-to-image");
  const url = await toJpeg(stage, {
    // The stage is scaled by the zoom level; capture it at its 1280x720 logical size.
    width: stage.offsetWidth,
    height: stage.offsetHeight,
    pixelRatio: 1,
    quality: 0.88,
    style: { transform: "none" },
    imagePlaceholder: PLACEHOLDER,
    filter: (n) => {
      if (!(n instanceof HTMLElement)) return true;
      if (n.dataset.editorOnly !== undefined) return false;
      return !(hideHud && n.dataset.hud !== undefined);
    },
  });
  return { mediaType: "image/jpeg", data: url.slice(url.indexOf(",") + 1) };
}

/** EditorHost backed by the live Zustand store. */
export const storeHost: EditorHost = {
  screenshot,
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
