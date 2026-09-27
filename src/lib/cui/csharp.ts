import { round, walkOrder } from "./geometry";
import { fmtColor, fmtVec2, parentName } from "./serialize";
import { COMPONENT_SPECS, valuesEqual, type FieldSpec } from "./specs";
import type { Color, CuiComponent, CuiNode, FieldValue, Project, Vec2 } from "./types";

export interface CSharpOptions {
  /** Wrap the output into a complete, compilable Oxide/uMod plugin. */
  plugin?: boolean;
  className?: string;
}

const str = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n")}"`;
const float = (n: number) => {
  const r = round(n, 3);
  return `${r}${Number.isInteger(r) ? "" : "f"}`;
};

function csValue(f: FieldSpec, v: FieldValue): string {
  switch (f.kind) {
    case "color":
      return str(fmtColor(v as Color));
    case "vec2":
      return str(fmtVec2(v as Vec2));
    case "int":
      return f.key === "skinId" ? `${Math.round(Number(v))}UL` : String(Math.round(Number(v)));
    case "float":
      return float(Number(v));
    case "bool":
      return v ? "true" : "false";
    case "enum":
      return f.csEnum ? `${f.csEnum}.${v}` : str(String(v));
    default:
      return str(String(v));
  }
}

function componentCs(c: CuiComponent): string {
  const spec = COMPONENT_SPECS[c.type];
  const props = spec.fields
    .filter((f) => f.required || !valuesEqual(c.props[f.key] ?? f.default, f.default))
    .map((f) => `${f.cs} = ${csValue(f, c.props[f.key] ?? f.default)}`);
  return props.length ? `new ${spec.csClass} { ${props.join(", ")} }` : `new ${spec.csClass}()`;
}

function rectCs(node: CuiNode): string {
  const r = node.rect;
  const parts = [`AnchorMin = ${str(fmtVec2(r.anchorMin))}`, `AnchorMax = ${str(fmtVec2(r.anchorMax))}`];
  if (r.offsetMin[0] || r.offsetMin[1]) parts.push(`OffsetMin = ${str(fmtVec2(r.offsetMin))}`);
  if (r.offsetMax[0] || r.offsetMax[1]) parts.push(`OffsetMax = ${str(fmtVec2(r.offsetMax))}`);
  return `new CuiRectTransformComponent { ${parts.join(", ")} }`;
}

function elementCs(project: Project, node: CuiNode, indent: string): string {
  const lines = [
    `${indent}container.Add(new CuiElement`,
    `${indent}{`,
    `${indent}    Name = ${str(node.name)},`,
    `${indent}    Parent = ${str(parentName(project, node))},`,
  ];
  if (node.fadeOut > 0) lines.push(`${indent}    FadeOut = ${float(node.fadeOut)},`);
  if (node.destroyUi) lines.push(`${indent}    DestroyUi = ${str(node.destroyUi)},`);
  if (node.update) lines.push(`${indent}    Update = true,`);
  lines.push(`${indent}    Components =`, `${indent}    {`);
  for (const c of node.components) lines.push(`${indent}        ${componentCs(c)},`);
  lines.push(`${indent}        ${rectCs(node)}`, `${indent}    }`, `${indent}});`);
  return lines.join("\n");
}

function pascal(s: string): string {
  const cleaned = s.replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ""));
  const p = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return /^[A-Za-z_]/.test(p) ? p : `Ui${p}`;
}

export function exportCSharp(project: Project, opts: CSharpOptions = {}): string {
  const plugin = opts.plugin ?? false;
  const className = pascal(opts.className ?? project.name) || "MyUi";
  const indent = plugin ? "            " : "    ";
  const roots = project.rootIds.map((id) => project.nodes[id]).filter(Boolean);
  const body = walkOrder(project)
    .map((id) => elementCs(project, project.nodes[id], indent))
    .join("\n\n");

  const destroy = roots.map((r) => `CuiHelper.DestroyUi(player, ${str(r.name)});`);
  const pad = (lines: string[], p: string) => lines.map((l) => p + l).join("\n");

  if (!plugin) {
    return [
      `private void ShowUi(BasePlayer player)`,
      `{`,
      `    var container = new CuiElementContainer();`,
      ``,
      body,
      ``,
      pad(destroy, "    "),
      `    CuiHelper.AddUi(player, container);`,
      `}`,
      ``,
      `private void HideUi(BasePlayer player)`,
      `{`,
      pad(destroy, "    "),
      `}`,
    ].join("\n");
  }

  const cmd = className.toLowerCase();
  return [
    `using Oxide.Game.Rust.Cui;`,
    `using UnityEngine;`,
    ``,
    `namespace Oxide.Plugins`,
    `{`,
    `    [Info(${str(className)}, "RustCUI Editor", "1.0.0")]`,
    `    [Description("Generated with RustCUI Editor")]`,
    `    public class ${className} : RustPlugin`,
    `    {`,
    `        [ChatCommand(${str(cmd)})]`,
    `        private void CmdShow(BasePlayer player, string command, string[] args) => ShowUi(player);`,
    ``,
    `        [ConsoleCommand(${str(cmd + ".close")})]`,
    `        private void CmdClose(ConsoleSystem.Arg arg)`,
    `        {`,
    `            var player = arg.Player();`,
    `            if (player != null) HideUi(player);`,
    `        }`,
    ``,
    `        private void Unload()`,
    `        {`,
    `            foreach (var player in BasePlayer.activePlayerList) HideUi(player);`,
    `        }`,
    ``,
    `        private void ShowUi(BasePlayer player)`,
    `        {`,
    `            var container = new CuiElementContainer();`,
    ``,
    body,
    ``,
    pad(destroy, "            "),
    `            CuiHelper.AddUi(player, container);`,
    `        }`,
    ``,
    `        private void HideUi(BasePlayer player)`,
    `        {`,
    pad(destroy, "            "),
    `        }`,
    `    }`,
    `}`,
  ].join("\n");
}
