# Loom Script — 90 Seconds

Recording plan, second-by-second. One take. Use this as the storyboard — read the cues, don't memorize a script.

Before hitting record:
- `npm run dev` running on a clean Chrome window, no DevTools, 100% zoom, 1440px wide
- All four API keys configured and validated in Settings
- Sample preset baked and present at `public/samples/`
- A second window with your written-down prospect-specific brief (don't think during the recording)

---

```
00:00–00:05  Intro
             "This is what marketing-asset generation looks like
             when the human directs every step."

00:05–00:15  Click "Try sample brief & explore →"
             Watch all four steps cascade through and land in the
             final package — sub-second restore.
             "That just restored from cache. This prospect already
             explored this path once. Zero API calls."

00:15–00:25  Click step 1 (Copy) in the stepper.
             Show the variants. Show the refine textarea.
             Type: "more aggressive, less corporate"
             Click Refine. Two new variants render.
             "Plain English. No prompt engineering. The translator
             expands this into specific instructions under the hood."

00:25–00:35  Pick one of the new copy variants.
             Image step cascades and auto-generates.
             Type into the image refine: "lighter background, more energy"
             Click Refine. Two visibly different images.
             "Same plain-language pattern. Every step."

00:35–00:50  Click Critique on one of the images.
             Read the prose aloud verbatim:
             "[strengths-first creative-director feedback]"
             Click "Apply this critique."
             Two new images that address what the critique called out.
             "He's giving feedback, not error reports. And applying
             it is one click."

00:50–01:05  Continue to script. Show two scripts.
             Read one of them aloud — show that it reads naturally,
             not like marketing copy on a slide.
             Pick one. Show 8 voice cards.
             Play three of them. Pick the one that fits.

01:05–01:20  Audio renders. Show the waveform.
             Approve. Final package renders.
             Scroll to Director's Notes.
             Read two refines aloud:
             "Pushed for more aggressive, less corporate."
             "Pushed for lighter background, more energy."
             "This is what he directed. Audit trail by default."

01:20–01:30  Click "Download package."
             Show the zip in the downloads folder. Open it.
             Show: copy.txt, image.jpg, voiceover.mp3, director-notes.md
             "Ready for the campaign manager.
             Or for the next call."
```

---

## Recovery if something goes wrong on tape

- **A variant looks weak:** don't apologize. Click Refine and ask for what's missing. The fix in real time is the strongest demo of the tool.
- **An API errors:** click Settings → validate keys. If a key is dead, switch to the sample brief flow ("This is why we cache — even with a flaky connection, the demo plays through.").
- **The waveform doesn't load:** click Regenerate. ElevenLabs is the most likely flake; it usually resolves on retry.

## What NOT to say

- Don't explain the architecture. The prospect doesn't care about Zustand or FNV-1a.
- Don't compare to other tools by name. Let the demo do the comparison.
- Don't use the word "AI" more than once. The interesting story is direction, not generation.

## After the recording

- Watch it once at 1.5x. If you cringe at any moment, re-record that segment (Loom lets you trim).
- Upload to a shareable URL. Add the link to the demo-day checklist as the network-failure backup.
