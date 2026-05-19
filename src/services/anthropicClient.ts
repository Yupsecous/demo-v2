// Anthropic Messages API client, mirroring openaiClient.ts. Uses tool-use
// to coerce structured JSON output: define one tool whose input_schema is
// the desired shape, then set tool_choice to that tool. The response's
// tool_use content block's `input` field is the parsed object.
//
// Returns unknown so the caller can do its own Zod parse, matching the
// OpenAI client's contract.

import { AppError } from './errorMessages';

export type MessagesJsonArgs = {
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
  toolName: string;
  toolDescription: string;
  inputSchema: Record<string, unknown>;
  model?: string;
  maxTokens?: number;
};

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: string };

type AnthropicMessageResponse = {
  content?: ContentBlock[];
  stop_reason?: string;
};

export async function messagesJson(args: MessagesJsonArgs): Promise<unknown> {
  const apiKey = args.apiKey.trim();
  if (!apiKey) {
    throw new AppError('anthropic/missing-key');
  }

  const model = args.model ?? 'claude-sonnet-4-6';
  const maxTokens = args.maxTokens ?? 2000;

  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: args.systemPrompt,
        tools: [
          {
            name: args.toolName,
            description: args.toolDescription,
            input_schema: args.inputSchema,
          },
        ],
        tool_choice: { type: 'tool', name: args.toolName },
        messages: [{ role: 'user', content: args.userMessage }],
      }),
    });
  } catch (err) {
    throw new AppError('anthropic/network', err instanceof Error ? err.message : 'fetch failed');
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new AppError('anthropic/auth-failed', `status ${res.status}`);
    }
    if (res.status === 429) {
      throw new AppError('anthropic/rate-limit');
    }
    const text = await res.text().catch(() => '');
    throw new AppError('anthropic/bad-response', `status ${res.status}: ${text.slice(0, 200)}`);
  }

  let body: AnthropicMessageResponse;
  try {
    body = (await res.json()) as AnthropicMessageResponse;
  } catch {
    throw new AppError('anthropic/bad-response', 'response was not valid JSON');
  }

  const toolUse = body.content?.find(
    (c): c is { type: 'tool_use'; id: string; name: string; input: unknown } =>
      c.type === 'tool_use',
  );
  if (!toolUse) {
    throw new AppError('anthropic/bad-response', 'response did not include a tool_use block');
  }
  return toolUse.input;
}
