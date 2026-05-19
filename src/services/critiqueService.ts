import { AppError } from './errorMessages';
import type { Brief, CopyVariant, ImageVariant } from '../types';

export type CritiqueImageArgs = {
  variant: ImageVariant;
  approvedCopy: CopyVariant;
  brief: Brief;
  apiKey: string;
};

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

const CRITIQUE_SYSTEM_PROMPT = `You are a senior creative director reviewing an ad image. You give balanced, direct, peer-level feedback to a fellow creative — not error reports, not generic notes.

Your structure: open with one sentence on what's working and why. Then one or two sentences on what's losing momentum and why. End with one concrete, actionable alternative.

Voice: declarative, specific, no hedging. Forbidden words: "might consider", "perhaps", "feel free to", "could potentially", "you may want to", "it would be nice if".

Return only the critique prose. No headers, no labels, no markdown, no bullets.

Examples of the voice and structure (do not copy phrasing, copy the shape):

[For a hero shot of a SaaS dashboard with a generic gradient and a smiling man at his desk]
"The dashboard placement is strong — it draws the eye to the product first and lets the human anchor the trust. The lighting reads stock-photo though, soft and even across the frame, which kills the urgency the headline is selling. Try a single warm key light from the right and let the background fall into shadow; same composition, much more weight."

[For a lifestyle shot of someone using a meditation app at sunrise]
"The opening promise is calm done right — pastel tones and soft focus deliver on the headline's invitation. The composition stalls though, the subject is centered and static when the angle could be working harder for you. Shift the camera low and slightly behind, looking past the user toward the rising light; the geometry will do half the emotional work the lighting is doing alone."

[For an aggressive sports-drink ad with an athlete mid-effort]
"The intensity lands — the low angle and saturated reds put the viewer in the moment with the athlete instead of watching from the sidelines. The background gets noisy though, those secondary highlights pull focus away from the bottle and dilute the brand read. Simplify behind the subject to near-black with a single rim light on the product silhouette; the energy stays, the focus tightens."

[For a playful kids' snack ad with bright colors and motion]
"The kinetic feel is right — mid-motion bodies and high-key fills sell the joy the copy is promising. The composition is too symmetrical for that energy though, the centering makes it feel posed rather than caught. Break the frame: push the subject to the lower-third, tilt the horizon ten degrees, leave the bag mid-toss; chaos earns its place when the copy is asking for play."

Return only the critique prose for the image in the user message.`;

function buildUserMessage(args: CritiqueImageArgs): string {
  return [
    `Brand and product: ${args.brief.productName}`,
    `Audience: ${args.brief.targetAudience}`,
    `Ad angle: ${args.brief.adAngle}`,
    '',
    'Approved copy on this asset:',
    `Headline: "${args.approvedCopy.headline}"`,
    `Caption: "${args.approvedCopy.caption}"`,
    `CTA: "${args.approvedCopy.cta}"`,
    '',
    'Critique this image.',
  ].join('\n');
}

type AnthropicMessage = {
  content?: { type: string; text?: string }[];
};

export async function critiqueImage(args: CritiqueImageArgs): Promise<string> {
  const apiKey = args.apiKey.trim();
  if (!apiKey) {
    throw new AppError('anthropic/missing-key');
  }

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
        model: ANTHROPIC_MODEL,
        max_tokens: 600,
        system: CRITIQUE_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'url', url: args.variant.imageUrl } },
              { type: 'text', text: buildUserMessage(args) },
            ],
          },
        ],
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

  let body: AnthropicMessage;
  try {
    body = (await res.json()) as AnthropicMessage;
  } catch {
    throw new AppError('anthropic/bad-response', 'response was not valid JSON');
  }

  const textBlock = body.content?.find((c) => c.type === 'text');
  const text = textBlock?.text;
  if (typeof text !== 'string' || text.length === 0) {
    throw new AppError('anthropic/bad-response', 'response missing text block');
  }
  return text.trim();
}
