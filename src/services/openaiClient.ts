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
    throw new Error('OpenAI API key is required. Open Settings to add one.');
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
    throw new Error(
      `Network error reaching OpenAI: ${err instanceof Error ? err.message : 'unknown'}`,
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const snippet = text.slice(0, 300);
    if (res.status === 401) {
      throw new Error('OpenAI rejected the API key (401). Re-check it in Settings.');
    }
    throw new Error(`OpenAI request failed (${res.status})${snippet ? `: ${snippet}` : ''}`);
  }

  type ChatResponse = { choices?: { message?: { content?: string } }[] };
  let body: ChatResponse;
  try {
    body = (await res.json()) as ChatResponse;
  } catch {
    throw new Error('OpenAI response was not valid JSON.');
  }

  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.length === 0) {
    throw new Error('OpenAI response is missing message content.');
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error('OpenAI returned non-JSON content despite the JSON schema.');
  }
}
