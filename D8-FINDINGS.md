# D8 Findings — Three-Brief Test Pass

Run three end-to-end briefs before declaring D8 done. For each: complete pipeline (brief → copy → image → script → voice → audio), at least one refine per step, at least one critique on an image, download the zip, open it.

Fill in the templates below as you go. Anything in `[brackets]` is a placeholder for what you observed.

---

## Brief 1 — Prospect-specific vertical

**Inputs**
- Product: `[product name]`
- Audience: `[audience]`
- Angle: `[angle]`

**Refines tried**
- Copy: `[direction]` → `[did it land? yes/no/partial]`
- Image: `[direction]` → `[did it land?]`
- Script: `[direction]` → `[did it land?]`

**Critique reading**
> `[paste the critique prose here]`

Voice picked: `[name — tone label]`
Audio attempts: `[1 / 2 / 3]`
Zip opened cleanly: `[yes/no]`

**Notes**
- `[anything that felt off]`

---

## Brief 2 — Adjacent vertical

**Inputs**
- Product: `[product name]`
- Audience: `[audience]`
- Angle: `[angle]`

**Refines tried**
- Copy: `[direction]` → `[result]`
- Image: `[direction]` → `[result]`
- Script: `[direction]` → `[result]`

**Critique reading**
> `[paste]`

Voice picked: `[name — tone label]`
Audio attempts: `[n]`
Zip opened cleanly: `[yes/no]`

**Notes**
- `[…]`

---

## Brief 3 — Deliberately weird

**Inputs**
- Product: `[niche/edge-case product]`
- Audience: `[narrow or unusual audience]`
- Angle: `[contrarian or unusual]`

**Refines tried**
- Copy: `[direction]` → `[result]`
- Image: `[direction]` → `[result]`
- Script: `[direction]` → `[result]`

**Critique reading**
> `[paste]`

Voice picked: `[name — tone label]`
Audio attempts: `[n]`
Zip opened cleanly: `[yes/no]`

**Notes**
- `[…]`

---

## Issues found

Tag each as **fix-today** (ship-blocking) or **known-issue** (acceptable for first demo, fix later).

| # | Description                                       | Where                | Tag         |
| - | ------------------------------------------------- | -------------------- | ----------- |
| 1 | `[e.g. "more cinematic" copy refine reads stiff]` | `[CopyStep refine]`  | known-issue |
| 2 |                                                   |                      |             |

---

## Demo-day readiness sign-off

After running all three:

- [ ] All three briefs complete end-to-end without crashes
- [ ] Refines visibly land on all three briefs
- [ ] Critiques read in the demanded voice on all three
- [ ] Sample brief restores in under 1 second with zero network calls
- [ ] Zip downloads contain all four files in all three cases
- [ ] Director's Notes reads like prose, not JSON
- [ ] Backtrack from final package works and restores cleanly
- [ ] No console errors during any run-through

If any box is unchecked, fix it before the prospect call. If a fix would take longer than 30 minutes and isn't ship-blocking, log it as known-issue and proceed.
