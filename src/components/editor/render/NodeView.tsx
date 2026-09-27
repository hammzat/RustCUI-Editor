import {
  Check,
  Info,
  Package,
  Settings,
  TriangleAlert,
  User,
  X,
  ImageIcon,
  type LucideIcon,
} from "lucide-react";
import { memo, type CSSProperties, type ReactNode } from "react";
import type { Color, CuiComponent, CuiNode } from "@/lib/cui/types";
import { renderRichText } from "./richText";

export const rgba = (c: Color) =>
  `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${c[3]})`;

const ICON_SPRITES: Record<string, LucideIcon> = {
  "assets/icons/close.png": X,
  "assets/icons/check.png": Check,
  "assets/icons/warning.png": TriangleAlert,
  "assets/icons/info.png": Info,
  "assets/icons/gear.png": Settings,
  "assets/icons/player_loot.png": Package,
};

const FONT_STYLE: Record<string, CSSProperties> = {
  "RobotoCondensed-Bold.ttf": { fontFamily: "var(--cui-font-bold)", fontWeight: 700 },
  "RobotoCondensed-Regular.ttf": { fontFamily: "var(--cui-font-bold)", fontWeight: 400 },
  "DroidSansMono.ttf": { fontFamily: "var(--cui-font-mono)", fontWeight: 400 },
  "PermanentMarker.ttf": { fontFamily: "var(--cui-font-marker)", fontWeight: 400 },
};

function alignStyle(align: string): CSSProperties {
  const v = align.startsWith("Upper") ? "flex-start" : align.startsWith("Lower") ? "flex-end" : "center";
  const h = align.endsWith("Left") ? "left" : align.endsWith("Right") ? "right" : "center";
  return {
    display: "flex",
    flexDirection: "column",
    justifyContent: v,
    textAlign: h,
  };
}

function Placeholder({ icon: Icon, label, color }: { icon: LucideIcon; label?: string; color: string }) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-0.5 overflow-hidden" style={{ color }}>
      <Icon className="size-[45%] max-h-10 max-w-10 min-h-3 min-w-3" strokeWidth={1.75} />
      {label && <span className="max-w-full truncate px-0.5 font-mono text-[9px] opacity-70">{label}</span>}
    </div>
  );
}

/** Visual for an Image/Button background, honoring well-known Rust sprites and materials. */
function imageLayer(c: CuiComponent, style: CSSProperties): ReactNode {
  const color = rgba(c.props.color as Color);
  const sprite = String(c.props.sprite ?? "").toLowerCase();
  const material = String(c.props.material ?? "").toLowerCase();
  const itemId = Number(c.props.itemId ?? 0);
  const png = String(c.props.png ?? "");

  if (material.includes("uibackgroundblur")) {
    style.backdropFilter = `blur(${material.includes("ingamemenu") ? 12 : 6}px)`;
  }
  if (itemId) return <Placeholder icon={Package} label={`#${itemId}`} color={color} />;
  if (png) return <Placeholder icon={ImageIcon} label="png" color={color} />;

  const Icon = ICON_SPRITES[sprite];
  if (Icon) return <Placeholder icon={Icon} color={color} />;

  if (sprite.includes("transparent.radial")) style.background = `radial-gradient(closest-side, ${color}, transparent)`;
  else if (sprite.includes("transparent.linearltr")) style.background = `linear-gradient(to right, ${color}, transparent)`;
  else if (sprite.includes("transparent.linear")) style.background = `linear-gradient(to top, ${color}, transparent)`;
  else if (sprite.startsWith("assets/icons/")) return <Placeholder icon={ImageIcon} color={color} />;
  else {
    style.backgroundColor = color;
    if (sprite.includes("rounded")) style.borderRadius = 6;
  }
  return null;
}

function outlineFilter(c: CuiComponent): string {
  const color = rgba(c.props.color as Color);
  const [dx, dy] = c.props.distance as [number, number];
  return [
    `drop-shadow(${dx}px 0 0 ${color})`,
    `drop-shadow(${-dx}px 0 0 ${color})`,
    `drop-shadow(0 ${-dy}px 0 ${color})`,
    `drop-shadow(0 ${dy}px 0 ${color})`,
  ].join(" ");
}

function textLayer(c: CuiComponent, countdown?: CuiComponent): ReactNode {
  let text = String(c.props.text ?? "");
  if (countdown) {
    const left = Math.max(0, Number(countdown.props.endTime) - Number(countdown.props.startTime));
    text = text.replaceAll("%TIME_LEFT%", String(Math.round(left)));
  }
  if (c.type === "UnityEngine.UI.InputField" && c.props.password) text = "•".repeat(text.length);
  const style: CSSProperties = {
    ...alignStyle(String(c.props.align)),
    ...FONT_STYLE[String(c.props.font)],
    fontSize: Number(c.props.fontSize),
    color: rgba(c.props.color as Color),
    lineHeight: 1.15,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    overflow: c.props.verticalOverflow === "Overflow" ? "visible" : "hidden",
    position: "absolute",
    inset: 0,
  };
  return (
    <div style={style}>
      <div>{renderRichText(text)}</div>
    </div>
  );
}

export const NodeView = memo(function NodeView({ node, css }: { node: CuiNode; css: CSSProperties }) {
  const style: CSSProperties = { position: "absolute", ...css };
  let content: ReactNode = null;
  const byType = (t: CuiComponent["type"]) => node.components.find((c) => c.type === t);

  const image = byType("UnityEngine.UI.Image") ?? byType("UnityEngine.UI.Button");
  const raw = byType("UnityEngine.UI.RawImage");
  const text = byType("UnityEngine.UI.Text") ?? byType("UnityEngine.UI.InputField");
  const outline = byType("UnityEngine.UI.Outline");

  if (image) content = imageLayer(image, style);
  if (raw) {
    const color = rgba(raw.props.color as Color);
    const url = String(raw.props.url ?? "");
    if (url) {
      content = (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          draggable={false}
          className="size-full object-fill"
          style={{ opacity: (raw.props.color as Color)[3] }}
        />
      );
    } else if (raw.props.steamId) content = <Placeholder icon={User} label="avatar" color={color} />;
    else if (raw.props.png) content = <Placeholder icon={ImageIcon} label="png" color={color} />;
    else style.backgroundColor = color;
  }
  if (text) content = <>{content}{textLayer(text, byType("Countdown"))}</>;
  if (outline) style.filter = outlineFilter(outline);

  return (
    <div style={style} data-node={node.id}>
      {content}
    </div>
  );
});
