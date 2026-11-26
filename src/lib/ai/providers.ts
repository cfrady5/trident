import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { AiProvider, ProviderResult, StructuredRequest } from "./index";

/**
 * Anthropic adapter: structured output via `messages.parse` + Zod, no tools.
 * A `refusal` stop reason is returned as a failed step for human handling.
 * To add another provider, implement AiProvider and select it in ./index.ts.
 * UNTESTED against the live API in this repository (no key configured).
 */
export function anthropicProvider(apiKey: string, model: string): AiProvider {
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  return {
    name: "anthropic",
    async run<T extends z.ZodType>(req: StructuredRequest<T>, prompt: { system: string; user: string }): Promise<ProviderResult<z.infer<T>>> {
      const response = await client.messages.parse({
        model,
        max_tokens: req.maxTokens ?? 16000,
        system: prompt.system,
        messages: [{ role: "user", content: prompt.user }],
        output_config: { format: zodOutputFormat(req.schema as never) },
      });
      const usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
      if (response.stop_reason === "refusal") {
        return { output: null, model: response.model, ...usage, stopReason: "refusal", error: "Model declined the request; route to a human." };
      }
      return { output: (response.parsed_output ?? null) as z.infer<T> | null, model: response.model, ...usage, stopReason: response.stop_reason };
    },
  };
}
