import { exportCSharp } from "@/lib/cui/csharp";
import {
  appendElements,
  deleteElements,
  describeProject,
  moveElement,
  replaceProject,
  updateElement,
  type UpdateInput,
} from "@/lib/cui/ops";
import { exportJson } from "@/lib/cui/serialize";
import type { Project } from "@/lib/cui/types";
import defs from "./tools.json";

export const AI_INSTRUCTIONS: string = defs.instructions;
export const TOOL_DEFS = defs.tools as { name: string; description: string; input_schema: Record<string, unknown> }[];
export type ToolName = (typeof defs.tools)[number]["name"];

export interface ToolImage {
  data: string; // base64
  mediaType: "image/jpeg" | "image/png";
}

/** Tool result: text for the model, optionally with an image. */
export interface ToolOutput {
  text: string;
  image?: ToolImage;
}

/** Bridge between tool calls and the editor state. */
export interface EditorHost {
  /** Render the canvas; absent where there is no DOM (tests). */
  screenshot?(opts: { hideHud?: boolean }): Promise<ToolImage>;
  getProject(): Project;
  /** Apply a new project as one undo step. */
  commit(project: Project, label: string): void;
  aspect(): number;
  selectedId(): string | null;
  selectByName(name: string | null): boolean;
}

type Input = Record<string, unknown>;

/**
 * Run one tool call against the editor.
 * Rejects with a model-readable Error message when the input is invalid.
 */
export async function runTool(host: EditorHost, name: string, rawInput: unknown): Promise<ToolOutput> {
  if (name === "get_screenshot") {
    if (!host.screenshot) throw new Error("Screenshots are not available in this environment");
    const input = (rawInput ?? {}) as Input;
    const image = await host.screenshot({ hideHud: input.hideHud === true });
    return { text: "Screenshot of the 1280x720 reference screen.", image };
  }
  return { text: runSync(host, name, rawInput) };
}

const ok = (data: unknown) => JSON.stringify(data);

function runSync(host: EditorHost, name: string, rawInput: unknown): string {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new Error("Tool input must be a JSON object");
  }
  const input = rawInput as Input;
  const project = host.getProject();

  switch (name as ToolName) {
    case "get_project":
      return ok(describeProject(project, host.aspect(), host.selectedId()));

    case "add_elements": {
      const r = appendElements(project, input.elements);
      host.commit(r.project, `AI: add ${r.added.length} element(s)`);
      return ok({ added: r.added, warnings: r.warnings });
    }

    case "update_element": {
      if (input.components !== undefined && !Array.isArray(input.components)) throw new Error("`components` must be an array");
      if (input.removeComponents !== undefined && !Array.isArray(input.removeComponents)) {
        throw new Error("`removeComponents` must be an array");
      }
      if (input.rect !== undefined && (typeof input.rect !== "object" || input.rect === null)) {
        throw new Error("`rect` must be an object");
      }
      const next = updateElement(project, input as unknown as UpdateInput);
      host.commit(next, `AI: update ${String(input.name)}`);
      return ok({ updated: input.rename ?? input.name });
    }

    case "delete_elements": {
      const r = deleteElements(project, input.names);
      host.commit(r.project, `AI: delete ${r.removed.length} element(s)`);
      return ok({ removed: r.removed });
    }

    case "move_element": {
      const next = moveElement(project, input.name, input.parent, input.index);
      host.commit(next, `AI: move ${String(input.name)}`);
      return ok({ moved: input.name, parent: input.parent ?? null });
    }

    case "replace_project": {
      const r = replaceProject(project, input.elements, { name: input.name, layer: input.layer });
      host.commit(r.project, "AI: replace project");
      return ok({ elements: Object.keys(r.project.nodes).length, layer: r.project.layer, warnings: r.warnings });
    }

    case "select_element": {
      const n = input.name;
      if (n !== null && typeof n !== "string") throw new Error("`name` must be a string or null");
      if (!host.selectByName(n)) throw new Error(`Element "${n}" not found`);
      return ok({ selected: n });
    }

    case "export_code": {
      if (input.format === "csharp") return exportCSharp(project, { plugin: input.plugin === true });
      if (input.format === "json") return JSON.stringify(exportJson(project), null, 2);
      throw new Error("`format` must be \"json\" or \"csharp\"");
    }

    default:
      throw new Error(`Unknown tool "${name}"`);
  }
}
