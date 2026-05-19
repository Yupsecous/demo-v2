import JSZip from 'jszip';
import { generateDirectorsNotesMarkdown } from './directorsNotes';
import {
  audioVariantsOf,
  copyVariantsOf,
  imageVariantsOf,
} from '../types';
import type { AppState } from '../store';

export type DownloadResult = {
  imageEmbedded: boolean;
  imageWarning?: string;
};

function sanitize(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'package'
  );
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function extensionForMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  return 'jpg';
}

export async function downloadPackage(state: AppState): Promise<DownloadResult> {
  const zip = new JSZip();

  const copyStep = state.steps.copy;
  const imageStep = state.steps.image;
  const audioStep = state.steps.audio;

  const copy = copyVariantsOf(copyStep.variants)[copyStep.selectedIndex ?? -1];
  const image = imageVariantsOf(imageStep.variants)[imageStep.selectedIndex ?? -1];
  const audio = audioVariantsOf(audioStep.variants)[audioStep.selectedIndex ?? -1];

  if (!copy || !image || !audio) {
    throw new Error('Final package is incomplete — re-approve missing steps.');
  }

  zip.file(
    'copy.txt',
    `Headline: ${copy.headline}\n\nCaption: ${copy.caption}\n\nCTA: ${copy.cta}\n`,
  );

  let imageEmbedded = false;
  let imageWarning: string | undefined;
  try {
    const res = await fetch(image.imageUrl);
    if (!res.ok) {
      throw new Error(`Image fetch returned ${res.status}`);
    }
    const blob = await res.blob();
    const ext = extensionForMime(blob.type);
    zip.file(`image.${ext}`, blob);
    imageEmbedded = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    imageWarning = `Image direct fetch was blocked (${msg}). Saved the URL instead.`;
    zip.file('image-url.txt', `${image.imageUrl}\n\nPrompt:\n${image.prompt}\n`);
  }

  // audioBlob is absent for sample-preset variants — fetch the audioUrl in
  // that case (works for both local /samples/audio/ and external mp3s).
  let audioBlob: Blob | null = audio.audioBlob ?? null;
  if (!audioBlob) {
    try {
      const res = await fetch(audio.audioUrl);
      if (res.ok) audioBlob = await res.blob();
    } catch {
      audioBlob = null;
    }
  }
  if (audioBlob) {
    zip.file('voiceover.mp3', audioBlob);
  } else {
    zip.file(
      'voiceover-url.txt',
      `${audio.audioUrl}\n\nAudio could not be fetched as bytes. Open the URL above to download the file.\n`,
    );
  }
  zip.file('director-notes.md', generateDirectorsNotesMarkdown(state));

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(zipBlob, `${sanitize(state.brief.productName)}-package.zip`);

  return { imageEmbedded, ...(imageWarning ? { imageWarning } : {}) };
}
