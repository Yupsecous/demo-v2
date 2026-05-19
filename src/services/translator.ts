import { z } from 'zod';
import { chatCompletionsJson } from './openaiClient';
import { AppError } from './errorMessages';
import type {
  AssetType,
  CopyMods,
  ImagePromptMods,
  TranslatorOutput,
  VoiceMods,
} from '../types';

export type TranslateDirectionArgs = {
  direction: string;
  assetType: AssetType;
  apiKey: string;
  currentAsset?: { kind: string; summary: string };
};

const COPY_SYSTEM_PROMPT = `You translate a creative director's plain-language direction into structured copy modifications. The output drives a second LLM that writes ad copy.

Principles:
- Commit. Don't hedge. Do not use "perhaps," "might," "consider."
- Produce mods that will visibly and predictably change the copy.
- Take the direction at face value. No clarifying questions.
- Return only JSON matching the schema.

Output fields:
- enrichedDirection: a more specific, actionable version of the user's direction. Concrete, no hedging. 2-4 short sentences.
- avoid: additional words or phrases the copy LLM should NOT use given this direction.
- emphasize: qualities or techniques the copy should lean into.

Examples:

Direction: "more aggressive"
{
  "enrichedDirection": "Drop the soft sell. Open with a hard claim or a confrontation. Short clauses. Punctuation as percussion. Use 'you' early. Make the reader feel the cost of inaction.",
  "avoid": ["consider", "perhaps", "elevate", "experience the difference", "discover", "explore"],
  "emphasize": ["direct address", "short clauses", "concrete stakes", "specificity over abstraction"]
}

Direction: "softer, more friendly"
{
  "enrichedDirection": "Loosen the voice. Use contractions. Open with empathy or a shared experience. Lower the stakes. Reassure rather than demand. Conversational rhythm with light specificity.",
  "avoid": ["urgent", "now", "limited time", "act fast", "warning", "don't miss"],
  "emphasize": ["contractions", "first-person plural", "warm specificity", "permission-giving language"]
}

Direction: "more confident, less salesy"
{
  "enrichedDirection": "State the thing flatly. No hype. No exclamation points. Trust that the product is good and the reader is smart. One claim, brief evidence, done.",
  "avoid": ["amazing", "incredible", "best ever", "unbeatable", "guaranteed", "!"],
  "emphasize": ["declarative voice", "single claim", "implicit confidence", "evidence-led specifics"]
}

Direction: "more urgent, scarcity"
{
  "enrichedDirection": "Tighten the timeframe. Reference what is running out — supply, window, decision. Short verbs. Present-tense. Make doing nothing feel costly.",
  "avoid": ["whenever you're ready", "no rush", "explore at your own pace", "learn more"],
  "emphasize": ["time markers", "loss framing", "imperative verbs", "specific deadlines"]
}

Direction: "playful, light"
{
  "enrichedDirection": "Add one unexpected image or analogy. A light self-aware aside is allowed. Break the fourth wall once. End on a wink rather than a command.",
  "avoid": ["transform", "revolutionize", "industry-leading", "world-class", "synergy"],
  "emphasize": ["concrete metaphor", "rhythmic variation", "single wink or aside", "low-stakes voice"]
}

Direction: "make it pop"
{
  "enrichedDirection": "Front-load the strongest noun and verb. Cut the warm-up clause. Beats in threes. End on a hard stop.",
  "avoid": ["introducing", "welcome to", "we believe", "we are proud to"],
  "emphasize": ["lead with verb or noun", "tricolon structure", "monosyllables", "no qualifying clauses"]
}

Now produce the same JSON for the direction in the user message.`;

const IMAGE_SYSTEM_PROMPT = `You translate a creative director's plain-language direction into structured image generation modifications. The output drives an image model (Flux / Stable Diffusion class).

Principles:
- Commit. Don't hedge. No clarifying questions.
- Every field must be filled with concrete, specific terminology a photographer or art director would use.
- If a direction doesn't naturally apply to a field (e.g. "make it pop" for "subject"), interpret broadly and commit to a strong read.
- Return only JSON matching the schema.

Output fields:
- lighting: lighting setup, direction, quality, contrast
- composition: framing, angle, crop, motion implied
- palette: color choices, saturation, contrast
- mood: emotional register
- subject: pose, gaze, expression, energy of the human/object
- background: environment, treatment, depth
- energy: "high" | "medium" | "low"
- avoid: negative-prompt terms (things the image model should NOT include)

Examples:

Direction: "more aggressive"
{
  "lighting": "hard directional key light, single-source, dramatic shadows",
  "composition": "low angle, tight crop, slight tilt for tension",
  "palette": "saturated reds and deep blacks, high contrast",
  "mood": "urgent, intense, confrontational",
  "subject": "confident posture, jaw set, direct gaze",
  "background": "darker, simplified, blurred",
  "energy": "high",
  "avoid": ["soft pastels", "even ambient lighting", "smiling subject"]
}

Direction: "lighter background, more energy"
{
  "lighting": "high-key, soft fill, bright overall exposure",
  "composition": "centered with leading lines, dynamic angle",
  "palette": "bright saturated colors against soft white",
  "mood": "uplifting, optimistic, kinetic",
  "subject": "mid-motion, leaning forward, animated expression",
  "background": "bright studio white, airy, soft gradient",
  "energy": "high",
  "avoid": ["dark moody tones", "static posture", "heavy vignette"]
}

Direction: "calmer, more grounded"
{
  "lighting": "soft overcast daylight, even fill, gentle contrast",
  "composition": "eye-level, medium-wide, breathing room around the subject",
  "palette": "muted earth tones, low saturation, soft greens and warm neutrals",
  "mood": "settled, contemplative, quiet confidence",
  "subject": "relaxed posture, soft gaze slightly off-camera, unforced expression",
  "background": "natural setting, simplified, gentle depth",
  "energy": "low",
  "avoid": ["high contrast", "motion blur", "saturated reds", "studio strobes"]
}

Direction: "more cinematic"
{
  "lighting": "golden-hour rim light with low-angle key, soft falloff, subtle lens-flare highlights",
  "composition": "anamorphic wide, off-center framing, shallow depth of field",
  "palette": "teal and orange split, controlled contrast, slight desaturation",
  "mood": "contemplative, weighty, story-implied",
  "subject": "looking off-frame, captured mid-thought, environmental scale",
  "background": "blurred environmental layers, sense of depth, atmospheric haze",
  "energy": "medium",
  "avoid": ["flat lighting", "centered symmetry", "stock-photo composition", "fully sharp focus"]
}

Direction: "high-fashion editorial"
{
  "lighting": "controlled studio strobe, hard shadow with rim accent, beauty-dish style",
  "composition": "elongated portrait, generous negative space, asymmetric framing",
  "palette": "monochrome with one bold accent, deep blacks, refined contrast",
  "mood": "aloof, statuesque, considered",
  "subject": "elongated pose, gaze past the lens, sculpted expression",
  "background": "seamless paper backdrop, single solid tone, no environment",
  "energy": "medium",
  "avoid": ["candid expression", "busy background", "warm lifestyle tones", "smiling subject"]
}

Direction: "softer, more friendly"
{
  "lighting": "diffused window light, soft wraparound fill, gentle warmth",
  "composition": "eye-level, natural medium shot, slight tilt toward subject",
  "palette": "warm pastels, cream and soft peach, low contrast",
  "mood": "approachable, warm, easy",
  "subject": "genuine smile, eye contact with lens, relaxed shoulders",
  "background": "soft out-of-focus home or natural environment, warm tones",
  "energy": "medium",
  "avoid": ["hard shadows", "low-angle dominance", "muted desaturated tones", "industrial setting"]
}

Now produce the same JSON for the direction in the user message.`;

const VOICE_SYSTEM_PROMPT = `You translate a creative director's plain-language direction into structured voice-over modifications. The output drives both a script LLM and a voice-library selection.

Principles:
- Commit. Don't hedge. No clarifying questions.
- Concrete, specific terminology a voice director would use.
- If a direction doesn't naturally apply to voice (e.g. "the guy should smile more"), interpret broadly and commit ("audible smile, friendlier delivery").
- Return only JSON matching the schema.

Output fields:
- scriptTone: instructions for the script LLM, plain-English. No hedging.
- pace: "slower" | "normal" | "faster"
- delivery: how the voice should sound performing the script
- emphasis: which words or phrases to stress
- voiceCharacter: traits used to pick a voice from a library (register, timbre, posture)

Examples:

Direction: "more aggressive"
{
  "scriptTone": "Harder, more direct. Trim filler. Use the imperative. Short clauses.",
  "pace": "faster",
  "delivery": "confident, clipped, slight forward lean, no smile",
  "emphasis": "verbs and stake-words, especially at the start of clauses",
  "voiceCharacter": "lower register, more chest, less polish, slight edge"
}

Direction: "calmer, more grounded"
{
  "scriptTone": "Slow it down. Add breathing room. Lower the rhetorical temperature.",
  "pace": "slower",
  "delivery": "settled, unhurried, warm authority, no rising inflection",
  "emphasis": "concrete nouns over modifiers, the line just before each pause",
  "voiceCharacter": "lower-mid register, grounded resonance, minimal lift, steady"
}

Direction: "more cinematic"
{
  "scriptTone": "Sparser. Let pauses do work. Trust the listener to fill space.",
  "pace": "slower",
  "delivery": "measured, contemplative, deliberate pauses between beats",
  "emphasis": "the final word of each beat, then silence",
  "voiceCharacter": "rich mid-range, slight texture, intimate proximity"
}

Direction: "softer, more friendly"
{
  "scriptTone": "Conversational. Add a small aside. Smile while you say it.",
  "pace": "normal",
  "delivery": "warm, audible smile, easy cadence, light upward inflection on 'you'",
  "emphasis": "second-person 'you' moments and shared-experience phrases",
  "voiceCharacter": "mid-range, bright timbre, approachable, slightly buoyant"
}

Direction: "more urgent, scarcity"
{
  "scriptTone": "Cut every soft word. Front-load the time pressure. Short sentences.",
  "pace": "faster",
  "delivery": "lean forward, slight tension, no smile, clipped consonants",
  "emphasis": "time words and verbs in the imperative",
  "voiceCharacter": "mid register, taut, alert quality, tight breath"
}

Direction: "the guy should smile more"
{
  "scriptTone": "Warmer, friendlier energy. Add a beat of shared humor if it fits.",
  "pace": "normal",
  "delivery": "audible smile throughout, relaxed shoulders, gentle warmth",
  "emphasis": "moments of connection and shared human experience",
  "voiceCharacter": "warmer mid-range, slight buoyancy, approachable timbre"
}

Now produce the same JSON for the direction in the user message.`;

const COPY_MODS_SCHEMA = {
  type: 'object',
  properties: {
    enrichedDirection: { type: 'string' },
    avoid: { type: 'array', items: { type: 'string' } },
    emphasize: { type: 'array', items: { type: 'string' } },
  },
  required: ['enrichedDirection', 'avoid', 'emphasize'],
  additionalProperties: false,
} as const;

const IMAGE_MODS_SCHEMA = {
  type: 'object',
  properties: {
    lighting: { type: 'string' },
    composition: { type: 'string' },
    palette: { type: 'string' },
    mood: { type: 'string' },
    subject: { type: 'string' },
    background: { type: 'string' },
    energy: { type: 'string', enum: ['high', 'medium', 'low'] },
    avoid: { type: 'array', items: { type: 'string' } },
  },
  required: ['lighting', 'composition', 'palette', 'mood', 'subject', 'background', 'energy', 'avoid'],
  additionalProperties: false,
} as const;

const VOICE_MODS_SCHEMA = {
  type: 'object',
  properties: {
    scriptTone: { type: 'string' },
    pace: { type: 'string', enum: ['slower', 'normal', 'faster'] },
    delivery: { type: 'string' },
    emphasis: { type: 'string' },
    voiceCharacter: { type: 'string' },
  },
  required: ['scriptTone', 'pace', 'delivery', 'emphasis', 'voiceCharacter'],
  additionalProperties: false,
} as const;

const CopyModsZ: z.ZodType<CopyMods> = z.object({
  enrichedDirection: z.string(),
  avoid: z.array(z.string()),
  emphasize: z.array(z.string()),
});

const ImagePromptModsZ: z.ZodType<ImagePromptMods> = z.object({
  lighting: z.string(),
  composition: z.string(),
  palette: z.string(),
  mood: z.string(),
  subject: z.string(),
  background: z.string(),
  energy: z.enum(['high', 'medium', 'low']),
  avoid: z.array(z.string()),
});

const VoiceModsZ: z.ZodType<VoiceMods> = z.object({
  scriptTone: z.string(),
  pace: z.enum(['slower', 'normal', 'faster']),
  delivery: z.string(),
  emphasis: z.string(),
  voiceCharacter: z.string(),
});

function buildUserMessage(direction: string, currentAsset?: { kind: string; summary: string }): string {
  const lines = [`Direction: "${direction}"`];
  if (currentAsset) {
    lines.push(`Current ${currentAsset.kind}: ${currentAsset.summary}`);
  }
  return lines.join('\n');
}

export async function translateDirection(args: TranslateDirectionArgs): Promise<TranslatorOutput> {
  const direction = args.direction.trim();
  if (!direction) {
    throw new AppError('translator/empty-direction');
  }
  const user = buildUserMessage(direction, args.currentAsset);

  switch (args.assetType) {
    case 'copy': {
      const raw = await chatCompletionsJson({
        apiKey: args.apiKey,
        system: COPY_SYSTEM_PROMPT,
        user,
        schemaName: 'copy_mods',
        schema: COPY_MODS_SCHEMA as unknown as Record<string, unknown>,
        temperature: 0.4,
        maxTokens: 600,
      });
      const mods = CopyModsZ.parse(raw);
      return { kind: 'copy', mods };
    }
    case 'image': {
      const raw = await chatCompletionsJson({
        apiKey: args.apiKey,
        system: IMAGE_SYSTEM_PROMPT,
        user,
        schemaName: 'image_mods',
        schema: IMAGE_MODS_SCHEMA as unknown as Record<string, unknown>,
        temperature: 0.4,
        maxTokens: 700,
      });
      const mods = ImagePromptModsZ.parse(raw);
      return { kind: 'image', mods };
    }
    case 'voice': {
      const raw = await chatCompletionsJson({
        apiKey: args.apiKey,
        system: VOICE_SYSTEM_PROMPT,
        user,
        schemaName: 'voice_mods',
        schema: VOICE_MODS_SCHEMA as unknown as Record<string, unknown>,
        temperature: 0.4,
        maxTokens: 500,
      });
      const mods = VoiceModsZ.parse(raw);
      return { kind: 'voice', mods };
    }
  }
}
