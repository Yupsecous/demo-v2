export type StepId = 'copy' | 'image' | 'script' | 'audio';

export type StepStatus =
  | 'pending'
  | 'generating'
  | 'options'
  | 'refining'
  | 'approved';

export type CopyVariant = {
  kind: 'copy';
  id: string;
  headline: string;
  caption: string;
  cta: string;
  createdAt: number;
};

export type ImageVariant = {
  kind: 'image';
  id: string;
  imageUrl: string;
  prompt: string;
  modsApplied?: ImagePromptMods;
  createdAt: number;
};

export type Critique = {
  variantId: string;
  text: string;
  createdAt: number;
};

export type ScriptVariant = {
  kind: 'script';
  id: string;
  script: string;
  durationEstimate: number;
  toneDescription: string;
  modsApplied?: VoiceMods;
  createdAt: number;
};

export type AudioVariant = {
  kind: 'audio';
  id: string;
  audioUrl: string;
  audioBlob?: Blob; // absent for sample-preset variants; fetched on demand for zip export
  voiceId: string;
  scriptId: string;
  durationSeconds?: number;
  createdAt: number;
};

export type Variant = CopyVariant | ImageVariant | ScriptVariant | AudioVariant;

export type RefineKind = 'initial' | 'more' | 'refine' | 'critique-applied';

export type GenerationLogEntry = {
  id: string;
  kind: RefineKind;
  direction: string | null;
  variantCount: number;
  timestamp: number;
};

export type VoicePickLogEntry = {
  id: string;
  kind: 'voice-pick';
  voiceId: string;
  voiceName: string;
  timestamp: number;
};

export type RegenerateLogEntry = {
  id: string;
  kind: 'regenerate';
  discardedDurationSeconds: number | null;
  timestamp: number;
};

export type CacheRestoreLogEntry = {
  id: string;
  kind: 'cache-restore';
  timestamp: number;
};

export type RefineEntry =
  | GenerationLogEntry
  | VoicePickLogEntry
  | RegenerateLogEntry
  | CacheRestoreLogEntry;

export type StepState = {
  id: StepId;
  label: string;
  status: StepStatus;
  variants: Variant[];
  selectedIndex: number | null;
  selectedVoiceId: string | null;
  history: RefineEntry[];
  critiques: Record<string, Critique>;
};

export type Brief = {
  productName: string;
  targetAudience: string;
  adAngle: string;
};

export type Provider = 'fal' | 'eleven' | 'openai' | 'anthropic';

export type ValidationStatus = 'unchecked' | 'validating' | 'ok' | 'fail';

export type ApiKeys = Record<Provider, string>;
export type Validations = Record<Provider, ValidationStatus>;

export const STEP_ORDER: readonly StepId[] = ['copy', 'image', 'script', 'audio'] as const;

export const STEP_LABELS: Record<StepId, string> = {
  copy: 'Copy',
  image: 'Image',
  script: 'Script',
  audio: 'Audio',
};

export const PROVIDER_LABELS: Record<Provider, string> = {
  fal: 'fal.ai',
  eleven: 'ElevenLabs',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
};

export function isCopyVariant(v: Variant): v is CopyVariant {
  return v.kind === 'copy';
}

export function copyVariantsOf(variants: Variant[]): CopyVariant[] {
  return variants.filter(isCopyVariant);
}

export function isImageVariant(v: Variant): v is ImageVariant {
  return v.kind === 'image';
}

export function imageVariantsOf(variants: Variant[]): ImageVariant[] {
  return variants.filter(isImageVariant);
}

export function isScriptVariant(v: Variant): v is ScriptVariant {
  return v.kind === 'script';
}

export function scriptVariantsOf(variants: Variant[]): ScriptVariant[] {
  return variants.filter(isScriptVariant);
}

export function isAudioVariant(v: Variant): v is AudioVariant {
  return v.kind === 'audio';
}

export function audioVariantsOf(variants: Variant[]): AudioVariant[] {
  return variants.filter(isAudioVariant);
}

export type CachedStepState = {
  variants: Variant[];
  selectedIndex: number | null;
  selectedVoiceId?: string | null;
  critiques: Record<string, Critique>;
  cachedAt: number;
};

export type VariantCache = Record<string, CachedStepState>;

export function cacheKey(stepId: StepId, hash: string): string {
  return `${stepId}:${hash}`;
}

export type AssetType = 'copy' | 'image' | 'voice';

export const ASSET_TYPES: readonly AssetType[] = ['copy', 'image', 'voice'] as const;

export type CopyMods = {
  enrichedDirection: string;
  avoid: string[];
  emphasize: string[];
};

export type ImagePromptMods = {
  lighting: string;
  composition: string;
  palette: string;
  mood: string;
  subject: string;
  background: string;
  energy: 'high' | 'medium' | 'low';
  avoid: string[];
};

export type VoiceMods = {
  scriptTone: string;
  pace: 'slower' | 'normal' | 'faster';
  delivery: string;
  emphasis: string;
  voiceCharacter: string;
};

export type TranslatorOutput =
  | { kind: 'copy'; mods: CopyMods }
  | { kind: 'image'; mods: ImagePromptMods }
  | { kind: 'voice'; mods: VoiceMods };
