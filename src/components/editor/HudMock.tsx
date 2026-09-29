import { Droplet, Heart, Utensils } from "lucide-react";
import type { Box } from "@/lib/cui/geometry";

/**
 * Approximate silhouette of Rust's vanilla HUD (status bars + belt),
 * so layouts can be checked for overlaps. Purely a visual aid.
 */
export function HudMock({ screen }: { screen: Box }) {
  const bars = [
    { icon: Heart, fill: 0.86, color: "#8cb33a", value: 86 },
    { icon: Droplet, fill: 0.62, color: "#4a9bd8", value: 155 },
    { icon: Utensils, fill: 0.48, color: "#d98c37", value: 240 },
  ];
  const slot = 56;
  const gap = 4;
  const beltW = slot * 6 + gap * 5;
  return (
    <div data-hud className="pointer-events-none absolute inset-0 opacity-70" style={{ fontFamily: "var(--cui-font-bold)" }}>
      <div className="absolute flex flex-col-reverse gap-[3px]" style={{ right: 16, bottom: 16, width: 184 }}>
        {bars.map(({ icon: Icon, fill, color, value }, i) => (
          <div key={i} className="relative flex h-[22px] items-center bg-black/35">
            <div className="absolute inset-y-0 left-0" style={{ width: `${fill * 100}%`, background: color, opacity: 0.8 }} />
            <Icon className="relative ml-1.5 size-3.5 text-white/90" strokeWidth={2.5} />
            <span className="relative ml-1.5 text-[13px] font-bold text-white/90">{value}</span>
          </div>
        ))}
      </div>
      <div className="absolute flex" style={{ left: screen.w / 2 - beltW / 2, bottom: 16, gap }}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="relative bg-black/30" style={{ width: slot, height: slot }}>
            <span className="absolute top-0.5 left-1 text-[10px] text-white/50">{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
