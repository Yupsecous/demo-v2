import { z } from 'zod';
import { chatCompletionsJson } from './openaiClient';
import { messagesJson } from './anthropicClient';
import { AppError } from './errorMessages';
import { translateDirection } from './translator';
import { buildImagePrompt } from './imagePromptBuilder';
import type {
  ApiKeys,
  Brief,
  CopyVariant,
  ImagePromptMods,
  ImageVariant,
  Provider,
  ScriptVariant,
  VoiceMods,
} from '../types';

export type ValidateResult = { provider: Provider; ok: boolean; status: number | null; error?: string };

export interface LlmService {
  validateKey(provider: Provider, key: string): Promise<ValidateResult>;
  validateAll(keys: ApiKeys): Promise<Record<Provider, ValidateResult>>;
  generateCopy(args: GenerateCopyArgs): Promise<CopyVariant[]>;
  generateImages(args: GenerateImagesArgs): Promise<ImageVariant[]>;
  generateScript(args: GenerateScriptArgs): Promise<ScriptVariant[]>;
}

export type GenerateScriptArgs = {
  brief: Brief;
  approvedCopy: CopyVariant;
  approvedImage: ImageVariant;
  previousVariants?: ScriptVariant[];
  refineDirection?: string;
  count?: number;
  apiKey: string;
};

export type GenerateCopyArgs = {
  // OpenAI is always required (translator). Anthropic is optional —
  // when present the actual copy generation step routes through Claude
  // Sonnet for higher-quality variants; without it, falls back to 4o-mini.
  apiKeys: { openai: string; anthropic?: string };
  brief: Brief;
  previousVariants?: CopyVariant[];
  refineDirection?: string;
  count?: number;
};

export type GenerateImagesArgs = {
  brief: Brief;
  approvedCopy: CopyVariant;
  previousVariants?: ImageVariant[];
  refineDirection?: string;
  count?: number;
  apiKeys: { openai: string; fal: string };
};

type ValidationConfig = {
  url: string;
  init: (key: string) => RequestInit;
  // Returns true if the auth layer accepted the key. Per-provider because
  // some endpoints return non-2xx even for valid keys (fal.ai's generate
  // endpoint returns 422 for a body-less POST when the key authenticated).
  isAuthOk: (status: number) => boolean;
};

const ENDPOINTS: Record<Provider, ValidationConfig> = {
  openai: {
    url: 'https://api.openai.com/v1/models',
    init: (key) => ({
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
    }),
    isAuthOk: (s) => s >= 200 && s < 300,
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/models',
    init: (key) => ({
      method: 'GET',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    }),
    isAuthOk: (s) => s >= 200 && s < 300,
  },
  eleven: {
    url: 'https://api.elevenlabs.io/v1/user',
    init: (key) => ({
      method: 'GET',
      headers: { 'xi-api-key': key },
    }),
    isAuthOk: (s) => s >= 200 && s < 300,
  },
  fal: {
    // POST with an empty body to the actual generation endpoint. fal.ai's
    // legacy /applications endpoint returns 401 even for valid keys, so
    // we hit the path the demo actually uses. The empty body produces a
    // 422 schema-validation error — never generates an image, costs $0.
    // 401/403 alone means the key itself was rejected at the auth layer.
    url: 'https://fal.run/fal-ai/flux/schnell',
    init: (key) => ({
      method: 'POST',
      headers: {
        Authorization: `Key ${key}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    }),
    isAuthOk: (s) => s !== 401 && s !== 403,
  },
};

async function validateKey(provider: Provider, key: string): Promise<ValidateResult> {
  const trimmed = key.trim();
  if (!trimmed) {
    return { provider, ok: false, status: null, error: 'empty' };
  }
  const cfg = ENDPOINTS[provider];
  try {
    const res = await fetch(cfg.url, cfg.init(trimmed));
    return { provider, ok: cfg.isAuthOk(res.status), status: res.status };
  } catch (err) {
    return {
      provider,
      ok: false,
      status: null,
      error: err instanceof Error ? err.message : 'network',
    };
  }
}

async function validateAll(keys: ApiKeys): Promise<Record<Provider, ValidateResult>> {
  const providers: Provider[] = ['fal', 'eleven', 'openai', 'anthropic'];
  const results = await Promise.all(providers.map((p) => validateKey(p, keys[p])));
  return {
    fal: results[0]!,
    eleven: results[1]!,
    openai: results[2]!,
    anthropic: results[3]!,
  };
}

const COPY_SYSTEM_PROMPT = `You are a senior performance copywriter. You write ad copy that converts. Punchy, direct, specific. No corporate buzzwords. No hedging. No "unlock," "elevate," "leverage," "synergy," "revolutionary," or "game-changing." Lead with the specific outcome, not the abstract benefit.`;

const COPY_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    variants: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          caption: { type: 'string' },
          cta: { type: 'string' },
        },
        required: ['headline', 'caption', 'cta'],
        additionalProperties: false,
      },
    },
  },
  required: ['variants'],
  additionalProperties: false,
} as const;

const CopyResponseZ = z.object({
  variants: z.array(
    z.object({
      headline: z.string(),
      caption: z.string(),
      cta: z.string(),
    }),
  ),
});

function formatBriefBlock(brief: Brief): string {
  return [
    `Product: ${brief.productName}`,
    `Target audience: ${brief.targetAudience}`,
    `Ad angle: ${brief.adAngle}`,
  ].join('\n');
}

function formatPreviousVariants(variants: CopyVariant[]): string {
  return variants
    .map(
      (v, i) =>
        `${i + 1}. Headline: "${v.headline}"\n   Caption: "${v.caption}"\n   CTA: "${v.cta}"`,
    )
    .join('\n\n');
}

function buildCopyUserMessage(args: {
  brief: Brief;
  previousVariants?: CopyVariant[];
  refineDirection?: string;
  emphasize?: string[];
  count: number;
}): string {
  const briefBlock = formatBriefBlock(args.brief);
  const direction = args.refineDirection?.trim();
  const previous = args.previousVariants ?? [];

  if (direction) {
    const parts = [
      briefBlock,
      '',
      'Previous variants you generated:',
      formatPreviousVariants(previous),
      '',
      `The creative director's direction (enriched): "${direction}"`,
    ];
    if (args.emphasize && args.emphasize.length > 0) {
      parts.push(`Lean into these qualities: ${args.emphasize.join('; ')}.`);
    }
    parts.push(
      '',
      `Generate ${args.count} NEW variants that apply this direction. Don't tweak the previous ones — write fresh copy that takes the direction seriously. Same format: headline (6-10 words), caption (2-3 sentences), cta (3-5 words).`,
    );
    return parts.join('\n');
  }

  if (previous.length > 0) {
    return [
      briefBlock,
      '',
      'Previous variants you generated:',
      formatPreviousVariants(previous),
      '',
      `Generate ${args.count} additional variants that explore DIFFERENT angles from the ones above. Distinctly different hooks and registers. Same format: headline (6-10 words), caption (2-3 sentences), cta (3-5 words).`,
    ].join('\n');
  }

  return [
    briefBlock,
    '',
    `Generate ${args.count} distinct variants of ad copy. Each variant must take a genuinely different angle on the brief — different hook, different emotional register, different structure. Not paraphrases.`,
    '',
    'Each variant returns:',
    '- headline: 6-10 words',
    '- caption: 2-3 sentences, Meta/Instagram register (conversational, hook in the first 5 words)',
    '- cta: 3-5 words, action-led',
  ].join('\n');
}

async function generateCopy(args: GenerateCopyArgs): Promise<CopyVariant[]> {
  const apiKey = args.apiKeys.openai.trim();
  const anthropicKey = args.apiKeys.anthropic?.trim() ?? '';
  if (!apiKey) {
    throw new AppError('openai/missing-key');
  }
  const count = args.count ?? 2;
  const rawDirection = args.refineDirection?.trim();

  let enriched: string | undefined;
  let emphasize: string[] | undefined;
  let avoid: string[] | undefined;

  if (rawDirection) {
    const result = await translateDirection({
      direction: rawDirection,
      assetType: 'copy',
      apiKey,
    });
    if (result.kind !== 'copy') {
      throw new AppError('translator/wrong-shape', 'expected copy mods');
    }
    enriched = result.mods.enrichedDirection;
    emphasize = result.mods.emphasize;
    avoid = result.mods.avoid;
  }

  const systemPrompt =
    avoid && avoid.length > 0
      ? `${COPY_SYSTEM_PROMPT}\n\nAdditional banned terms for this generation: ${avoid.join(', ')}.`
      : COPY_SYSTEM_PROMPT;

  const userMessage = buildCopyUserMessage({
    brief: args.brief,
    previousVariants: args.previousVariants,
    refineDirection: enriched ?? rawDirection,
    emphasize,
    count,
  });

  // Route through Claude Sonnet when an Anthropic key is configured —
  // creative ad copy is the one place where the quality lift justifies
  // the model swap. Translator and prompt builder stay on 4o-mini.
  const raw = anthropicKey
    ? await messagesJson({
        apiKey: anthropicKey,
        systemPrompt,
        userMessage,
        toolName: 'submit_copy_variants',
        toolDescription:
          'Submit the generated copy variants as a structured array. Each variant has a headline (6-10 words), a caption (2-3 sentences in Meta/Instagram register), and a CTA (3-5 words).',
        inputSchema: COPY_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
        maxTokens: 1500,
      })
    : await chatCompletionsJson({
        apiKey,
        system: systemPrompt,
        user: userMessage,
        schemaName: 'copy_variants',
        schema: COPY_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
        temperature: 0.85,
        maxTokens: 1000,
      });

  const result = CopyResponseZ.safeParse(raw);
  if (!result.success) {
    throw new AppError(
      anthropicKey ? 'anthropic/bad-response' : 'openai/bad-response',
      `copy schema mismatch: ${result.error.message}`,
    );
  }

  const now = Date.now();
  return result.data.variants.map<CopyVariant>((v) => ({
    kind: 'copy',
    id: crypto.randomUUID(),
    headline: v.headline.trim(),
    caption: v.caption.trim(),
    cta: v.cta.trim(),
    createdAt: now,
  }));
}

const FalImageZ = z.object({
  images: z
    .array(
      z.object({
        url: z.string(),
      }),
    )
    .min(1),
});

async function generateFluxImage(args: { prompt: string; falKey: string }): Promise<string> {
  const apiKey = args.falKey.trim();
  if (!apiKey) {
    throw new AppError('fal/missing-key');
  }

  let res: Response;
  try {
    res = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: args.prompt,
        image_size: { width: 768, height: 960 },
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: true,
      }),
    });
  } catch (err) {
    throw new AppError('fal/network', err instanceof Error ? err.message : 'fetch failed');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401) throw new AppError('fal/auth-failed', text.slice(0, 200));
    if (res.status === 402) throw new AppError('fal/no-credits', text.slice(0, 200));
    if (res.status === 403) throw new AppError('fal/forbidden', text.slice(0, 200));
    if (res.status === 429) throw new AppError('fal/rate-limit', text.slice(0, 200));
    throw new AppError('fal/bad-response', `status ${res.status}: ${text.slice(0, 200)}`);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new AppError('fal/bad-response', 'response was not valid JSON');
  }

  const parsed = FalImageZ.safeParse(body);
  if (!parsed.success) {
    throw new AppError('fal/bad-response', `image schema mismatch: ${parsed.error.message}`);
  }
  return parsed.data.images[0]!.url;
}

async function generateImages(args: GenerateImagesArgs): Promise<ImageVariant[]> {
  const openai = args.apiKeys.openai.trim();
  const fal = args.apiKeys.fal.trim();
  if (!openai) throw new AppError('openai/missing-key');
  if (!fal) throw new AppError('fal/missing-key');

  const count = args.count ?? 2;
  const rawDirection = args.refineDirection?.trim();

  let mods: ImagePromptMods | undefined;
  if (rawDirection) {
    const result = await translateDirection({
      direction: rawDirection,
      assetType: 'image',
      apiKey: openai,
    });
    if (result.kind !== 'image') {
      throw new AppError('translator/wrong-shape', 'expected image mods');
    }
    mods = result.mods;
  }

  const tasks = Array.from({ length: count }).map(async (): Promise<ImageVariant> => {
    const prompt = await buildImagePrompt({
      brief: args.brief,
      approvedCopy: args.approvedCopy,
      mods,
      apiKey: openai,
    });
    const imageUrl = await generateFluxImage({ prompt, falKey: fal });
    const variant: ImageVariant = {
      kind: 'image',
      id: crypto.randomUUID(),
      imageUrl,
      prompt,
      createdAt: Date.now(),
    };
    if (mods) variant.modsApplied = mods;
    return variant;
  });

  const settled = await Promise.allSettled(tasks);
  const successes: ImageVariant[] = [];
  const failures: unknown[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') {
      successes.push(r.value);
    } else {
      failures.push(r.reason);
    }
  }

  if (successes.length === 0) {
    // If every failure has the same AppError code, re-throw THAT directly
    // so the UI shows a specific cause (e.g. "out of credits") instead of
    // the generic "all attempts failed". Otherwise fall back to aggregate.
    const codes = new Set(
      failures
        .map((f) => (f instanceof AppError ? f.code : null))
        .filter((c) => c !== null),
    );
    if (codes.size === 1 && failures[0] instanceof AppError) {
      throw failures[0];
    }
    const summary = failures
      .map((f) => {
        if (f instanceof AppError) return `${f.code}${f.detail ? ': ' + f.detail : ''}`;
        if (f instanceof Error) return f.message;
        return String(f);
      })
      .join(' | ');
    throw new AppError('image/all-failed', summary);
  }
  if (failures.length > 0) {
    // partial success — surface to the console so the user can see what fell through
    // eslint-disable-next-line no-console
    console.warn('[generateImages] partial failure:', failures);
  }
  return successes;
}

const SCRIPT_SYSTEM_PROMPT = `You write voiceover scripts for short ad reads. 20–40 seconds each, 50–100 words. Designed for spoken delivery, not silent reading. Punchy openers. Short clauses. Natural breath points. No buzzwords ("revolutionary", "game-changing", "unlock"). No corporate hedging ("perhaps", "consider", "explore").

Each variant lands on the same emotional beat as the approved copy and image — same promise, same urgency, same audience. The variants in one batch should differ in tonal register (e.g. confident-direct vs warm-conversational), not in the underlying claim.

Examples:

Brief: { product: "Strata Coffee", audience: "early-shift workers, 25-40", angle: "The first sip is the start of the win" }
Approved copy: { headline: "Win the morning before it starts.", caption: "Strata is built for the first hour, not the third. Two sips. You're on.", cta: "Get the edge." }
Image: focused woman in worn workout gear, gripping a matte-black tumbler of Strata Coffee, jaw set, eyes locked on the camera, hard side light, saturated red brand accent against a near-black gym backdrop, low angle.
Output:
{
  "variants": [
    {
      "script": "Five-thirty AM. You're awake before the rest. Strata is built for the first hour. Not the third. Two sips, and you're on. Not jittery. Not crashed. Locked in. Win the morning before it starts.",
      "durationEstimate": 18,
      "toneDescription": "Confident, clipped, military cadence"
    },
    {
      "script": "Some mornings the day's already loud before you've opened your eyes. You don't need a wake-up call. You need a partner. Strata is built for the first hour. Two sips, and the noise quiets down. You start. You move. You're on.",
      "durationEstimate": 22,
      "toneDescription": "Warm, conversational, empathetic opener"
    }
  ]
}

Brief: { product: "StillMind", audience: "anxious knowledge workers, 28-45", angle: "Five minutes is enough" }
Approved copy: { headline: "Five minutes is enough.", caption: "Open StillMind on the walk between meetings. The session ends before your next one starts.", cta: "Try a five-minute reset." }
Image: a person in a sun-faded linen shirt sitting cross-legged on a wooden bench in a park, phone with the StillMind app at chest height, soft overcast daylight, muted sage and warm taupe.
Output:
{
  "variants": [
    {
      "script": "Five minutes. Between the meeting you just left and the one you're walking into. Open StillMind. Put one foot in front of the other. By the time you sit back down, your shoulders are lower. Your jaw's unclenched. Five minutes is enough.",
      "durationEstimate": 22,
      "toneDescription": "Calm, grounded, second-person walkthrough"
    },
    {
      "script": "You don't need an hour. You don't need a cushion. You don't need silence. You need five minutes and a sidewalk. StillMind meets you on the walk, ends before your next meeting starts, and gives you back a little of the morning. Try the five-minute reset.",
      "durationEstimate": 23,
      "toneDescription": "Direct, list-rhythm, declarative confidence"
    }
  ]
}

Brief: { product: "Carb-Hub Bars", audience: "amateur athletes, 20-35", angle: "Fuel that doesn't sit in your stomach" }
Approved copy: { headline: "Eat fast. Move faster.", caption: "Carb-Hub clears your gut in twenty minutes so it can fuel the next forty. Light in, light out.", cta: "Open and go." }
Image: a young athlete mid-motion tearing open a foil pack, body leaning forward, mid-laugh, high-key soft fill, saturated turquoise and lemon-yellow on white seamless backdrop.
Output:
{
  "variants": [
    {
      "script": "You don't have forty minutes for breakfast. You have twenty for a warm-up and forty for the work. Carb-Hub clears your gut in twenty so it can fuel the next forty. Light in. Light out. Eat fast. Move faster.",
      "durationEstimate": 19,
      "toneDescription": "Punchy, two-beat rhythm, athletic"
    },
    {
      "script": "Big meals before training fight you the whole way. Carb-Hub doesn't. Twenty minutes in, your gut is clear. Forty minutes after that, you're still going on what it sent down. Open the pack. Get to the line. Move.",
      "durationEstimate": 21,
      "toneDescription": "Educational, anatomical, plain-spoken"
    }
  ]
}

Now produce the same kind of output for the brief, copy, image, and (optional) direction in the user message.`;

const SCRIPT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    variants: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          script: { type: 'string' },
          durationEstimate: { type: 'number' },
          toneDescription: { type: 'string' },
        },
        required: ['script', 'durationEstimate', 'toneDescription'],
        additionalProperties: false,
      },
    },
  },
  required: ['variants'],
  additionalProperties: false,
} as const;

const ScriptResponseZ = z.object({
  variants: z.array(
    z.object({
      script: z.string(),
      durationEstimate: z.number(),
      toneDescription: z.string(),
    }),
  ),
});

function formatScriptBriefBlock(args: {
  brief: Brief;
  approvedCopy: CopyVariant;
  approvedImage: ImageVariant;
}): string {
  return [
    `Brief: { product: "${args.brief.productName}", audience: "${args.brief.targetAudience}", angle: "${args.brief.adAngle}" }`,
    `Approved copy: { headline: "${args.approvedCopy.headline}", caption: "${args.approvedCopy.caption}", cta: "${args.approvedCopy.cta}" }`,
    `Image: ${args.approvedImage.prompt}`,
  ].join('\n');
}

function formatPreviousScripts(variants: ScriptVariant[]): string {
  return variants
    .map(
      (v, i) =>
        `${i + 1}. Tone: ${v.toneDescription}\n   Script: "${v.script}"`,
    )
    .join('\n\n');
}

function buildScriptUserMessage(args: {
  brief: Brief;
  approvedCopy: CopyVariant;
  approvedImage: ImageVariant;
  previousVariants?: ScriptVariant[];
  enrichedDirection?: string;
  count: number;
}): string {
  const briefBlock = formatScriptBriefBlock(args);
  const previous = args.previousVariants ?? [];
  const direction = args.enrichedDirection?.trim();

  if (direction) {
    return [
      briefBlock,
      '',
      'Previous scripts you generated:',
      formatPreviousScripts(previous),
      '',
      `The creative director's direction (enriched): "${direction}"`,
      '',
      `Generate ${args.count} NEW script variants that apply this direction. Don't tweak the previous ones — write fresh scripts that take the direction seriously. Two variants should differ in tonal register, not in the underlying claim. Same format.`,
    ].join('\n');
  }

  if (previous.length > 0) {
    return [
      briefBlock,
      '',
      'Previous scripts you generated:',
      formatPreviousScripts(previous),
      '',
      `Generate ${args.count} additional script variants that explore DIFFERENT tonal registers from the ones above. Same claim and emotional beat, distinctly different voices.`,
    ].join('\n');
  }

  return [
    briefBlock,
    '',
    `Generate ${args.count} distinct script variants. Each should be 50–100 words, designed for spoken delivery, landing on the same emotional beat as the copy and image. The two variants must differ in tonal register (e.g. confident-direct vs warm-conversational).`,
  ].join('\n');
}

async function generateScript(args: GenerateScriptArgs): Promise<ScriptVariant[]> {
  const apiKey = args.apiKey.trim();
  if (!apiKey) throw new AppError('openai/missing-key');
  const count = args.count ?? 2;
  const rawDirection = args.refineDirection?.trim();

  let mods: VoiceMods | undefined;
  let enrichedDirection: string | undefined;
  if (rawDirection) {
    const result = await translateDirection({
      direction: rawDirection,
      assetType: 'voice',
      apiKey,
    });
    if (result.kind !== 'voice') {
      throw new AppError('translator/wrong-shape', 'expected voice mods');
    }
    mods = result.mods;
    enrichedDirection = result.mods.scriptTone;
  }

  const userMessage = buildScriptUserMessage({
    brief: args.brief,
    approvedCopy: args.approvedCopy,
    approvedImage: args.approvedImage,
    previousVariants: args.previousVariants,
    enrichedDirection,
    count,
  });

  const raw = await chatCompletionsJson({
    apiKey,
    system: SCRIPT_SYSTEM_PROMPT,
    user: userMessage,
    schemaName: 'script_variants',
    schema: SCRIPT_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
    temperature: 0.85,
    maxTokens: 1200,
  });

  const result = ScriptResponseZ.safeParse(raw);
  if (!result.success) {
    throw new AppError('openai/bad-response', `script schema mismatch: ${result.error.message}`);
  }

  const now = Date.now();
  return result.data.variants.map<ScriptVariant>((v) => {
    const variant: ScriptVariant = {
      kind: 'script',
      id: crypto.randomUUID(),
      script: v.script.trim(),
      durationEstimate: Math.round(v.durationEstimate),
      toneDescription: v.toneDescription.trim(),
      createdAt: now,
    };
    if (mods) variant.modsApplied = mods;
    return variant;
  });
}

export const llmService: LlmService = {
  validateKey,
  validateAll,
  generateCopy,
  generateImages,
  generateScript,
};
