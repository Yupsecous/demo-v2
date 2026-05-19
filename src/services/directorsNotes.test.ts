import { describe, it, expect } from 'vitest';
import { buildDirectorsNotesData, generateDirectorsNotesMarkdown } from './directorsNotes';
import {
  audioVariant,
  copyVariant,
  critiqueAppliedEntry,
  imageVariant,
  initialEntry,
  makeState,
  moreEntry,
  refineEntry,
  regenerateEntry,
  scriptVariant,
} from '../test/fixtures';

describe('buildDirectorsNotesData', () => {
  it('returns null sections when nothing is approved', () => {
    const d = buildDirectorsNotesData(makeState());
    expect(d.copy).toBeNull();
    expect(d.image).toBeNull();
    expect(d.script).toBeNull();
    expect(d.audio).toBeNull();
    expect(d.brief.productName).toBe('Test product');
  });

  it('includes copy section when copy is approved', () => {
    const v = copyVariant('Win the morning');
    const s = makeState({
      copy: {
        variants: [v],
        selectedIndex: 0,
        history: [initialEntry(), refineEntry('more aggressive')],
      },
    });
    const d = buildDirectorsNotesData(s);
    expect(d.copy).not.toBeNull();
    expect(d.copy?.headline).toBe('Win the morning');
    expect(d.copy?.approvedIndex).toBe(0);
    expect(d.copy?.refinements).toEqual(['more aggressive']);
  });

  it('separates typed refines from applied critiques', () => {
    const v = imageVariant();
    const longCritique =
      'The lighting reads stock-photo though, soft and even across the frame, which kills the urgency the headline is selling. Try a single warm key light from the right and let the background fall into shadow.';
    const s = makeState({
      image: {
        variants: [v],
        selectedIndex: 0,
        history: [
          initialEntry(),
          refineEntry('more cinematic'),
          critiqueAppliedEntry(longCritique),
          refineEntry('darker'),
        ],
      },
    });
    const d = buildDirectorsNotesData(s);
    expect(d.image?.refinements).toEqual(['more cinematic', 'darker']);
    expect(d.image?.appliedCritiques).toEqual([longCritique]);
  });

  it('counts regenerate entries for audio attempt', () => {
    const av = audioVariant();
    const s = makeState({
      audio: {
        variants: [av],
        selectedIndex: 0,
        history: [initialEntry(), regenerateEntry(), regenerateEntry()],
      },
    });
    const d = buildDirectorsNotesData(s);
    expect(d.audio?.attempt).toBe(3);
    expect(d.audio?.regenerateCount).toBe(2);
  });

  it('ignores show-more entries in refinements', () => {
    const v = copyVariant();
    const s = makeState({
      copy: {
        variants: [v],
        selectedIndex: 0,
        history: [initialEntry(), moreEntry(), refineEntry('punchier'), moreEntry()],
      },
    });
    const d = buildDirectorsNotesData(s);
    expect(d.copy?.refinements).toEqual(['punchier']);
  });

  it('truncates script snippet at 80 chars with ellipsis', () => {
    const long = 'A'.repeat(150);
    const sv = scriptVariant(long);
    const s = makeState({ script: { variants: [sv], selectedIndex: 0 } });
    const d = buildDirectorsNotesData(s);
    expect(d.script?.scriptSnippet.length).toBeLessThanOrEqual(81);
    expect(d.script?.scriptSnippet.endsWith('…')).toBe(true);
  });
});

describe('generateDirectorsNotesMarkdown', () => {
  it('includes brief block', () => {
    const md = generateDirectorsNotesMarkdown(
      makeState({
        brief: { productName: 'Lumen', targetAudience: 'parents', adAngle: 'sleep fast' },
      }),
    );
    expect(md).toContain('# Director\'s Notes — Lumen');
    expect(md).toContain('**Product:** Lumen');
    expect(md).toContain('**Audience:** parents');
    expect(md).toContain('**Angle:** sleep fast');
  });

  it('omits step sections when not approved', () => {
    const md = generateDirectorsNotesMarkdown(makeState());
    expect(md).not.toContain('## Copy');
    expect(md).not.toContain('## Image');
    expect(md).not.toContain('## Script + Voice');
    expect(md).not.toContain('## Audio');
  });

  it('renders a complete run with refinements as a bulleted list', () => {
    const cv = copyVariant('Headline X');
    const iv = imageVariant();
    const sv = scriptVariant('Short script.');
    const av = audioVariant();
    const md = generateDirectorsNotesMarkdown(
      makeState({
        copy: {
          variants: [cv],
          selectedIndex: 0,
          history: [initialEntry(), refineEntry('aggressive')],
        },
        image: {
          variants: [iv],
          selectedIndex: 0,
          history: [initialEntry(), refineEntry('cinematic')],
        },
        script: {
          variants: [sv],
          selectedIndex: 0,
          selectedVoiceId: null,
          history: [initialEntry()],
        },
        audio: { variants: [av], selectedIndex: 0, history: [initialEntry()] },
      }),
    );
    expect(md).toContain('## Copy');
    expect(md).toContain('Approved variant 1: "Headline X"');
    expect(md).toContain('- aggressive');
    expect(md).toContain('## Image');
    expect(md).toContain('- cinematic');
    expect(md).toContain('## Script + Voice');
    expect(md).toContain('## Audio');
    expect(md).toContain('Approved on attempt 1');
  });

  it('renders "_None_" when a step was approved without refinement', () => {
    const cv = copyVariant();
    const md = generateDirectorsNotesMarkdown(
      makeState({ copy: { variants: [cv], selectedIndex: 0, history: [initialEntry()] } }),
    );
    expect(md).toContain('_None_');
  });

  it('renders critique-applied entries in a distinct subsection', () => {
    const iv = imageVariant();
    const longCritique =
      'The intensity lands — the low angle and saturated reds put the viewer in the moment with the athlete. The background gets noisy.';
    const md = generateDirectorsNotesMarkdown(
      makeState({
        image: {
          variants: [iv],
          selectedIndex: 0,
          history: [
            initialEntry(),
            refineEntry('darker'),
            critiqueAppliedEntry(longCritique),
          ],
        },
      }),
    );
    expect(md).toContain('**Critiques applied:**');
    expect(md).toContain('- darker'); // typed refine still in refinements
    expect(md.includes(longCritique.slice(0, 60))).toBe(true);
  });

  it('shows regenerate count parenthetical when present', () => {
    const av = audioVariant();
    const md = generateDirectorsNotesMarkdown(
      makeState({
        audio: {
          variants: [av],
          selectedIndex: 0,
          history: [initialEntry(), regenerateEntry()],
        },
      }),
    );
    expect(md).toContain('Approved on attempt 2');
    expect(md).toContain('1 regenerate');
  });
});
