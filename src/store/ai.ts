"use client";

import type { BetaContentBlockParam, BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { describeError, MODELS, runAgent, type Effort, type ModelId } from "@/lib/ai/agent";
import { storeHost } from "@/lib/ai/host";
import { useEditor } from "@/store/editor";

export const CONTEXT_TAG = "<editor_state>";

export interface ImageAttachment {
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  data: string; // base64
}

interface AiState {
  apiKey: string;
  model: ModelId;
  effort: Effort;
  messages: BetaMessageParam[];
  streaming: { text: string; thinking: string } | null;
  running: boolean;
  error: string | null;
  setSettings(patch: Partial<Pick<AiState, "apiKey" | "model" | "effort">>): void;
  send(text: string, images: ImageAttachment[]): Promise<void>;
  stop(): void;
  clear(): void;
}

let controller: AbortController | null = null;

/** Short, hidden note so the model knows what the user is looking at. */
function editorContext(): string {
  const s = useEditor.getState();
  const sel = s.selectedId ? s.project.nodes[s.selectedId]?.name : null;
  return [
    CONTEXT_TAG,
    `elements: ${Object.keys(s.project.nodes).length}, layer: ${s.project.layer}`,
    `selected: ${sel ?? "none"}`,
    `user designs at ${s.view.designHeight}p — pixel sizes the user mentions are in ${Math.round(
      s.view.designHeight * s.view.aspect,
    )}x${s.view.designHeight}; divide by ${s.view.designHeight / 720} for Rust offsets`,
    "</editor_state>",
  ].join("\n");
}

export const useAi = create<AiState>()(
  persist(
    (set, get) => ({
      apiKey: "",
      model: MODELS[0].id,
      effort: "medium",
      messages: [],
      streaming: null,
      running: false,
      error: null,

      setSettings: (patch) => set(patch),

      send: async (text, images) => {
        const { apiKey, model, effort, running } = get();
        if (running || (!text.trim() && !images.length)) return;
        const content: BetaContentBlockParam[] = [
          ...images.map(
            (img): BetaContentBlockParam => ({
              type: "image",
              source: { type: "base64", media_type: img.mediaType, data: img.data },
            }),
          ),
          { type: "text", text: text.trim() || "Recreate this design." },
          { type: "text", text: editorContext() },
        ];
        // Work on a copy; the loop only ever appends, which keeps thinking blocks valid.
        const messages: BetaMessageParam[] = [...get().messages, { role: "user", content }];
        controller = new AbortController();
        set({ messages: [...messages], running: true, error: null, streaming: null });
        try {
          await runAgent(
            messages,
            { apiKey, model, effort, host: storeHost, signal: controller.signal },
            { onUpdate: (m, streaming) => set({ messages: [...m], streaming }) },
          );
        } catch (e) {
          if (!controller?.signal.aborted) set({ error: describeError(e) });
        } finally {
          controller = null;
          set({ running: false, streaming: null });
        }
      },

      stop: () => controller?.abort(),
      clear: () => {
        controller?.abort();
        set({ messages: [], error: null, streaming: null });
      },
    }),
    {
      name: "rustcui-ai",
      // The key stays in this browser only; the conversation is not persisted.
      partialize: (s) => ({ apiKey: s.apiKey, model: s.model, effort: s.effort }),
    },
  ),
);
