import { getVoiceById } from '../data/voiceLibrary';
import {
  audioVariantsOf,
  copyVariantsOf,
  imageVariantsOf,
  scriptVariantsOf,
  type RefineEntry,
  type StepState,
} from '../types';
import type { AppState } from '../store';

export type DirectorsNotesData = {
  brief: AppState['brief'];
  copy: {
    approvedIndex: number;
    headline: string;
    refinements: string[];
  } | null;
  image: {
    approvedIndex: number;
    refinements: string[];
    appliedCritiques: string[];
  } | null;
  script: {
    approvedIndex: number;
    scriptSnippet: string;
    refinements: string[];
    voice: {
      name: string;
      toneLabel: string;
    } | null;
  } | null;
  audio: {
    attempt: number;
    regenerateCount: number;
  } | null;
};

function refinements(history: RefineEntry[]): string[] {
  const out: string[] = [];
  for (const h of history) {
    if (h.kind === 'refine' && h.direction) out.push(h.direction);
  }
  return out;
}

function regenerateCount(step: StepState): number {
  return step.history.filter((h) => h.kind === 'regenerate').length;
}

function appliedCritiques(history: RefineEntry[]): string[] {
  const out: string[] = [];
  for (const h of history) {
    if (h.kind === 'critique-applied' && h.direction) out.push(h.direction);
  }
  return out;
}

export function buildDirectorsNotesData(state: AppState): DirectorsNotesData {
  const copyStep = state.steps.copy;
  const imageStep = state.steps.image;
  const scriptStep = state.steps.script;
  const audioStep = state.steps.audio;

  const copyVariants = copyVariantsOf(copyStep.variants);
  const imageVariants = imageVariantsOf(imageStep.variants);
  const scriptVariants = scriptVariantsOf(scriptStep.variants);
  const audioVariants = audioVariantsOf(audioStep.variants);

  const approvedCopy =
    copyStep.selectedIndex !== null ? copyVariants[copyStep.selectedIndex] : undefined;
  const approvedImage =
    imageStep.selectedIndex !== null ? imageVariants[imageStep.selectedIndex] : undefined;
  const approvedScript =
    scriptStep.selectedIndex !== null ? scriptVariants[scriptStep.selectedIndex] : undefined;
  const approvedVoice = getVoiceById(scriptStep.selectedVoiceId);

  return {
    brief: state.brief,
    copy: approvedCopy
      ? {
          approvedIndex: copyStep.selectedIndex ?? 0,
          headline: approvedCopy.headline,
          refinements: refinements(copyStep.history),
        }
      : null,
    image: approvedImage
      ? {
          approvedIndex: imageStep.selectedIndex ?? 0,
          refinements: refinements(imageStep.history),
          appliedCritiques: appliedCritiques(imageStep.history),
        }
      : null,
    script: approvedScript
      ? {
          approvedIndex: scriptStep.selectedIndex ?? 0,
          scriptSnippet:
            approvedScript.script.length > 80
              ? approvedScript.script.slice(0, 80).trimEnd() + '…'
              : approvedScript.script,
          refinements: refinements(scriptStep.history),
          voice: approvedVoice
            ? { name: approvedVoice.displayName, toneLabel: approvedVoice.toneLabel }
            : null,
        }
      : null,
    audio:
      audioVariants.length > 0
        ? {
            attempt: regenerateCount(audioStep) + 1,
            regenerateCount: regenerateCount(audioStep),
          }
        : null,
  };
}

function bullet(items: string[]): string {
  if (items.length === 0) return '_None_';
  return items.map((s) => `- ${s}`).join('\n');
}

export function generateDirectorsNotesMarkdown(state: AppState): string {
  const d = buildDirectorsNotesData(state);
  const out: string[] = [];
  out.push(`# Director's Notes — ${d.brief.productName || 'Untitled'}`);
  out.push('');
  out.push('## Brief');
  out.push(`- **Product:** ${d.brief.productName}`);
  out.push(`- **Audience:** ${d.brief.targetAudience}`);
  out.push(`- **Angle:** ${d.brief.adAngle}`);
  out.push('');

  if (d.copy) {
    out.push('## Copy');
    out.push(`Approved variant ${d.copy.approvedIndex + 1}: "${d.copy.headline}"`);
    out.push('');
    out.push(`**Refinements:**`);
    out.push(bullet(d.copy.refinements));
    out.push('');
  }

  if (d.image) {
    out.push('## Image');
    out.push(`Approved variant ${d.image.approvedIndex + 1}.`);
    out.push('');
    out.push(`**Refinements:**`);
    out.push(bullet(d.image.refinements));
    out.push('');
    if (d.image.appliedCritiques.length > 0) {
      out.push('**Critiques applied:**');
      out.push(
        d.image.appliedCritiques
          .map((c) => `- ${c.length > 200 ? c.slice(0, 200).trimEnd() + '…' : c}`)
          .join('\n'),
      );
      out.push('');
    }
  }

  if (d.script) {
    out.push('## Script + Voice');
    out.push(`Approved variant ${d.script.approvedIndex + 1}: "${d.script.scriptSnippet}"`);
    if (d.script.voice) {
      out.push(`Voice: **${d.script.voice.name}** — ${d.script.voice.toneLabel}`);
    }
    out.push('');
    out.push(`**Refinements:**`);
    out.push(bullet(d.script.refinements));
    out.push('');
  }

  if (d.audio) {
    out.push('## Audio');
    out.push(
      `Approved on attempt ${d.audio.attempt}` +
        (d.audio.regenerateCount > 0
          ? ` (after ${d.audio.regenerateCount} regenerate${d.audio.regenerateCount === 1 ? '' : 's'})`
          : ''),
    );
    out.push('');
  }

  return out.join('\n');
}
