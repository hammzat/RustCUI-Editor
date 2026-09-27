import {
  FONTS,
  IMAGE_TYPES,
  LINE_TYPES,
  TEXT_ANCHORS,
  VERTICAL_WRAP,
  type Color,
  type ComponentType,
  type FieldValue,
} from "./types";

/**
 * Declarative description of every CUI component. The inspector, JSON
 * exporter/importer and C# generator are all driven from this table, so adding
 * a field here is enough to support it everywhere.
 */

export type FieldKind =
  | { kind: "text"; multiline?: boolean; placeholder?: string; suggestions?: readonly string[] }
  | { kind: "int"; min?: number; max?: number }
  | { kind: "float"; min?: number; max?: number; step?: number }
  | { kind: "bool" }
  | { kind: "color" }
  | { kind: "vec2" }
  | { kind: "enum"; options: readonly string[]; csEnum: string };

export type FieldSpec = FieldKind & {
  key: string;
  label: string;
  /** Property name in Rust's JSON. */
  json: string;
  /** Property name on the Oxide `Cui*Component` class. */
  cs: string;
  default: FieldValue;
  /** Always written to JSON even if equal to the default. */
  required?: boolean;
  hint?: string;
};

export interface ComponentSpec {
  type: ComponentType;
  label: string;
  csClass: string;
  /** Components that draw something. Unity allows one per GameObject. */
  graphic?: boolean;
  description: string;
  fields: FieldSpec[];
}

const WHITE: Color = [1, 1, 1, 1];

export const SPRITE_SUGGESTIONS = [
  "assets/content/ui/ui.background.tile.psd",
  "assets/content/ui/ui.background.transparent.radial.psd",
  "assets/content/ui/ui.background.transparent.linear.psd",
  "assets/content/ui/ui.background.transparent.linearltr.tga",
  "assets/content/ui/ui.background.rounded.png",
  "assets/content/ui/ui.white.tga",
  "assets/icons/close.png",
  "assets/icons/check.png",
  "assets/icons/warning.png",
  "assets/icons/info.png",
  "assets/icons/gear.png",
  "assets/icons/player_loot.png",
] as const;

export const MATERIAL_SUGGESTIONS = [
  "assets/content/ui/uibackgroundblur.mat",
  "assets/content/ui/uibackgroundblur-ingamemenu.mat",
  "assets/content/ui/uibackgroundblur-notice.mat",
  "assets/icons/iconmaterial.mat",
  "assets/icons/greyout.mat",
] as const;

const color = (key = "color", def: Color = WHITE): FieldSpec => ({
  key,
  label: "Color",
  json: "color",
  cs: "Color",
  kind: "color",
  default: def,
});
const fadeIn: FieldSpec = {
  key: "fadeIn",
  label: "Fade in",
  json: "fadeIn",
  cs: "FadeIn",
  kind: "float",
  min: 0,
  step: 0.1,
  default: 0,
  hint: "Seconds",
};
const sprite: FieldSpec = {
  key: "sprite",
  label: "Sprite",
  json: "sprite",
  cs: "Sprite",
  kind: "text",
  suggestions: SPRITE_SUGGESTIONS,
  placeholder: "default — pick from list",
  default: "",
};
const material: FieldSpec = {
  key: "material",
  label: "Material",
  json: "material",
  cs: "Material",
  kind: "text",
  suggestions: MATERIAL_SUGGESTIONS,
  placeholder: "default — pick from list",
  default: "",
};
const imageType: FieldSpec = {
  key: "imageType",
  label: "Image type",
  json: "imagetype",
  cs: "ImageType",
  kind: "enum",
  options: IMAGE_TYPES,
  csEnum: "UnityEngine.UI.Image.Type",
  default: "Simple",
};
const font: FieldSpec = {
  key: "font",
  label: "Font",
  json: "font",
  cs: "Font",
  kind: "enum",
  options: FONTS,
  csEnum: "",
  default: "RobotoCondensed-Bold.ttf",
};
const fontSize: FieldSpec = {
  key: "fontSize",
  label: "Font size",
  json: "fontSize",
  cs: "FontSize",
  kind: "int",
  min: 1,
  max: 200,
  default: 14,
};
const align: FieldSpec = {
  key: "align",
  label: "Align",
  json: "align",
  cs: "Align",
  kind: "enum",
  options: TEXT_ANCHORS,
  csEnum: "TextAnchor",
  default: "UpperLeft",
};
const command: FieldSpec = {
  key: "command",
  label: "Command",
  json: "command",
  cs: "Command",
  kind: "text",
  placeholder: "myplugin.action arg",
  default: "",
};

export const COMPONENT_SPECS: Record<ComponentType, ComponentSpec> = {
  "UnityEngine.UI.Image": {
    type: "UnityEngine.UI.Image",
    label: "Image",
    csClass: "CuiImageComponent",
    graphic: true,
    description: "Solid color, sprite, item icon or server-side PNG.",
    fields: [
      color(),
      sprite,
      material,
      imageType,
      { key: "png", label: "PNG (CRC)", json: "png", cs: "Png", kind: "text", default: "", hint: "FileStorage id" },
      { key: "itemId", label: "Item ID", json: "itemid", cs: "ItemId", kind: "int", default: 0 },
      { key: "skinId", label: "Skin ID", json: "skinid", cs: "SkinId", kind: "int", min: 0, default: 0 },
      fadeIn,
    ],
  },
  "UnityEngine.UI.RawImage": {
    type: "UnityEngine.UI.RawImage",
    label: "Raw image",
    csClass: "CuiRawImageComponent",
    graphic: true,
    description: "Image from a URL, PNG id or Steam avatar.",
    fields: [
      color(),
      {
        key: "url",
        label: "URL",
        json: "url",
        cs: "Url",
        kind: "text",
        placeholder: "https://…/image.png",
        default: "",
      },
      sprite,
      material,
      { key: "png", label: "PNG (CRC)", json: "png", cs: "Png", kind: "text", default: "" },
      { key: "steamId", label: "Steam ID", json: "steamid", cs: "SteamId", kind: "text", default: "", hint: "Avatar" },
      fadeIn,
    ],
  },
  "UnityEngine.UI.Text": {
    type: "UnityEngine.UI.Text",
    label: "Text",
    csClass: "CuiTextComponent",
    graphic: true,
    description: "Label with rich text support: <b>, <i>, <color=#hex>, <size=N>.",
    fields: [
      { key: "text", label: "Text", json: "text", cs: "Text", kind: "text", multiline: true, default: "", required: true },
      fontSize,
      font,
      align,
      color(),
      {
        key: "verticalOverflow",
        label: "Overflow",
        json: "verticalOverflow",
        cs: "VerticalOverflow",
        kind: "enum",
        options: VERTICAL_WRAP,
        csEnum: "VerticalWrapMode",
        default: "Truncate",
      },
      fadeIn,
    ],
  },
  "UnityEngine.UI.Button": {
    type: "UnityEngine.UI.Button",
    label: "Button",
    csClass: "CuiButtonComponent",
    graphic: true,
    description: "Clickable image that runs a console command and/or closes UI.",
    fields: [
      command,
      {
        key: "close",
        label: "Close",
        json: "close",
        cs: "Close",
        kind: "text",
        placeholder: "Element name to destroy",
        default: "",
      },
      color(),
      sprite,
      material,
      imageType,
      fadeIn,
    ],
  },
  "UnityEngine.UI.Outline": {
    type: "UnityEngine.UI.Outline",
    label: "Outline",
    csClass: "CuiOutlineComponent",
    description: "Outline effect around the graphic on this element.",
    fields: [
      color("color", [0, 0, 0, 1]),
      { key: "distance", label: "Distance", json: "distance", cs: "Distance", kind: "vec2", default: [1, -1], required: true },
      {
        key: "useGraphicAlpha",
        label: "Use graphic alpha",
        json: "useGraphicAlpha",
        cs: "UseGraphicAlpha",
        kind: "bool",
        default: false,
      },
    ],
  },
  "UnityEngine.UI.InputField": {
    type: "UnityEngine.UI.InputField",
    label: "Input field",
    csClass: "CuiInputFieldComponent",
    graphic: true,
    description: "Text box. Submitting runs `command <text>`.",
    fields: [
      { key: "text", label: "Text", json: "text", cs: "Text", kind: "text", default: "" },
      command,
      fontSize,
      font,
      { ...align, default: "MiddleLeft" },
      color(),
      {
        key: "characterLimit",
        label: "Char limit",
        json: "characterLimit",
        cs: "CharsLimit",
        kind: "int",
        min: 0,
        default: 0,
      },
      {
        key: "lineType",
        label: "Line type",
        json: "lineType",
        cs: "LineType",
        kind: "enum",
        options: LINE_TYPES,
        csEnum: "UnityEngine.UI.InputField.LineType",
        default: "SingleLine",
      },
      { key: "password", label: "Password", json: "password", cs: "IsPassword", kind: "bool", default: false },
      { key: "readOnly", label: "Read only", json: "readOnly", cs: "ReadOnly", kind: "bool", default: false },
      {
        key: "needsKeyboard",
        label: "Needs keyboard",
        json: "needsKeyboard",
        cs: "NeedsKeyboard",
        kind: "bool",
        default: true,
      },
      { key: "autofocus", label: "Autofocus", json: "autofocus", cs: "Autofocus", kind: "bool", default: false },
    ],
  },
  Countdown: {
    type: "Countdown",
    label: "Countdown",
    csClass: "CuiCountdownComponent",
    description: "Counts on a Text component on the same element. %TIME_LEFT% in text.",
    fields: [
      { key: "startTime", label: "Start", json: "startTime", cs: "StartTime", kind: "float", default: 0 },
      { key: "endTime", label: "End", json: "endTime", cs: "EndTime", kind: "float", default: 10, required: true },
      { key: "step", label: "Step", json: "step", cs: "Step", kind: "float", default: 1 },
      command,
      {
        key: "destroyIfDone",
        label: "Destroy when done",
        json: "destroyIfDone",
        cs: "DestroyIfDone",
        kind: "bool",
        default: true,
      },
      fadeIn,
    ],
  },
  NeedsCursor: {
    type: "NeedsCursor",
    label: "Needs cursor",
    csClass: "CuiNeedsCursorComponent",
    description: "Unlocks the mouse cursor while this element exists.",
    fields: [],
  },
  NeedsKeyboard: {
    type: "NeedsKeyboard",
    label: "Needs keyboard",
    csClass: "CuiNeedsKeyboardComponent",
    description: "Captures keyboard input while this element exists.",
    fields: [],
  },
};

export const COMPONENT_ORDER = Object.keys(COMPONENT_SPECS) as ComponentType[];

export function defaultProps(type: ComponentType): Record<string, FieldValue> {
  const props: Record<string, FieldValue> = {};
  for (const f of COMPONENT_SPECS[type].fields) {
    props[f.key] = Array.isArray(f.default) ? ([...f.default] as FieldValue) : f.default;
  }
  return props;
}

export function valuesEqual(a: FieldValue | undefined, b: FieldValue | undefined): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
  }
  return a === b;
}
