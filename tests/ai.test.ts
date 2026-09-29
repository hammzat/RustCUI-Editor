import { describe, expect, it } from "vitest";
import { runTool, TOOL_DEFS, type EditorHost } from "@/lib/ai/executor";
import { blankProject, shopTemplate } from "@/lib/cui/factory";
import type { Project } from "@/lib/cui/types";

function host(start: Project) {
  let project = start;
  let selected: string | null = null;
  const commits: string[] = [];
  const h: EditorHost = {
    getProject: () => project,
    commit: (p, label) => {
      project = p;
      commits.push(label);
    },
    aspect: () => 16 / 9,
    selectedId: () => selected,
    selectByName: (name) => {
      const n = Object.values(project.nodes).find((x) => x.name === name);
      selected = n?.id ?? null;
      return name === null || !!n;
    },
  };
  return { h, commits, get: () => project };
}

const run = (h: EditorHost, name: string, input: unknown) => JSON.parse(runTool(h, name, input));

describe("ai tools", () => {
  it("defines every tool with a schema", () => {
    expect(TOOL_DEFS.map((t) => t.name)).toContain("add_elements");
    for (const t of TOOL_DEFS) expect(t.input_schema.type).toBe("object");
  });

  it("adds elements, including children of existing elements", () => {
    const t = host(blankProject());
    run(t.h, "add_elements", {
      elements: [
        {
          name: "Menu",
          parent: "Overlay",
          components: [
            { type: "UnityEngine.UI.Image", color: "0 0 0 0.8" },
            { type: "RectTransform", anchormin: "0.5 0.5", anchormax: "0.5 0.5", offsetmin: "-200 -150", offsetmax: "200 150" },
          ],
        },
      ],
    });
    const r = run(t.h, "add_elements", {
      elements: [{ name: "Menu.Title", parent: "Menu", components: [{ type: "UnityEngine.UI.Text", text: "Hi", fontSize: 20 }] }],
    });
    expect(r.warnings).toEqual([]);
    const p = t.get();
    const menu = Object.values(p.nodes).find((n) => n.name === "Menu")!;
    expect(menu.children).toHaveLength(1);
    expect(p.rootIds).toEqual([menu.id]);
    expect(t.commits).toHaveLength(2);
  });

  it("rejects duplicate names and unknown elements", () => {
    const t = host(shopTemplate());
    expect(() => runTool(t.h, "add_elements", { elements: [{ name: "Shop", parent: "Overlay", components: [] }] })).toThrow(/already exist/);
    expect(() => runTool(t.h, "update_element", { name: "Nope" })).toThrow(/not found/);
    expect(() => runTool(t.h, "delete_elements", { names: "Shop" })).toThrow(/array/);
    expect(t.commits).toEqual([]);
  });

  it("updates rect and merges components, renaming descendants", () => {
    const t = host(shopTemplate());
    run(t.h, "update_element", {
      name: "Shop.Header",
      rename: "Shop.Top",
      rect: { offsetmin: "0 -60" },
      components: [{ type: "UnityEngine.UI.Image", color: "0.2 0.4 0.8 1" }, { type: "UnityEngine.UI.Outline", distance: "2 -2" }],
    });
    const d = run(t.h, "get_project", {});
    const top = d.elements.find((e: { name: string }) => e.name === "Shop.Top");
    expect(top.components[0]).toMatchObject({ type: "UnityEngine.UI.Image", color: "0.2 0.4 0.8 1" });
    expect(top.components[1]).toMatchObject({ type: "UnityEngine.UI.Outline", distance: "2 -2" });
    expect(top.components.at(-1)).toMatchObject({ offsetmin: "0 -60" });
    expect(d.elements.some((e: { name: string }) => e.name === "Shop.Top.Title" || e.name === "Shop.Title")).toBe(true);
  });

  it("moves, deletes, replaces and exports", () => {
    const t = host(shopTemplate());
    run(t.h, "move_element", { name: "Shop.Balance", parent: "Shop.Header", index: 0 });
    expect(run(t.h, "get_project", {}).elements.find((e: { name: string }) => e.name === "Shop.Balance").parent).toBe("Shop.Header");
    expect(() => runTool(t.h, "move_element", { name: "Shop", parent: "Shop.Window" })).toThrow(/itself/);
    const del = run(t.h, "delete_elements", { names: ["Shop.Window"] });
    expect(del.removed.length).toBeGreaterThan(10);
    run(t.h, "replace_project", { elements: [], layer: "Hud" });
    expect(t.get().layer).toBe("Hud");
    expect(runTool(t.h, "export_code", { format: "csharp" })).toContain("CuiElementContainer");
  });
});
