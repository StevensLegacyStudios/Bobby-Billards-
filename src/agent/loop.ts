import Anthropic from "@anthropic-ai/sdk";
import { buildSystemBlocks } from "./systemPrompt.js";
import { anthropicTools, executeTool } from "./tools.js";

const MODEL = process.env.RYDESHARE_MODEL ?? "claude-opus-4-8";

export interface SendResult {
  text: string;
  toolsUsed: string[];
  cacheReadTokens: number;
}

/**
 * Manual agentic loop. Streams assistant text, executes tools, persists state
 * (handlers save themselves), feeds results back, and repeats until the model
 * stops calling tools. Tracks the active project id from tool traffic so the
 * CLI can render a deterministic gap footer.
 */
export class Agent {
  private client: Anthropic;
  private messages: Anthropic.MessageParam[] = [];
  private system = buildSystemBlocks();
  activeProjectId: string | null = null;

  constructor(client?: Anthropic) {
    this.client = client ?? new Anthropic();
  }

  private capture(input: unknown, result: unknown): void {
    const fromInput =
      input && typeof input === "object"
        ? (input as Record<string, unknown>).projectId
        : undefined;
    const fromResult =
      result && typeof result === "object"
        ? (result as Record<string, unknown>).projectId
        : undefined;
    if (typeof fromResult === "string") this.activeProjectId = fromResult;
    else if (typeof fromInput === "string") this.activeProjectId = fromInput;
  }

  async send(
    userText: string,
    onText?: (t: string) => void,
  ): Promise<SendResult> {
    this.messages.push({ role: "user", content: userText });
    const toolsUsed: string[] = [];
    let cacheReadTokens = 0;

    while (true) {
      const params = {
        model: MODEL,
        max_tokens: 8000,
        system: this.system,
        tools: anthropicTools,
        messages: this.messages,
        thinking: { type: "adaptive" },
        output_config: { effort: "high" },
      } as unknown as Anthropic.MessageCreateParamsStreaming;

      const stream = this.client.messages.stream(params);
      if (onText) stream.on("text", (t) => onText(t));
      const msg = await stream.finalMessage();
      cacheReadTokens = msg.usage.cache_read_input_tokens ?? 0;

      this.messages.push({ role: "assistant", content: msg.content });

      if (msg.stop_reason !== "tool_use") {
        const text = msg.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");
        return { text, toolsUsed, cacheReadTokens };
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of msg.content) {
        if (block.type !== "tool_use") continue;
        toolsUsed.push(block.name);
        const result = executeTool(block.name, block.input);
        this.capture(block.input, result);
        const isError =
          !!result &&
          typeof result === "object" &&
          "error" in (result as Record<string, unknown>);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
          is_error: isError,
        });
      }
      this.messages.push({ role: "user", content: toolResults });
    }
  }
}
