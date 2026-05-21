# Director's Cockpit Demo

A browser-only ad creative pipeline for marketing agencies. One brief, four sequential steps (copy, image, script, audio), where the user directs each step in plain English instead of writing prompts. Built for sales demos that show what marketing-asset generation looks like when the human stays in charge.

## What the demo does

The user fills in a three-line brief (product, audience, ad angle) and walks through four steps. Each step generates two variants. The user either picks one or types a refinement in plain English ("more aggressive, less corporate", "lighter background, more energy"). A translator layer converts those plain-language directions into structured modifications under the hood, so the user never writes a prompt.

After all four steps, a final package view assembles the assets along with a Director's Notes audit trail that summarises every refinement, critique, and pick. A download button packages the four assets into a zip file ready to hand off.

## API keys

Four providers are involved. The keys all go into the Settings drawer in the running app, never into source code or environment variables shipped to end users.

OpenAI. Used by every step. Without it nothing generates. Get a key at https://platform.openai.com/api-keys.

fal.ai. Used for image generation. Without it the image step fails. Get a key at https://fal.ai/dashboard/keys. The key format is a UUID, a colon, and a hex string, all together as one value.

ElevenLabs. Used for the final voice render and for the optional voice-library prerecording script. Without it the audio step fails unless the sample preset has been baked, in which case it falls back to demo audio. Get a key at https://elevenlabs.io/app/settings/api-keys.

Anthropic. Two roles. Without it the Critique button on each image variant is disabled with an inline hint, and copy generation falls back to gpt-4o-mini. With it, copy generation routes through Claude Sonnet for noticeably higher-quality variants, and image critique is available. Get a key at https://console.anthropic.com/settings/keys.

Keys live in the visitor's browser sessionStorage. They are cleared when the tab closes. They are not transmitted to any server other than the four providers above. They are not bundled into source code or environment variables shipped to end users. Every visitor enters their own keys. The demo owner does not pay for visitor usage.

## Onboarding and gating

A fresh visitor with no API keys configured does not see the brief form. Instead they see an OnboardingState card that explains the four services, what each is used for, and a primary "Open Settings" button. If a sample preset has been baked, a secondary "Try the sample brief instead" button is shown so the visitor can experience the full pipeline without entering any keys.

The Settings drawer auto-opens once per session 600ms after the visitor lands, so the welcome card stays readable while the drawer slides in. A sessionStorage flag prevents the drawer from re-opening on subsequent loads in the same tab.

Once an OpenAI key is added, the brief form appears and the demo proceeds normally. The other three keys (fal.ai, ElevenLabs, Anthropic) are added on demand as the visitor reaches each step.

## How the four steps work

Step one, copy. The user submits the brief. The copy step auto-fires a call that returns two variants of headline, caption, and call-to-action. When an Anthropic key is configured, this call routes through Claude Sonnet. Otherwise it falls back to gpt-4o-mini and surfaces a small banner offering the upgrade. The user picks one, asks for two more, or describes a refinement.

Step two, image. After copy is approved, the image step auto-fires. It uses an LLM-driven prompt builder that takes the brief, the approved copy, and any active image modifications, and produces a single-paragraph Flux Schnell prompt. The prompt goes to fal.ai which returns an image URL. Two variants are produced in parallel. The user picks one, asks for more, refines in plain English, or clicks Critique to get prose feedback from Claude Sonnet with vision.

Step three, script and voice. The user gets two script variants suited for a twenty to forty second spoken read. They pick one. Then a voice picker appears with the voices available in their ElevenLabs account. They pick a voice tone. Only after both script and voice are picked does the step move to approved.

Step four, audio. ElevenLabs synthesises the final read with the picked script and voice. The user listens through a waveform player and either approves or regenerates. Once approved, all four steps are complete and the final package view replaces the step view.

## The direction translator

The piece of the demo that is genuinely unusual is the direction translator. When the user types a refinement like "more cinematic" or "the guy should smile more", the demo does not pass that string to the image model. Instead it first calls the translator, a small LLM-powered function with hand-written few-shot examples, which converts the plain-language direction into a structured set of modifications shaped per asset type.

For copy, the translator returns an enriched direction, a list of words to avoid, and a list of qualities to emphasise.

For image, it returns concrete photographic terminology for lighting, composition, palette, mood, subject, background, energy, and a list of qualities to avoid.

For voice, it returns script tone, pace, delivery, emphasis, and voice character.

The translator is exposed standalone at the /?test=1 route as a harness that runs twenty test directions against all three asset types in a sixty-cell grid. This is the developer tool for tuning the few-shots. It is hidden from the main demo path.

## State machine and caching

The four steps are tracked as a record keyed by step id. Each step has a status of pending, generating, options, refining, or approved. A small set of derived selectors compute whether a step is unlocked, which step is active, and whether the whole flow is approved.

The state machine includes a variant cache. Each step has a hash computed from its inputs: the brief, the approved variant ids of every upstream step, and its own ordered refine history. When a step is about to generate, it first checks the cache for an entry under that hash. If found, the cached variants restore and the cascade rolls through to the next step. If not, the generation API is called and the result is written back to the cache.

This means a prospect who explores a path, backtracks, picks a different upstream variant, then backtracks again to the original upstream choice, will see the original path restore instantly with zero API calls. A small pill above the variant grid shows "Restored from your earlier choices, no regeneration" when the current step's variants came from cache.

The cache also handles downstream invalidation. When an upstream selection changes, the downstream steps reset their variants, selectedIndex, and critiques. The cache entries themselves are kept, so re-traversal hits cache rather than regenerating.

Audio caching runs in-memory only. The Blob and object URL backing the audio variant do not survive a page reload, so the audio step regenerates on reload while the earlier steps restore from sessionStorage.

## Voice library

Step three's voice picker has two modes.

If the visitor has an ElevenLabs key configured, the picker fetches their account's actual voices via GET /v1/voices and renders them as cards. While the fetch is in flight, a "Loading your ElevenLabs account voices…" panel is shown instead of the grid, so the visitor cannot accidentally pick a hardcoded fallback voice before the real list arrives. Each card uses the voice's name and category as labels. There is no prerecorded preview for these voices; the visitor picks by name and hears the result in the final render on step four.

If the visitor has no ElevenLabs key, or the fetch fails, the picker falls back to a hardcoded library of eight ElevenLabs voices. For these, prerecorded MP3 previews can be generated once by the demo owner and committed to the repo.

To generate the prerecorded previews

```
ELEVENLABS_API_KEY=your_key_here npm run record-voices
```

The script reads the eight voice ids and the shared sample sentence from src/data/voiceLibrary.ts, calls ElevenLabs TTS for each, and saves the resulting MP3s under public/voices. Commit the resulting MP3s so a fresh clone of the repo has working previews without needing the recording key.

If a particular hardcoded voice id is not in the demo owner's ElevenLabs account, the record-voices script prints a failure for that id and moves on. Ship whatever succeeded. The picker hides cards without prerecorded preview audio, so a partial set of voices is fine.

When the audio render fails because the picked voice is not in the visitor's account (which can happen if they picked a hardcoded fallback voice), the error surface includes a "← Pick a different voice" button that drops the visitor back to step three's voice picker, where their real account voices are loaded.

## Sample preset

The sample preset is the optional, owner-baked artefact that makes the first interaction in a sales demo instantaneous. Without it, the first visitor to the live URL must enter four API keys and wait thirty to sixty seconds for the first pipeline to run. With it, they click one button and see the entire pipeline restore from cache in under a second.

To bake a sample

One. Run the demo end-to-end in dev mode with the brief you want to ship. Approve all four steps until the final package renders.

Two. In the browser DevTools console, run

```
copy(JSON.stringify(useAppStore.getState()))
```

Paste the result into samples/source-state.json. This file is gitignored because it may include API keys from sessionStorage.

Three. Find the audio variant id in that state under variantCache, key starting with the prefix audio colon. Download the voiceover.mp3 from the FinalPackage download button. Rename the MP3 to that variant id and drop it at samples/audio/your-variant-id.mp3.

Four. Run

```
npm run bake-sample
```

The script fetches every cached image from fal.media, copies them to public/samples/images, copies the audio MP3 to public/samples/audio, rewrites every URL to a relative samples path, drops the audioBlob field, and writes public/samples/preset.json with three keys: brief, variantCache, and audioCache.

After the bake, commit and push. The next visitor sees a "Try sample brief and explore" button on the brief form and on the OnboardingState card. Click it and the entire pipeline restores from cache in milliseconds with zero network requests.

## Error handling

Every user-facing error string is sourced from src/services/errorMessages.ts. Services throw an AppError with a stable code (e.g. openai/auth-failed, eleven/voice-not-found, fal/network) and the InlineError component looks up the plain-language message via humanize(). Technical detail like "status 401: invalid_api_key" is logged to console.debug, not shown to the visitor.

Each error surface renders a "Try again" button and, when the failure is key-related, an "Open Settings" button. The voice-not-found case additionally renders a "Pick a different voice" button that drops back to step three.

## Graceful degradation

If the visitor is missing some keys, the demo continues gracefully where possible.

No OpenAI key. The OnboardingState card is shown instead of the brief form. The Settings drawer auto-opens once after 600ms.

No Anthropic key. The Critique button on each image variant is disabled with a tooltip explaining what is missing. Copy generation falls back to gpt-4o-mini and surfaces a small banner offering the upgrade. The rest of the flow works.

No ElevenLabs key, with sample preset baked. The audio step falls back to the sample preset audio and shows a banner reading "Demo audio shown, add ElevenLabs key for live generation". The visitor can still hear something, can still approve, can still get to the final package.

No ElevenLabs key, no sample preset. The audio step shows a clear error message asking for the key. This is the only hard dead-end if no preset has been baked.

## Demo flow

The first interaction in a prospect call should be the sample brief click. The full pipeline restores in under a second. The cache-restore pill flashes on each step as the cascade rolls through. The final package renders. The prospect understands the shape of the tool before they have entered anything.

After the sample, you backtrack to step one, type a refine like "more aggressive, less corporate", show two new copy variants. Pick one, the image cascade fires fresh, you refine again. Click Critique on an image to surface the Claude prose feedback. Apply it. Continue to script and voice, render audio, approve. Show the Director's Notes audit trail at the bottom of the final package. Download the zip.

The demo is intentionally a pipeline rather than a freeform generator. The user can only refine through plain language, never write a prompt. This is the design.

## Deployment

Two deployment paths have been tested.

Vercel (recommended for sharing with prospects). Connect the GitHub repository at https://vercel.com/new. Vercel auto-detects Vite from the included vercel.json. Automatic HTTPS on a vercel.app subdomain. Auto-deploys on every push to main. The deployed URL is what you share.

VPS or any static host. Run npm run build. Serve the contents of the dist directory with any static file server. The vite.config.ts has a preview block bound to 0.0.0.0 port 8080 for ad-hoc Windows VPS use. HTTPS is preferred because the crypto.randomUUID browser API requires a secure context. A polyfill is included for HTTP contexts so the demo works either way.

## Project structure

The top-level layout under demo-v2.

```
src/
  main.tsx              entry point
  polyfills.ts          crypto.randomUUID polyfill for HTTP contexts
  App.tsx               root component with stepper, brief form, settings drawer, debug panel, onboarding gate
  types.ts              shared types and variant union
  vite-env.d.ts         Vite client types
  styles/index.css      Tailwind v4 entry
  store/
    index.ts            combined store, persist config, derived selectors
    settings.slice.ts   API keys, settings drawer state, key validation
    brief.slice.ts      brief form state
    steps.slice.ts      step state machine, variant cache, downstream invalidation
    steps.slice.test.ts slice tests covering gating, cascade, invalidation, reopen
  components/
    Stepper.tsx           four-step progress at the top
    SettingsDrawer.tsx    slide-in panel with the four API key inputs
    BriefForm.tsx         initial form, sample preset button
    OnboardingState.tsx   first-impression welcome card when no OpenAI key
    StepShell.tsx         routes the visible step body based on active step
    CopyStep.tsx          step one (Sonnet when Anthropic key present, else 4o-mini)
    ImageStep.tsx         step two
    ScriptStep.tsx        step three with script picker and voice picker phases
    VoicePicker.tsx       voice tone grid (user-account voices, gated loading state)
    AudioStep.tsx         step four (with voice-not-found recovery button)
    FinalPackage.tsx      final assembled view with download button
    DirectorsNotes.tsx    prose audit trail summary
    WaveformPlayer.tsx    wavesurfer.js wrapper for the audio player
    CacheRestorePill.tsx  small restored-from-cache indicator
    InlineError.tsx       shared error surface with plain-language strings + recovery actions
    TranslatorHarness.tsx the test-route dev tool
  services/
    openaiClient.ts      shared chat completions JSON helper
    anthropicClient.ts   Anthropic Messages helper, tool-use for structured JSON
    llmService.ts        generateCopy, generateImages, generateScript, validation
    translator.ts        direction translator, three system prompts
    imagePromptBuilder.ts builds Flux prompts from brief plus copy plus mods
    critiqueService.ts   Anthropic Sonnet with vision for image critique
    audioService.ts      ElevenLabs TTS for the final render
    voicesService.ts     fetches the visitor ElevenLabs account voices
    sampleLoader.ts      loads and applies the sample preset
    exportService.ts     builds the download zip
    stepHash.ts          hash function for the variant cache
    stepHash.test.ts     tests for the hash function
    directorsNotes.ts    builds the audit trail data and markdown
    directorsNotes.test.ts tests for the markdown generator
    errorMessages.ts     AppError class and plain-language message lookup
  data/
    voiceLibrary.ts      hardcoded fallback voice list and resolveVoice helper
    voiceLibrary.test.ts tests for resolveVoice
  test/
    fixtures.ts          typed factories for AppState test doubles
scripts/
  record-voices.ts       generates the prerecorded voice samples
  bake-sample.ts         bakes a finished run into the sample preset
public/
  samples/               generated by bake-sample, served as static
  voices/                generated by record-voices, served as static
```

## Tests

Vitest runs the unit tests for the pure-function modules and the store slice.

```
npm test           run once
npm run test:watch run in watch mode
```

Current coverage, 57 tests across four files:

- src/services/stepHash.test.ts pins down the five spec assertions from D7 (idempotence, brief invalidation, copy.selectedIndex invalidation of downstream, voice scoped to audio only, image-refine scoped to image's own hash) plus the six history-kind contribution rules and output-format edges.

- src/services/directorsNotes.test.ts covers the brief block, typed-refine vs applied-critique separation, regenerate counting, markdown rendering with refinement bullets, "_None_" fallback for steps approved without refinement, and the regenerate parenthetical.

- src/data/voiceLibrary.test.ts covers resolveVoice — the helper that synthesizes a VoiceSample from voice-pick history when the stored id is a user-account voice not in the hardcoded library. Hardcoded library hits, history fallback, most-recent-wins, and synthetic fallback.

- src/store/steps.slice.test.ts covers the state machine architecture invariants from D7: isStepUnlocked gating (all locked before brief, only copy after submit, sequential cascade), activeStepId derivation, the cascade chain through all four steps to allApproved, downstream invalidation rules (selection change clears, first-time pick does not, same selection does not, voice change clears audio only), the append-vs-replace distinction, and reopenStep semantics for script versus other steps.

Test fixtures live at src/test/fixtures.ts and provide a typed factory for building AppState test doubles. Use that factory rather than constructing state literals by hand — it keeps test setup short and isolates type changes to one file.
## Known limitations

The deployed JavaScript bundle is readable. The translator system prompts, which are the only meaningful IP in this codebase, are visible to anyone who opens the network panel. For a one-to-one prospect demo this is fine. For wider sharing, Vercel Pro password-protected previews are the right answer.

The Settings drawer's validate button hits real provider endpoints. fal.ai's validation does a zero-cost POST with an empty body that produces a 422 response on a valid key. This is intentional but does consume one API request per click. The other three providers use cheap GET endpoints.

The audio Blob does not persist across page reloads. A reload mid-flow drops the audio variant and triggers a regeneration on next entry to the audio step. This is by design because Blobs do not survive JSON serialisation. A reload at the final-package state means the audio re-renders against ElevenLabs, which has a small but real cost; documented and accepted.

The hardcoded voice library uses ElevenLabs voice ids from the original premade catalog. Not every account has all of them anymore. The runtime prefers the visitor's actual account voices when an ElevenLabs key is configured; the hardcoded list exists only as a preview-only fallback for visitors without keys. If a visitor somehow picks a hardcoded voice that their account does not have, the audio step's voice-not-found recovery button drops them back to the picker, where their real voices are loaded.

The sample preset is owner-baked, not user-generated. There is intentionally no save-this-session-as-a-sample UI. The bake-sample script is a developer tool, not an end-user feature.

## License

Private. No license granted.
