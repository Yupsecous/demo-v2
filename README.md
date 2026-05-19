# Director's Cockpit Demo

A browser-only ad creative pipeline for marketing agencies. One brief, four sequential steps (copy, image, script, audio), where the user directs each step in plain English instead of writing prompts. Built for sales demos that show what marketing-asset generation looks like when the human stays in charge.

## What the demo does

The user fills in a three-line brief (product, audience, ad angle) and walks through four steps. Each step generates two variants. The user either picks one or types a refinement in plain English ("more aggressive, less corporate", "lighter background, more energy"). A translator layer converts those plain-language directions into structured modifications under the hood, so the user never writes a prompt.

After all four steps, a final package view assembles the assets along with a Director's Notes audit trail that summarises every refinement, critique, and pick. A download button packages the four assets into a zip file ready to hand off.

## Stack

Front end runtime

- Vite 5 with React 18 in TypeScript strict mode
- Tailwind CSS v4 via the dedicated Vite plugin
- Zustand for state, split into settings, brief, and steps slices, combined in a single store

Build tools

- TypeScript 5
- tsx for running Node scripts in TypeScript without a build step

Browser libraries

- wavesurfer.js for the audio waveform player on steps three and four
- jszip for building the final download package
- zod for runtime schema validation of every JSON response from the LLM endpoints

External APIs called directly from the browser

- OpenAI Chat Completions for copy, script, image prompt builder, and the direction translator
- Anthropic Messages for the optional image critique with vision
- fal.ai for Flux Schnell image generation
- ElevenLabs for the final voice rendering

No backend. No server-side proxy. All keys live in the visitor's browser sessionStorage. The demo opens directly from a static build.

## API keys

Four providers are involved. The keys all go into the Settings drawer in the running app, never into source code or environment variables shipped to end users.

OpenAI. Used by every step. Without it nothing generates. Get a key at https://platform.openai.com/api-keys.

fal.ai. Used for image generation. Without it the image step fails. Get a key at https://fal.ai/dashboard/keys. The key format is a UUID, a colon, and a hex string, all together as one value.

ElevenLabs. Used for the final voice render and for the optional voice-library prerecording script. Without it the audio step fails unless the sample preset has been baked, in which case it falls back to demo audio. Get a key at https://elevenlabs.io/app/settings/api-keys.

Anthropic. Used only for the optional image critique. Without it the Critique button on each image variant is disabled with an inline hint. Rest of the demo works. Get a key at https://console.anthropic.com/settings/keys.

Keys live in the visitor's browser sessionStorage. They are cleared when the tab closes. They are not transmitted to any server other than the four providers above. They are not bundled into source code or environment variables shipped to end users. Every visitor enters their own keys. The demo owner does not pay for visitor usage.

## Setup

Clone the repository, install dependencies, run the dev server.

```
git clone https://github.com/Yupsecous/demo-v2.git
cd demo-v2
npm install
npm run dev
```

The dev server prints a local URL. Open it in a browser. The brief form is the entry point.

## Available scripts

```
npm run dev            start the Vite dev server with HMR
npm run build          produce a production build under dist
npm run preview        serve the production build on 0.0.0.0 port 8080
npm run typecheck      run tsc without emitting
npm run record-voices  generate the prerecorded voice tone samples (one-time)
npm run bake-sample    bake a finished run into a static demo preset (one-time)
```

## How the four steps work

Step one, copy. The user submits the brief. The copy step auto-fires a call to OpenAI which returns two variants of headline, caption, and call-to-action. The user picks one, or asks for two more, or describes a refinement.

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

If the visitor has an ElevenLabs key configured, the picker fetches their account's actual voices via GET /v1/voices and renders them as cards. Each card uses the voice's name and category as labels. There is no prerecorded preview for these voices. The visitor picks by name and hears the result in the final render on step four.

If the visitor has no ElevenLabs key, or the fetch fails, the picker falls back to a hardcoded library of eight legacy ElevenLabs voices. For these, prerecorded MP3 previews can be generated once by the demo owner.

To generate the prerecorded previews

```
ELEVENLABS_API_KEY=your_key_here npm run record-voices
```

The script reads the eight voice ids and the shared sample sentence from src/data/voiceLibrary.ts, calls ElevenLabs TTS for each, and saves the resulting MP3s under public/voices. Run this once. The files become part of the static build. There is no runtime cost.

If the script's voices are not in the demo owner's ElevenLabs account, the script will fail per missing voice. Adding the named voices at https://elevenlabs.io/app/voice-library is the fix.

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

After the bake, commit and push. The next visitor sees a "Try sample brief and explore" button on the brief form. Click it and the entire pipeline restores from cache in milliseconds with zero network requests.

## Graceful degradation

If the visitor is missing some keys, the demo continues gracefully where possible.

No Anthropic key. The Critique button on each image variant is disabled with a tooltip explaining what is missing. The rest of the flow works.

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
  App.tsx               root component with stepper, brief form, settings drawer, debug panel
  types.ts              shared types and variant union
  vite-env.d.ts         Vite client types
  styles/index.css      Tailwind v4 entry
  store/
    index.ts            combined store, persist config, derived selectors
    settings.slice.ts   API keys, settings drawer state, key validation
    brief.slice.ts      brief form state
    steps.slice.ts      step state machine, variant cache, downstream invalidation
  components/
    Stepper.tsx         four-step progress at the top
    SettingsDrawer.tsx  slide-in panel with the four API key inputs
    BriefForm.tsx       initial form, sample preset button
    StepShell.tsx       routes the visible step body based on active step
    CopyStep.tsx        step one
    ImageStep.tsx       step two
    ScriptStep.tsx      step three with script picker and voice picker phases
    VoicePicker.tsx     voice tone grid
    AudioStep.tsx       step four
    FinalPackage.tsx    final assembled view with download button
    DirectorsNotes.tsx  prose audit trail summary
    WaveformPlayer.tsx  wavesurfer.js wrapper for the audio player
    CacheRestorePill.tsx small restored-from-cache indicator
    TranslatorHarness.tsx the test-route dev tool
  services/
    openaiClient.ts     shared chat completions JSON helper
    llmService.ts       generateCopy, generateImages, generateScript, validation
    translator.ts       direction translator, three system prompts
    imagePromptBuilder.ts builds Flux prompts from brief plus copy plus mods
    critiqueService.ts  Anthropic Sonnet with vision for image critique
    audioService.ts     ElevenLabs TTS for the final render
    voicesService.ts    fetches the visitor ElevenLabs account voices
    sampleLoader.ts     loads and applies the sample preset
    exportService.ts    builds the download zip
    stepHash.ts         hash function for the variant cache
    directorsNotes.ts   builds the audit trail data and markdown
  data/
    voiceLibrary.ts     hardcoded fallback voice list
scripts/
  record-voices.ts      generates the prerecorded voice samples
  bake-sample.ts        bakes a finished run into the sample preset
public/
  samples/              generated by bake-sample, served as static
  voices/               generated by record-voices, served as static
```

## Tests

Vitest runs the unit tests for the pure-function modules.

```
npm test           run once
npm run test:watch run in watch mode
```

Current coverage is focused on the two highest-value pure functions: the variant cache hash (src/services/stepHash.ts) and the Director's Notes markdown generator (src/services/directorsNotes.ts). The hash tests pin down the five spec assertions from D7 plus edge cases around which history-entry kinds contribute to the hash. The Director's Notes tests cover the brief block, refinement listings, critique-applied separation, regenerate counting, and the "_None_" rendering for steps approved without refinement.

Test fixtures live at src/test/fixtures.ts and provide a typed factory for building AppState test doubles. Use that factory rather than constructing state literals by hand — it keeps test setup short and isolates type changes to one file.

## Known limitations

The deployed JavaScript bundle is readable. The translator system prompts, which are the only meaningful IP in this codebase, are visible to anyone who opens the network panel. For a one-to-one prospect demo this is fine. For wider sharing, Vercel Pro password-protected previews are the right answer.

The Settings drawer's validate button hits real provider endpoints. fal.ai's validation does a zero-cost POST with an empty body that produces a 422 response on a valid key. This is intentional but does consume one API request per click. The other three providers use cheap GET endpoints.

The audio Blob does not persist across page reloads. A reload mid-flow drops the audio variant and triggers a regeneration on next entry to the audio step. This is by design because Blobs do not survive JSON serialisation.

The hardcoded voice library uses legacy ElevenLabs voice ids that new accounts do not get by default. The runtime falls back to those if it cannot fetch the visitor's account voices. If the demo owner wants the hardcoded names to work for prospects without keys, the named voices must be added at the demo owner's ElevenLabs account before running the record-voices script.

The sample preset is owner-baked, not user-generated. There is intentionally no save-this-session-as-a-sample UI. The bake-sample script is a developer tool, not an end-user feature.

## License

Private. No license granted.
