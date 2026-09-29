import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlock,
  BetaMessageParam,
  BetaTool,
  BetaToolResultBlockParam,
  BetaToolUseBlock,
  BetaMessageStreamParams,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { AI_INSTRUCTIONS, runTool, TOOL_DEFS, type EditorHost } from "./executor";

export const MODELS = [
  { id: "claude-opus-5-5", label: "Opus 5.5", thinking: true, fallbacks: true },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", thinking: true, fallbacks: true },
  { id: "claude-haiku-4-5", label: "Haiku 4.5", thinking: false, fallbacks: false },
] as const;
export type ModelId = (typeof MODELS)[number]["id"];
export type Effort = "low" | "medium" | "high" | "xhigh";

const SYSTEM = `${AI_INSTRUCTIONS}

You are embedded in the editor's side panel and talk to the user directly. Reply in the user's language. Be brief: say what you changed in one or two sentences, don't paste the JSON back unless asked. When the user attaches an image, treat it as a design mockup (usually a 1920x1080 screenshot) and recreate it with CUI elements, converting pixel sizes to the 1280x720 reference space.`;

const TOOLS: BetaTool[] = TOOL_DEFS.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: t.input_schema as BetaTool["input_schema"],
  // Large add_elements payloads stream in as they are generated.
  eager_input_streaming: true,
}));

export interface AgentCallbacks {
  /** Called whenever the transcript or the in-flight text changes. */
  onUpdate(messages: BetaMessageParam[], streaming: { text: string; thinking: string } | null): void;
  onToolRun?(name: string, ok: boolean): void;
}

export interface AgentOptions {
  apiKey: string;
  model: ModelId;
  effort: Effort;
  host: EditorHost;
  signal: AbortSignal;
}

const MAX_STEPS = 40;

/**
 * Manual streaming tool-use loop. Mutates and reports `messages` (append-only, so
 * thinking blocks stay valid across turns) until the model stops calling tools.
 */
export async function runAgent(messages: BetaMessageParam[], opts: AgentOptions, cb: AgentCallbacks): Promise<void> {
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true });
  const model = MODELS.find((m) => m.id === opts.model) ?? MODELS[0];
  let jsonRetries = 0;

  for (let step = 0; step < MAX_STEPS; step++) {
    const params: BetaMessageStreamParams = {
      model: model.id,
      max_tokens: 32000,
      system: SYSTEM,
      tools: TOOLS,
      messages,
      // Tools + system prompt are a stable prefix; cache it across the loop.
      cache_control: { type: "ephemeral" },
    };
    if (model.thinking) {
      params.thinking = { type: "adaptive", display: "summarized" };
      params.output_config = { effort: opts.effort };
    }
    if (model.fallbacks) {
      // If a safety classifier declines, the API retries on a suitable model in the same call.
      params.betas = ["server-side-fallback-2026-07-01"];
      params.fallbacks = "default";
    }

    const stream = client.beta.messages.stream(params, { signal: opts.signal });
    let text = "";
    let thinking = "";
    stream.on("streamEvent", (event) => {
      if (event.type !== "content_block_delta") return;
      if (event.delta.type === "text_delta") text += event.delta.text;
      else if (event.delta.type === "thinking_delta") thinking += event.delta.thinking;
      else return;
      cb.onUpdate(messages, { text, thinking });
    });

    let message;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      // With eager input streaming an unparseable tool input rejects here; re-issue the turn.
      if (err instanceof Anthropic.APIError || opts.signal.aborted || jsonRetries++ >= 2) throw err;
      continue;
    }

    messages.push({ role: "assistant", content: message.content });
    cb.onUpdate(messages, null);

    const toolUses = message.content.filter((b: BetaContentBlock): b is BetaToolUseBlock => b.type === "tool_use");
    // Never run tools from a cut-off turn, but answer them so the history stays valid for the next request.
    const abandon = (reason: string) => {
      if (toolUses.length) {
        messages.push({
          role: "user",
          content: toolUses.map((tu) => ({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: reason })),
        });
        cb.onUpdate(messages, null);
      }
      throw new Error(reason);
    };

    if (message.stop_reason === "refusal") abandon("The request was declined by the model's safety filters.");
    if (message.stop_reason === "pause_turn") continue;
    if (toolUses.length === 0) return;
    if (message.stop_reason === "max_tokens") {
      abandon("The response hit the token limit while writing a tool call. Ask for a smaller change.");
    }

    const results: BetaToolResultBlockParam[] = toolUses.map((tu) => {
      try {
        const content = runTool(opts.host, tu.name, tu.input);
        cb.onToolRun?.(tu.name, true);
        return { type: "tool_result", tool_use_id: tu.id, content };
      } catch (e) {
        cb.onToolRun?.(tu.name, false);
        return { type: "tool_result", tool_use_id: tu.id, is_error: true, content: (e as Error).message };
      }
    });
    messages.push({ role: "user", content: results });
    cb.onUpdate(messages, null);
  }
  throw new Error(`Stopped after ${MAX_STEPS} steps.`);
}

export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "Invalid API key.";
  if (err instanceof Anthropic.PermissionDeniedError) return "This API key has no access to the selected model.";
  if (err instanceof Anthropic.RateLimitError) return "Rate limited — wait a moment and try again.";
  if (err instanceof Anthropic.APIConnectionError) return "Network error — check your connection.";
  if (err instanceof Anthropic.APIError) return `API error ${err.status ?? ""}: ${err.message}`;
  return (err as Error)?.message ?? String(err);
}
