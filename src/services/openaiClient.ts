import { AppError } from './errorMessages';

export type ChatCompletionsJsonArgs = {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
};

export async function chatCompletionsJson(args: ChatCompletionsJsonArgs): Promise<unknown> {
  const apiKey = args.apiKey.trim();
  if (!apiKey) {
    throw new AppError('openai/missing-key');
  }

  const model = args.model ?? 'gpt-4o-mini';
  const temperature = args.temperature ?? 0.85;
  const maxTokens = args.maxTokens ?? 1000;

  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: args.system },
          { role: 'user', content: args.user },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: args.schemaName,
            strict: true,
            schema: args.schema,
          },
        },
      }),
    });
  } catch (err) {
    throw new AppError('openai/network', err instanceof Error ? err.message : 'fetch failed');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const snippet = text.slice(0, 300);
    if (res.status === 401) throw new AppError('openai/auth-failed', snippet);
    if (res.status === 429) throw new AppError('openai/rate-limit', snippet);
    throw new AppError('openai/bad-response', `status ${res.status}: ${snippet}`);
  }

  type ChatResponse = { choices?: { message?: { content?: string } }[] };
  let body: ChatResponse;
  try {
    body = (await res.json()) as ChatResponse;
  } catch {
    throw new AppError('openai/bad-response', 'response was not valid JSON');
  }

  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.length === 0) {
    throw new AppError('openai/bad-response', 'response missing message content');
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new AppError('openai/bad-response', 'content was not valid JSON despite strict schema');
  }
}
