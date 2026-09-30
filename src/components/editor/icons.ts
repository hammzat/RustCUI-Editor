import {
  Box,
  Globe,
  ImageIcon,
  Keyboard,
  MousePointer2,
  MousePointerClick,
  RectangleHorizontal,
  SquareDashed,
  SquareSplitVertical,
  TextCursorInput,
  Timer,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { PresetKind } from "@/lib/cui/factory";
import type { ComponentType, CuiNode } from "@/lib/cui/types";

const COMPONENT_ICONS: Record<ComponentType, LucideIcon> = {
  "UnityEngine.UI.Image": RectangleHorizontal,
  "UnityEngine.UI.RawImage": Globe,
  "UnityEngine.UI.Text": Type,
  "UnityEngine.UI.Button": MousePointerClick,
  "UnityEngine.UI.Outline": SquareDashed,
  "UnityEngine.UI.InputField": TextCursorInput,
  Countdown: Timer,
  NeedsCursor: MousePointer2,
  NeedsKeyboard: Keyboard,
};

export const componentIcon = (t: ComponentType): LucideIcon => COMPONENT_ICONS[t] ?? Box;

const PRIORITY: ComponentType[] = [
  "UnityEngine.UI.Button",
  "UnityEngine.UI.InputField",
  "Countdown",
  "UnityEngine.UI.Text",
  "UnityEngine.UI.RawImage",
  "UnityEngine.UI.Image",
];

export function nodeIcon(node: CuiNode): LucideIcon {
  for (const t of PRIORITY) {
    if (node.components.some((c) => c.type === t)) {
      if (t === "UnityEngine.UI.Image") {
        const c = node.components.find((x) => x.type === t)!;
        if (c.props.itemId || String(c.props.sprite ?? "").startsWith("assets/icons/")) return ImageIcon;
      }
      return COMPONENT_ICONS[t];
    }
  }
  return SquareSplitVertical;
}

export const PRESET_ICONS: Record<PresetKind, LucideIcon> = {
  panel: RectangleHorizontal,
  text: Type,
  button: MousePointerClick,
  image: ImageIcon,
  webimage: Globe,
  input: TextCursorInput,
  countdown: Timer,
  container: SquareSplitVertical,
};
