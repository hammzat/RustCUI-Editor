import { useMemo, type ReactNode } from "react";

const RULES: Record<"json" | "csharp", [RegExp, string][]> = {
  json: [
    [/"(?:[^"\\]|\\.)*"(?=\s*:)/y, "text-sky"],
    [/"(?:[^"\\]|\\.)*"/y, "text-[#c3e88d]"],
    [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y, "text-amber"],
    [/\b(?:true|false|null)\b/y, "text-rust-hi"],
  ],
  csharp: [
    [/\/\/.*$/my, "text-faint italic"],
    [/"(?:[^"\\]|\\.)*"/y, "text-[#c3e88d]"],
    [/\[[A-Z]\w*(?=\()/y, "text-amber"],
    [
      /\b(?:using|namespace|public|private|class|void|var|new|return|if|foreach|in|string|true|false|null)\b/y,
      "text-rust-hi",
    ],
    [/\b(?:Cui\w+|BasePlayer|RustPlugin|TextAnchor|VerticalWrapMode|ConsoleSystem|UnityEngine)\b/y, "text-sky"],
    [/-?\d+(?:\.\d+)?(?:f|UL)?\b/y, "text-amber"],
  ],
};

function highlight(code: string, lang: "json" | "csharp"): ReactNode[] {
  const out: ReactNode[] = [];
  const rules = RULES[lang];
  let i = 0;
  let plain = "";
  let key = 0;
  while (i < code.length) {
    let matched = false;
    for (const [re, cls] of rules) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (m && m[0].length) {
        if (plain) {
          out.push(plain);
          plain = "";
        }
        out.push(
          <span key={key++} className={cls}>
            {m[0]}
          </span>,
        );
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Skip whole identifiers so keywords don't match inside names.
      const w = /[A-Za-z_]\w*/y;
      w.lastIndex = i;
      const m = w.exec(code);
      const chunk = m ? m[0] : code[i];
      plain += chunk;
      i += chunk.length;
    }
  }
  if (plain) out.push(plain);
  return out;
}

export function CodeBlock({ code, lang }: { code: string; lang: "json" | "csharp" }) {
  const nodes = useMemo(() => (code.length < 200_000 ? highlight(code, lang) : [code]), [code, lang]);
  return (
    <pre className="h-full overflow-auto bg-black/35 p-4 font-mono text-[11.5px] leading-relaxed text-fg/85 select-text">
      <code>{nodes}</code>
    </pre>
  );
}
