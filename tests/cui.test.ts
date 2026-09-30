import { describe, expect, it } from "vitest";
import { exportCSharp } from "@/lib/cui/csharp";
import { blankProject, createPreset, hudTemplate, shopTemplate } from "@/lib/cui/factory";
import {
  bakeToAnchors,
  fitWithAnchors,
  fitWithOffsets,
  reanchor,
  resolveRect,
  screenBox,
  type Box,
} from "@/lib/cui/geometry";
import { exportJson, importJson, validate } from "@/lib/cui/serialize";
import type { Project, RectTransform } from "@/lib/cui/types";

const screen: Box = screenBox(16 / 9);

describe("geometry", () => {
  const rt: RectTransform = { anchorMin: [0.25, 0.5], anchorMax: [0.75, 1], offsetMin: [10, 0], offsetMax: [-10, -20] };

  it("resolves anchors + offsets in Rust space (y up)", () => {
    expect(resolveRect(rt, screen)).toEqual({ x: 330, y: 360, w: 620, h: 340 });
  });

  it("fits a target box keeping anchors", () => {
    const target = { x: 100, y: 100, w: 200, h: 50 };
    const next = fitWithOffsets(rt, target, screen);
    expect(next.anchorMin).toEqual(rt.anchorMin);
    expect(resolveRect(next, screen)).toEqual(target);
  });

  it("fits a target box keeping offsets", () => {
    const target = { x: 100, y: 100, w: 200, h: 50 };
    const next = fitWithAnchors(rt, target, screen);
    expect(next.offsetMin).toEqual(rt.offsetMin);
    const r = resolveRect(next, screen);
    expect(r.x).toBeCloseTo(100, 0);
    expect(r.w).toBeCloseTo(200, 0);
  });

  it("reanchors and bakes without moving the element", () => {
    const before = resolveRect(rt, screen);
    const moved = reanchor(rt, [0, 0], [0, 0], screen);
    expect(resolveRect(moved, screen)).toEqual(before);
    const baked = bakeToAnchors(rt, screen);
    expect(baked.offsetMin).toEqual([0, 0]);
    const r = resolveRect(baked, screen);
    expect(r.x).toBeCloseTo(before.x, 0);
    expect(r.h).toBeCloseTo(before.h, 0);
  });
});

function withButton(): Project {
  const p = blankProject();
  const nodes = createPreset("button", "Btn");
  for (const n of nodes) p.nodes[n.id] = n;
  p.rootIds.push(nodes[0].id);
  return p;
}

describe("json export / import", () => {
  it("exports parents before children with layer as root parent", () => {
    const json = exportJson(withButton());
    expect(json.map((e) => [e.name, e.parent])).toEqual([
      ["Btn", "Overlay"],
      ["Btn.Text", "Btn"],
    ]);
    expect(json[1].components[0]).toMatchObject({ type: "UnityEngine.UI.Text", text: "BUTTON", align: "MiddleCenter" });
    expect(json[0].components.at(-1)).toMatchObject({
      type: "RectTransform",
      anchormin: "0.5 0.5",
      offsetmin: "-80 -20",
    });
  });

  it("omits defaults in minimal mode but keeps required fields", () => {
    const json = exportJson(withButton());
    const text = json[1].components[0];
    expect(text).not.toHaveProperty("font");
    expect(text).toHaveProperty("text");
    expect(json[1].components[1]).not.toHaveProperty("offsetmin");
  });

  it("round-trips templates", () => {
    for (const make of [shopTemplate, hudTemplate]) {
      const p = make();
      const json = exportJson(p);
      const { project, warnings } = importJson(JSON.stringify(json));
      expect(warnings).toEqual([]);
      expect(project.layer).toBe(p.layer);
      expect(exportJson(project)).toEqual(json);
    }
  });

  it("reports broken input", () => {
    expect(() => importJson("{")).toThrow(/Invalid JSON/);
    expect(() => importJson('{"a":1}')).toThrow(/array/);
    const { warnings, project } = importJson(
      JSON.stringify([{ name: "A", parent: "Nope", components: [{ type: "Foo" }] }]),
    );
    expect(project.rootIds).toHaveLength(1);
    expect(warnings.join("\n")).toMatch(/Foo/);
    expect(warnings.join("\n")).toMatch(/Nope/);
  });
});

describe("validation", () => {
  it("flags duplicate names and multiple graphics", () => {
    const p = withButton();
    const [, child] = Object.values(p.nodes);
    child.name = "Btn";
    child.components.push({ type: "UnityEngine.UI.Image", props: {} });
    const msgs = validate(p).map((x) => x.message);
    expect(msgs.some((m) => m.includes("Duplicate"))).toBe(true);
    expect(msgs.some((m) => m.includes("graphic components"))).toBe(true);
    expect(msgs.some((m) => m.includes("NeedsCursor"))).toBe(true);
  });

  it("templates are valid", () => {
    expect(validate(shopTemplate()).filter((p) => p.level === "error")).toEqual([]);
    expect(validate(hudTemplate()).filter((p) => p.level === "error")).toEqual([]);
  });
});

describe("c# export", () => {
  it("generates container code", () => {
    const cs = exportCSharp(withButton());
    expect(cs).toContain('Name = "Btn.Text"');
    expect(cs).toContain("new CuiTextComponent { Text = \"BUTTON\", FontSize = 16, Align = TextAnchor.MiddleCenter }");
    expect(cs).toContain('CuiHelper.DestroyUi(player, "Btn");');
  });

  it("generates a plugin skeleton", () => {
    const cs = exportCSharp(shopTemplate(), { plugin: true });
    expect(cs).toContain("public class Shop : RustPlugin");
    expect(cs).toContain("ItemId = 1545779598");
    expect(cs).toContain('Material = "assets/content/ui/uibackgroundblur-ingamemenu.mat"');
    expect(cs.split("{").length).toBe(cs.split("}").length);
  });
});

describe("design resolution", () => {
  it("rounds fractional font sizes (entered in 1080p) on export", () => {
    const p = withButton();
    const text = Object.values(p.nodes)[1].components[0];
    text.props.fontSize = 25 / 1.5; // 25px typed at 1080p
    expect(exportJson(p)[1].components[0]).toMatchObject({ fontSize: 17 });
    expect(exportCSharp(p)).toContain("FontSize = 17");
  });
});
