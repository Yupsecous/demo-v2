import { z } from 'zod';
import { chatCompletionsJson } from './openaiClient';
import type { Brief, CopyVariant, ImagePromptMods } from '../types';

export type BuildImagePromptArgs = {
  brief: Brief;
  approvedCopy: CopyVariant;
  mods?: ImagePromptMods;
  apiKey: string;
};

const BUILDER_SYSTEM_PROMPT = `You construct prompts for Flux Schnell marketing image generation. You write in prose, single paragraph, vivid and specific. You never use tag-lists or comma-soup. You describe one image — what the camera sees, what the light does, what the subject is doing.

When direction is provided, you weave the lighting, composition, palette, mood, subject, background, and energy modifications heavily into the prose. The direction is not optional flavor; it is the spine of the image.

When an "avoid" list is provided, you write the prompt so it actively excludes those qualities — not by appending a negative, but by choosing prose that points the image away from them.

End every prompt with one aspect ratio cue: "Portrait 4:5".

Examples:

Brief: { product: "Lumen Sleep Mist", audience: "burned-out parents, 30-45", angle: "Fall asleep in seven minutes flat" }
Approved copy: { headline: "Sleep is loading.", caption: "Three sprays. Eight minutes. Goodnight.", cta: "Spray, sleep, repeat." }
Direction: (none)
Output:
"Soft-lit marketing photograph of a tired parent in their late thirties sitting on the edge of a low bed in a dim bedroom, holding a small dark glass spray bottle of Lumen Sleep Mist near their collarbone, a faint vapor curling upward. Warm bedside-lamp glow as the single key, low natural contrast, muted earth-tone palette of charcoal and warm taupe. Calm, restful expression, eyes half-closed. Soft out-of-focus pillow and white duvet behind the subject, gentle bokeh. Sharp focus on the bottle, commercial photography. Portrait 4:5."

Brief: { product: "Strata Coffee", audience: "early-shift workers, 25-40", angle: "The first sip is the start of the win" }
Approved copy: { headline: "Win the morning before it starts.", caption: "Strata is built for the first hour, not the third. Two sips. You're on.", cta: "Get the edge." }
Direction:
- lighting: hard directional key light, single-source, dramatic shadows
- composition: low angle, tight crop, slight tilt for tension
- palette: saturated reds and deep blacks, high contrast
- mood: urgent, intense, confrontational
- subject: confident posture, jaw set, direct gaze
- background: darker, simplified, blurred
- energy: high
- avoid: soft pastels, even ambient lighting, smiling subject
Output:
"High-contrast marketing photograph of a focused woman in her early thirties in worn workout gear, gripping a matte-black insulated tumbler of Strata Coffee, jaw set, eyes locked on the camera. Hard side key light from camera-left carves deep shadows across the right side of her face and the tumbler. Saturated brand-red accent on the Strata label glows against a near-black, blurred concrete-and-steel gym background. Low angle, tight on the upper body, frame tilted slightly for tension. Sharp focus on the eyes and the label, commercial photography. Portrait 4:5."

Brief: { product: "Carb-Hub Bars", audience: "amateur athletes, 20-35", angle: "Fuel that doesn't sit in your stomach" }
Approved copy: { headline: "Eat fast. Move faster.", caption: "Carb-Hub clears your gut in twenty minutes so it can fuel the next forty. Light in, light out.", cta: "Open and go." }
Direction:
- lighting: high-key, soft fill, bright overall exposure
- composition: centered with leading lines, dynamic angle
- palette: bright saturated colors against soft white
- mood: uplifting, optimistic, kinetic
- subject: mid-motion, leaning forward, animated expression
- background: bright studio white, airy, soft gradient
- energy: high
- avoid: dark moody tones, static posture, heavy vignette
Output:
"Bright, kinetic marketing photograph of a young athlete mid-motion tearing open a foil pack of a Carb-Hub Bar, body leaning forward into the frame, mid-laugh expression. High-key soft fill lighting fills the scene evenly with no harsh shadow. Saturated turquoise and lemon-yellow accents from the foil wrapper read clean against a soft white seamless studio backdrop with a gentle gradient. Composition centered, subtle leading lines from the torn-foil edges drawing the eye to the bar. Frame tilted just enough to suggest forward motion, slight motion implied in the hands. Sharp focus, commercial photography. Portrait 4:5."

Brief: { product: "StillMind", audience: "anxious knowledge workers, 28-45", angle: "Five minutes is enough" }
Approved copy: { headline: "Five minutes is enough.", caption: "Open StillMind on the walk between meetings. The session ends before your next one starts.", cta: "Try a five-minute reset." }
Direction:
- lighting: soft overcast daylight, even fill, gentle contrast
- composition: eye-level, medium-wide, breathing room around the subject
- palette: muted earth tones, low saturation, soft greens and warm neutrals
- mood: settled, contemplative, quiet confidence
- subject: relaxed posture, soft gaze slightly off-camera, unforced expression
- background: natural setting, simplified, gentle depth
- energy: low
- avoid: high contrast, motion blur, saturated reds, studio strobes
Output:
"Quiet marketing photograph of a knowledge worker in their thirties sitting cross-legged on a worn wooden bench, holding a phone at chest height with the StillMind app open, soft gaze drifting slightly off-camera. Soft overcast daylight wraps the figure evenly, gentle natural contrast, no harsh shadows. Muted sage and warm taupe palette throughout, low saturation, the linen of their shirt and the dry grass behind them sharing the same tonal family. Eye-level medium-wide framing with generous breathing room above and beside the subject. Out-of-focus park foliage and a quiet path in the background, just enough depth to suggest place. Sharp focus on the hands and phone, commercial photography. Portrait 4:5."

Now produce the same kind of prompt for the brief, copy, and direction in the user message. Return only the JSON object with a "prompt" field.`;

const BUILDER_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    prompt: { type: 'string' },
  },
  required: ['prompt'],
  additionalProperties: false,
} as const;

const BuilderResponseZ = z.object({ prompt: z.string() });

function formatMods(mods: ImagePromptMods): string {
  return [
    `- lighting: ${mods.lighting}`,
    `- composition: ${mods.composition}`,
    `- palette: ${mods.palette}`,
    `- mood: ${mods.mood}`,
    `- subject: ${mods.subject}`,
    `- background: ${mods.background}`,
    `- energy: ${mods.energy}`,
    `- avoid: ${mods.avoid.join(', ')}`,
  ].join('\n');
}

function buildUserMessage(args: BuildImagePromptArgs): string {
  const { brief, approvedCopy, mods } = args;
  const lines = [
    `Brief: { product: "${brief.productName}", audience: "${brief.targetAudience}", angle: "${brief.adAngle}" }`,
    `Approved copy: { headline: "${approvedCopy.headline}", caption: "${approvedCopy.caption}", cta: "${approvedCopy.cta}" }`,
  ];
  if (mods) {
    lines.push('Direction:');
    lines.push(formatMods(mods));
  } else {
    lines.push('Direction: (none)');
  }
  lines.push('');
  lines.push('Write the Flux Schnell prompt.');
  return lines.join('\n');
}

export async function buildImagePrompt(args: BuildImagePromptArgs): Promise<string> {
  const user = buildUserMessage(args);
  const raw = await chatCompletionsJson({
    apiKey: args.apiKey,
    system: BUILDER_SYSTEM_PROMPT,
    user,
    schemaName: 'flux_prompt',
    schema: BUILDER_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
    temperature: 0.85,
    maxTokens: 600,
  });
  const parsed = BuilderResponseZ.parse(raw);
  return parsed.prompt.trim();
}
