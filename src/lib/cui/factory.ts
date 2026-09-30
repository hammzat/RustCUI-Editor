import { defaultProps } from "./specs";
import type { Color, ComponentType, CuiComponent, CuiNode, FieldValue, Project, RectTransform, Vec2 } from "./types";
import { uid } from "../uid";

export type PresetKind = "panel" | "text" | "button" | "image" | "webimage" | "input" | "countdown" | "container";

export function component(type: ComponentType, props: Record<string, FieldValue> = {}): CuiComponent {
  return { type, props: { ...defaultProps(type), ...props } };
}

/** Pixel-sized rect anchored at the parent's center. */
export function centered(w: number, h: number, dx = 0, dy = 0): RectTransform {
  return {
    anchorMin: [0.5, 0.5],
    anchorMax: [0.5, 0.5],
    offsetMin: [dx - w / 2, dy - h / 2],
    offsetMax: [dx + w / 2, dy + h / 2],
  };
}

export function anchored(min: Vec2, max: Vec2, offMin: Vec2 = [0, 0], offMax: Vec2 = [0, 0]): RectTransform {
  return { anchorMin: min, anchorMax: max, offsetMin: offMin, offsetMax: offMax };
}

export function node(name: string, rect: RectTransform, components: CuiComponent[] = [], extra: Partial<CuiNode> = {}): CuiNode {
  return {
    id: uid(),
    name,
    parentId: null,
    children: [],
    rect,
    components,
    fadeOut: 0,
    destroyUi: "",
    update: false,
    ...extra,
  };
}

const c = (r: number, g: number, b: number, a = 1): Color => [r, g, b, a];

export const PRESET_LABELS: Record<PresetKind, string> = {
  panel: "Panel",
  text: "Text",
  button: "Button",
  image: "Sprite",
  webimage: "Web image",
  input: "Input",
  countdown: "Countdown",
  container: "Container",
};

/** Returns a subtree: first node is the root, the rest are its descendants. */
export function createPreset(kind: PresetKind, name: string): CuiNode[] {
  switch (kind) {
    case "panel":
      return [node(name, centered(240, 160), [component("UnityEngine.UI.Image", { color: c(0.1, 0.1, 0.1, 0.85) })])];
    case "text":
      return [
        node(name, centered(200, 40), [
          component("UnityEngine.UI.Text", { text: "New text", fontSize: 18, align: "MiddleCenter" }),
        ]),
      ];
    case "button": {
      const btn = node(name, centered(160, 40), [
        component("UnityEngine.UI.Button", { color: c(0.8, 0.26, 0.17, 1), command: "" }),
      ]);
      const label = node(`${name}.Text`, anchored([0, 0], [1, 1]), [
        component("UnityEngine.UI.Text", { text: "BUTTON", fontSize: 16, align: "MiddleCenter" }),
      ]);
      return link(btn, label);
    }
    case "image":
      return [
        node(name, centered(64, 64), [
          component("UnityEngine.UI.Image", { sprite: "assets/icons/gear.png", color: c(1, 1, 1, 0.9) }),
        ]),
      ];
    case "webimage":
      return [
        node(name, centered(128, 128), [
          component("UnityEngine.UI.RawImage", { url: "" }),
        ]),
      ];
    case "input": {
      const bg = node(name, centered(260, 36), [component("UnityEngine.UI.Image", { color: c(0, 0, 0, 0.6) })]);
      const input = node(`${name}.Input`, anchored([0, 0], [1, 1], [10, 0], [-10, 0]), [
        component("UnityEngine.UI.InputField", { text: "Type here…", fontSize: 14, command: "myplugin.input" }),
        component("NeedsKeyboard"),
      ]);
      return link(bg, input);
    }
    case "countdown":
      return [
        node(name, centered(200, 40), [
          component("UnityEngine.UI.Text", { text: "Restart in %TIME_LEFT%", fontSize: 18, align: "MiddleCenter" }),
          component("Countdown", { endTime: 60 }),
        ]),
      ];
    case "container":
      return [node(name, centered(240, 160), [])];
  }
}

function link(parent: CuiNode, ...children: CuiNode[]): CuiNode[] {
  for (const ch of children) {
    ch.parentId = parent.id;
    parent.children.push(ch.id);
  }
  return [parent, ...children];
}

// ---------------------------------------------------------------- templates

type Tree = { n: CuiNode; kids?: Tree[] };

function build(name: string, layer: Project["layer"], trees: Tree[]): Project {
  const nodes: Record<string, CuiNode> = {};
  const add = (t: Tree, parentId: string | null) => {
    t.n.parentId = parentId;
    nodes[t.n.id] = t.n;
    for (const k of t.kids ?? []) {
      t.n.children.push(k.n.id);
      add(k, t.n.id);
    }
  };
  trees.forEach((t) => add(t, null));
  return { name, layer, nodes, rootIds: trees.map((t) => t.n.id) };
}

const img = (color: Color, extra: Record<string, FieldValue> = {}) =>
  component("UnityEngine.UI.Image", { color, ...extra });
const txt = (text: string, fontSize: number, align: string, color: Color = [1, 1, 1, 1], extra: Record<string, FieldValue> = {}) =>
  component("UnityEngine.UI.Text", { text, fontSize, align, color, ...extra });

export function blankProject(): Project {
  return { name: "Untitled UI", layer: "Overlay", nodes: {}, rootIds: [] };
}

export function shopTemplate(): Project {
  const items: Tree[] = [
    ["Assault Rifle", "rifle.ak", 1545779598, 250],
    ["Metal Facemask", "metal.facemask", -194953424, 120],
    ["Medical Syringe", "syringe.medical", 1079279582, 15],
    ["Explosive 5.56", "ammo.rifle.explosive", -1321651331, 40],
    ["C4", "explosive.timed", 1248356124, 400],
    ["Large Medkit", "largemedkit", 254522515, 30],
  ].map(([label, short, itemId, price], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x0 = 0.03 + col * 0.325;
    const y1 = 0.78 - row * 0.37;
    return {
      n: node(`Shop.Item.${short}`, anchored([x0, y1 - 0.33], [x0 + 0.3, y1]), [img(c(1, 1, 1, 0.05))], {
        collapsed: true,
      }),
      kids: [
        {
          n: node(`Shop.Item.${short}.Icon`, anchored([0.5, 1], [0.5, 1], [-32, -76], [32, -12]), [
            img(c(1, 1, 1, 1), { itemId: Number(itemId) }),
          ]),
        },
        {
          n: node(`Shop.Item.${short}.Name`, anchored([0, 0.3], [1, 0.48]), [
            txt(String(label), 14, "MiddleCenter", c(0.9, 0.87, 0.82, 1)),
          ]),
        },
        {
          n: node(`Shop.Item.${short}.Buy`, anchored([0.1, 0.06], [0.9, 0.26]), [
            component("UnityEngine.UI.Button", {
              color: c(0.45, 0.55, 0.22, 0.95),
              command: `shop.buy ${short}`,
            }),
          ]),
          kids: [
            {
              n: node(`Shop.Item.${short}.Buy.Text`, anchored([0, 0], [1, 1]), [
                txt(`BUY  <color=#ffd66b>${price} RP</color>`, 13, "MiddleCenter"),
              ]),
            },
          ],
        },
      ],
    };
  });

  return build("Shop", "Overlay", [
    {
      n: node("Shop", anchored([0, 0], [1, 1]), [
        img(c(0, 0, 0, 0.55), { material: "assets/content/ui/uibackgroundblur-ingamemenu.mat" }),
        component("NeedsCursor"),
      ]),
      kids: [
        {
          n: node("Shop.Window", centered(640, 440), [img(c(0.11, 0.11, 0.1, 0.96))]),
          kids: [
            {
              n: node("Shop.Header", anchored([0, 1], [1, 1], [0, -48], [0, 0]), [img(c(0.8, 0.26, 0.17, 1))]),
              kids: [
                {
                  n: node("Shop.Title", anchored([0, 0], [1, 1], [16, 0], [-60, 0]), [
                    txt("<b>SERVER SHOP</b>", 22, "MiddleLeft"),
                  ]),
                },
                {
                  n: node("Shop.Close", anchored([1, 0.5], [1, 0.5], [-44, -16], [-12, 16]), [
                    component("UnityEngine.UI.Button", { color: c(0, 0, 0, 0.35), close: "Shop" }),
                  ]),
                  kids: [
                    {
                      n: node("Shop.Close.Text", anchored([0, 0], [1, 1]), [txt("✕", 16, "MiddleCenter")]),
                    },
                  ],
                },
              ],
            },
            {
              n: node("Shop.Balance", anchored([0, 0.8], [1, 0.88], [16, 0], [-16, 0]), [
                txt("Balance: <color=#ffd66b>1 250 RP</color>", 14, "MiddleRight", c(0.75, 0.72, 0.68, 1)),
              ]),
            },
            ...items,
          ],
        },
      ],
    },
  ]);
}

export function hudTemplate(): Project {
  return build("Status HUD", "Hud", [
    {
      n: node("Hud.Info", anchored([0, 1], [0, 1], [12, -86], [272, -12]), [
        img(c(0.08, 0.08, 0.08, 0.65), { material: "assets/content/ui/uibackgroundblur.mat" }),
      ]),
      kids: [
        {
          n: node("Hud.Info.Accent", anchored([0, 0], [0, 1], [0, 0], [4, 0]), [img(c(0.8, 0.26, 0.17, 1))]),
        },
        {
          n: node("Hud.Info.Server", anchored([0, 0.5], [1, 1], [14, 0], [-10, -4]), [
            txt("<b>RUSTLAND</b> <size=11><color=#9a958d>x2 • Monthly</color></size>", 16, "MiddleLeft"),
          ]),
        },
        {
          n: node("Hud.Info.Online", anchored([0, 0], [1, 0.5], [14, 4], [-10, 0]), [
            txt("Online <color=#8fd14f>148</color>/200    Wipe in <color=#ffd66b>3d 4h</color>", 12, "MiddleLeft", c(0.8, 0.78, 0.74, 1)),
          ]),
        },
      ],
    },
    {
      n: node("Hud.Event", anchored([0.5, 1], [0.5, 1], [-150, -44], [150, -12]), [
        img(c(0.8, 0.26, 0.17, 0.9)),
        component("UnityEngine.UI.Outline", { color: c(0, 0, 0, 0.5), distance: [1, -1] }),
      ]),
      kids: [
        {
          n: node("Hud.Event.Text", anchored([0, 0], [1, 1]), [
            txt("CARGO SHIP arrives in %TIME_LEFT%", 14, "MiddleCenter"),
            component("Countdown", { startTime: 0, endTime: 300, step: 1, destroyIfDone: true }),
          ]),
        },
      ],
    },
  ]);
}

export const TEMPLATES = [
  { id: "blank", label: "Blank", description: "Empty canvas", create: blankProject },
  { id: "shop", label: "Shop window", description: "Modal with item grid, buttons and blur", create: shopTemplate },
  { id: "hud", label: "Status HUD", description: "Server info panel and event countdown", create: hudTemplate },
] as const;
