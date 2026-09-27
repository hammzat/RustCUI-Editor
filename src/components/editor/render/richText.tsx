import type { CSSProperties, ReactNode } from "react";

/**
 * Renders Unity rich text (the subset Rust supports): <b>, <i>, <color=…>, <size=…>.
 * Unknown tags are kept as literal text, like Unity does.
 */
export function renderRichText(text: string): ReactNode[] {
  const re = /<(\/?)(b|i|color|size)(?:=([^>]*))?>/gi;
  type Frame = { tag: string; style: CSSProperties; children: ReactNode[] };
  const root: Frame = { tag: "", style: {}, children: [] };
  const stack: Frame[] = [root];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;

  const top = () => stack[stack.length - 1];
  const pushText = (s: string) => s && top().children.push(s);

  while ((m = re.exec(text))) {
    pushText(text.slice(last, m.index));
    last = re.lastIndex;
    const [, closing, rawTag, rawValue] = m;
    const tag = rawTag.toLowerCase();
    if (closing) {
      const idx = stack.findLastIndex((f) => f.tag === tag);
      if (idx <= 0) {
        pushText(m[0]);
        continue;
      }
      while (stack.length > idx) {
        const frame = stack.pop()!;
        top().children.push(
          <span key={key++} style={frame.style}>
            {frame.children}
          </span>,
        );
      }
      continue;
    }
    const value = rawValue?.replace(/^["']|["']$/g, "");
    const style: CSSProperties =
      tag === "b"
        ? { fontWeight: 700 }
        : tag === "i"
          ? { fontStyle: "italic" }
          : tag === "color"
            ? { color: value }
            : { fontSize: Number(value) || undefined };
    stack.push({ tag, style, children: [] });
  }
  pushText(text.slice(last));
  // Unclosed tags still apply until the end, as in Unity.
  while (stack.length > 1) {
    const frame = stack.pop()!;
    top().children.push(
      <span key={key++} style={frame.style}>
        {frame.children}
      </span>,
    );
  }
  return root.children;
}
