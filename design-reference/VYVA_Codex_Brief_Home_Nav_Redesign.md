# VYVA Codex Brief — Home Screen & Navigation Redesign
# Layers: Design Tokens · Voice Orb Engine · Screen Components · Navigation Architecture

---

## 0. CONTEXT FOR CODEX

**STEP ONE, BEFORE ANYTHING ELSE:** open and read these two files in full — they are not optional background reading, they contain the exact values (colors, spacing, copy, animation timings, state logic) this brief refers to throughout:
- `design-reference/vyva_home_redesign_v5.html`
- `design-reference/preview_7_checkin_desktop.html`

If either path doesn't exist in this repo, stop and ask where they were placed before proceeding — do not guess at values described only as "see prototype."

---

You are rebuilding VYVA's B2C senior-facing Home screen and the five destination screens reachable from it (Health, My Brain, Community, Concierge, My Reports), plus Profile and a Menu screen. This replaces the current production Home (voice button + weather + 2×2 pillar grid + Home/SOS/Reports bottom nav).

**Reference artifact:** an approved interactive prototype at `design-reference/vyva_home_redesign_v5.html` (read in Step One above). It is a vanilla-JS mockup, not production code — it exists to specify exact visual behavior, spacing, copy, and state transitions. Codex must reimplement it as React/TypeScript components matching the existing VYVA stack (React, TypeScript, Vite, TanStack Query where data-fetching applies), not port the vanilla JS as-is.

**Design intent (read before building):** VYVA is voice-first. The Home screen is not a data dashboard — it is a companion presence (a single breathing "orb") with one rotating message at a time, not a grid of simultaneous widgets. Every detail screen underneath it follows the same pattern: a compact orb for in-place voice interaction, short default text, hairline-separated list rows instead of boxed cards, and no duplicate navigation systems.

Design constraints (carried over from prior briefs):
- Target users are 65+. All touch targets minimum 56–64px. Body text minimum 16px, primary text 17–23px.
- No small text, no complex menus, no multi-step instructions.
- Confirm actual Supabase table/column names before writing any data-fetching code — do not assume the field names implied by the mockup's placeholder data.
- Every screen must work in portrait on a tablet (768px width minimum) and on standard phone widths (~390–430px).

---

## 1. DESIGN TOKENS

```css
--purple: #7C3AED;
--purple-deep: #5B21B6;
--purple-deeper: #33125E;
--gold: #E8A33D;
--red: #E05B52;
--blue: #2F66D0;
--green-deep: #0F7A50;
--ink: #241C30;
--ink-soft: #8A8095;
--page-bg-a: #F2EAFB;  /* afternoon default */
--page-bg-b: #FAF7F2;
```

**Time-of-day theming:** the page background gradient and hero/orb gradient shift by time of day (morning/afternoon/evening/night — see prototype `body[data-time="..."]` rules). Implement as a small hook (`useTimeOfDay()`) returning a token set, applied via CSS variables or a theme context — not hardcoded per-component.

**Typography:** Fraunces (serif, weights 500/600/700, optical size axis) for headlines, questions, and screen titles. Figtree (weights 500/600/700/800) for body/UI text. **Codex: confirm whether these fonts are already self-hosted in the project or need to be added — do not load from Google Fonts CDN in production; self-host per existing asset pipeline.**

**Icon system: use `lucide-react`, do not build a custom icon set.** The prototype's inline `ICON` object (heart, brain, people, bell, pill, chat, car, phone, sun, flame, menu, reports, home) was built as a reference set for a standalone mockup with nothing to import from — every one of those is a standard shape `lucide-react` (already the project's established icon library) covers well. Map the prototype's icon list to `lucide-react` equivalents (e.g. `Heart`, `Brain`, `Users`, `Bell`, `Pill`, `MessageCircle`, `Car`, `Phone`, `Sun`, `Flame`, `Menu`, `FileText`, `Home`). Only fall back to a custom SVG for a specific icon if no reasonable `lucide-react` equivalent exists.

---

## 2. VOICE ORB ENGINE (shared across every screen)

This is the single most important piece of shared logic — six independent orb instances exist (Home + five detail screens), all driven by the same state machine. Build this **once** as a reusable hook, not copy-pasted per screen.

### Hook: `useVoiceOrb()`

```typescript
type OrbState = 'idle' | 'listening' | 'responding';

interface VoiceOrbTarget {
  onStateChange: (state: OrbState) => void;
  onCaptionChange: (caption: string) => void;
  onTextReveal: (html: string) => void; // called with progressively-revealed HTML during 'responding'
}

function useVoiceOrb(target: VoiceOrbTarget) {
  function startListening(responseText?: string, opts?: {
    idleCaption?: string;
    onIdle?: () => void;
  }): void
}
```

**Sequence (see prototype `startListeningOn` / `revealInSyncOn` for exact timings and reference implementation):**
1. **Listening** (~2.2s): orb visual shifts to gold ripple state, caption reads "Listening…", associated text area dims to ~30% opacity.
2. **Processing** (~650ms): caption reads "One moment…".
3. **Responding**: orb shifts to purple glow state, caption reads "VYVA", response text reveals **word-by-word at ~230ms/word**, with additional pause after words ending in `,` (+160ms) or `.`/`!`/`?` (+280ms) — this is a synced-caption effect simulating speech pacing. **Codex: if a real TTS/voice engine (ElevenLabs) is wired to this component, replace the fixed-pace reveal with word-boundary timestamps from the TTS response instead of the estimated pacing — the fixed pacing is a placeholder for when there's no real audio to sync to.**
4. **Hold** (~1.7s): response stays visible.
5. **Idle**: orb returns to resting breathing state, caption returns to its default (e.g., "Tap to ask VYVA" or "Tap the circle to talk"), calling screen's `onIdle` callback fires (e.g., Home resumes its rotating-message cycle; detail screens restore their default status text).

**Orb visual states (CSS, not JS-driven animation):**
- **Idle:** slow 10s breathing scale animation (1.0 → 1.035 → 1.0), soft purple radial gradient fill, faint ambient glow.
- **Listening:** gold ripple rings expanding outward (3 staggered rings, 1.8s cycle, 0.5s/1s delay offsets), mic icon replaced by 5 animated level-bars.
- **Responding:** purple glow pulses slightly faster (2s cycle) than idle breathing; ripple rings still present but purple-tinted.
- **Reduced motion:** respect `prefers-reduced-motion` — disable all looping animations, keep state colors/icons static.

**Home screen's orb also drives the rotating "moment" feed** (see §3) — pausing that rotation's `setInterval` on listening-start and resuming it via `onIdle`. Detail-screen orbs do not have a rotation to pause; their `onIdle` simply restores static default text.

---

## 3. HOME SCREEN

### Layout (top to bottom)
1. **Top bar:** profile icon (left, opens Profile), date label (left, next to profile), hamburger menu icon (right, opens Menu). No page title.
2. **Greeting:** short, time-aware ("Good morning, Carmen." / afternoon / evening), Fraunces serif, ~32px.
3. **Talk-to-VYVA orb:** centered, ~172px diameter, uses `useVoiceOrb()`. Default caption: **"Tap the circle to talk"** — do not use "or just start talking" unless true open-mic/wake-word listening is actually implemented; confirm with product before shipping that copy.
4. **Rotating "moment" card:** one message at a time (not a list), auto-advances every ~8.5s, tap-to-act (see below), small position dots (non-interactive, visual only), no manual prev/next buttons in the current approved version.
5. **No persistent 2×2 pillar grid on Home** — this was deliberately removed in favor of the Menu screen (§7).
6. **Bottom dock:** exactly 3 items — **Home, SOS, Reports** (see §8).

### Rotating moment data shape (Codex: confirm real source per row before wiring)
```typescript
interface HomeMoment {
  urgent?: boolean;
  tag?: string; // e.g. "Now" — shown as a small amber pill above urgent moments
  html: string; // the moment's message, may include <b> for emphasis
  action: 'listen' | 'open' | 'none';
  dest?: 'Health' | 'My Brain' | 'Community' | 'Concierge'; // required if action === 'open'
  response?: string; // required if action === 'listen' — VYVA's spoken reply when this moment is tapped
}
```
- `action: 'open'` → tapping navigates directly to that screen (bypassing Menu).
- `action: 'listen'` → tapping triggers `startListening(moment.response)` in place on Home.
- `action: 'none'` → tapping does nothing (e.g., a passive weather or social check-in note).
- Moments with `urgent: true` should sort first in the rotation. **Codex: BOSS confirmed a ranking engine already exists server-side — wire moment priority/selection to that engine's output rather than the static array in the prototype.**

**Data sources to confirm before wiring (do not assume table names):**
- Vitals summary → likely the Vitals Monitoring pillar table.
- Medication reminder → `my_medicines`.
- Community message → community rooms/messages table.
- Concierge booking → `appointment_booking_config`.
- Streak/brain stats → `rhythm_tap_sessions` / `rhythm_tap_user_state`.

---

## 4. HEALTH SCREEN

- **Hero:** compact orb (~118px, smaller than Home's), default caption "Tap to ask VYVA", default status text short (e.g., "Right where it usually is — steady all day."). Orb tap and the oxygen alert's "Recheck" action both use the **same in-place `useVoiceOrb()` instance** — voice must not redirect to Home from this screen.
- **Preventive check-in entry row:** calm lavender background row, "Quick check-in / A gentle preventive check with VYVA", opens the Check-in flow (see separate brief `VYVA_Codex_Brief_CheckIn_Flow.md`).
- **Vital rows (hairline-separated, not boxed cards):** Heart rate, Oxygen, Medication (name + last-taken + next-due time), then an amber-tinted alert row only when a reading is out of range (e.g., "Oxygen — this morning: a little lower than usual").
- **Progressive disclosure:** a "Show 2 more metrics" toggle reveals Blood Pressure and Sleep inline (CSS max-height transition, no navigation) rather than either hard-capping the list or growing it indefinitely. Additional metrics later should extend this same toggle, not add new screens.
- **Trend chart:** lead with an **interpreted sentence** ("Your heart rate has stayed close to normal all week — today's the steadiest yet."), with a small secondary sparkline (thin line + highlighted endpoint, ~40px tall, muted 55% opacity) below it — the sparkline is supporting detail, not the headline. Do not present raw unlabeled bar charts as the primary treatment; this was an explicit fix from an earlier iteration (Apple Health-style raw dashboards test poorly with this audience — see design rationale doc if available).

---

## 5. MY BRAIN / COMMUNITY / CONCIERGE / MY REPORTS

All four follow the **same hero pattern as Health**: compact in-place orb, short default text, no full-sentence "Ask VYVA to..." button (the orb tap itself is the CTA). Each screen's orb has a unique response string appropriate to that screen's content (see prototype `wireScreenOrb()` calls for exact copy).

- **My Brain:** default text "Five days strong — keep it going." Game rows (Rhythm Tap, Face-Name Match, Mood check-in) with Play/Check-in actions. Trend section for Rhythm Tap accuracy follows the same interpreted-sentence + sparkline pattern as Health's heart-rate trend.
- **Community:** default text "Elena replied in your Book Club room." Room rows with last-message preview and unread indicator (small colored dot, not a numeric badge).
- **Concierge:** default text "Your ride to Dr. Reyes is confirmed." Booking rows (ride, pharmacy refill, grocery delivery) with status dots (green = confirmed, amber = pending).
- **My Reports:** default text "A good week, Carmen." Plain-language weekly recap rows (steps, Rhythm Tap average, conversations, appointments kept) — this is Carmen's own recap, not a caregiver-facing report; confirm with product before pulling in any clinical/caregiver-report data source.

---

## 6. PROFILE SCREEN

- Hero: avatar circle with initial, name, location.
- **"Who's looking out for you"** section: caregiver/care-team rows (e.g., family member, care team member) each showing what they can see, with a "Manage" action per row. This is the one place caregiver-visibility settings are surfaced — do not duplicate this elsewhere.
- **"Make VYVA easier to use"** section: text size, voice pace/language, reminder gentleness — these should be real, working accessibility settings, not decorative rows.
- A de-emphasized (gray, not purple) "Call support" action at the bottom — this connects to a human, and is intentionally lower-visual-priority than the VYVA voice interactions elsewhere.

---

## 7. MENU SCREEN

Flat list, **no category headers/grouping** — this was explicitly decided against during design review (a 4-item list is short enough that grouping adds a parsing question — "is Health under Wellbeing?" — without earning its keep). **Menu tile count is settled at 4: Health, My Brain, Community, Concierge.** My Reports was deliberately relocated out of Menu and into the bottom dock (§8) in a later design revision specifically so it wouldn't compete with these four for space — do not add it back to Menu.

Each row: icon chip, title, one-line description, chevron. Full-width tappable rows, ≥80px min-height.

---

## 8. NAVIGATION ARCHITECTURE

**This is the part most likely to drift if not followed exactly — read carefully.**

- **Bottom dock (persistent on Home, Reports, and visible-but-inactive on Health/Brain/Community/Concierge/Menu): 3 items — Home, SOS, Reports.**
  - Home: jumps to the Home screen from any depth. **When already on Home, render this icon visibly inert** (muted gray, no highlight, not clickable) rather than an active-looking button that does nothing — this was a specific fix for a real usability confusion caught in design review.
  - SOS: existing emergency action — **locate and reuse the exact same handler/function the current production SOS button already calls; do not write a new implementation.** Visually: raised, red, distinct from the other two dock items.
  - Reports: jumps directly to My Reports from anywhere.
- **Menu is NOT in the bottom dock** — it lives behind the **hamburger icon in the Home screen's top-right corner**. This was a deliberate late-stage revision (an earlier version put Menu in the dock; it was moved to free up dock space and because Reports needed dock-level prominence as a daily-use screen, while Health/Brain/Community/Concierge are browsed less frequently).
- **Back-button routing (top-left arrow on every detail screen) is hierarchical, not a flat "always go Home":**
  - Health / My Brain / Community / Concierge → Back goes to **Menu** (their parent).
  - Menu / My Reports / Profile → Back goes to **Home**.
- **Profile is not part of Menu and not part of the dock** — it's reached only via the top-left profile icon on Home, and is a peer of Menu in the navigation hierarchy (both go back to Home), not a child of it.

**Codex: implement navigation with a proper router (React Router or existing app convention) reflecting this hierarchy — do not hardcode `goToScreen()`-style imperative screen-swapping as in the prototype; that pattern exists there only because it's a single-file vanilla-JS mockup.**

---

## 9. INTEGRATION CHECKLIST

- [ ] `useVoiceOrb()` hook implemented once, used by all 6 orb instances (Home + 5 detail screens)
- [ ] Fonts self-hosted, not loaded from Google Fonts CDN in production — confirm whether Fraunces/Figtree already exist as local assets in the project; if not, add them
- [ ] All icons implemented via `lucide-react`, no custom SVG icon set unless a specific icon has no reasonable equivalent
- [ ] Time-of-day theming implemented as a hook/context, not hardcoded per screen
- [ ] Home's rotating moment feed wired to the real ranking engine (not the static prototype array)
- [ ] All data sources (vitals, medication, community, concierge, brain stats) confirmed against actual Supabase table/column names before wiring
- [ ] Health's trend chart uses interpreted-sentence-first pattern, not raw bars
- [ ] Progressive disclosure ("Show more metrics") implemented for Health, extensible for future metrics without adding new screens
- [ ] Back-button routing matches the hierarchy in §8 exactly (Health/Brain/Community/Concierge → Menu; Menu/Reports/Profile → Home)
- [ ] Dock is exactly 3 items (Home, SOS, Reports); Home renders inert on the Home screen itself
- [ ] Menu is reached only via the hamburger icon, contains exactly 4 flat tiles (no category headers)
- [ ] All touch targets ≥56px, body text ≥16px, verified on a real device at 390px and 768px widths
- [ ] `prefers-reduced-motion` disables orb/ripple animations app-wide
- [ ] No emoji anywhere in production copy or iconography

---

*Brief version: 1.0 | Scope: Home + Health + My Brain + Community + Concierge + My Reports + Menu + Profile | Stack: React · TypeScript · Vite · Supabase*
*Reference: vyva_home_redesign_v5.html (approved interactive prototype)*
*Companion brief: VYVA_Codex_Brief_CheckIn_Flow.md*
