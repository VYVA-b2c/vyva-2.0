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

**Current approved simplification after visual review:** the production-bound Home/Menu/Health/Profile polish pass is a calmer action-hub treatment, not the full data-dashboard prototype. Home uses a VYVA/profile control on the left and a manual-mode hand control on the right. The hand opens the 4-item Menu. The Menu and Health action hub use the same row language, icon scale, shell width, topbar geometry, and dock placement. Health intentionally does **not** lead with live heart-rate/oxygen/trend widgets in this pass; it leads with the same compact top-right mic mode-switch used by Menu/Profile plus four clear destinations: My Health Plan, Symptom Check, Vitals Scan, and Medicines. Live metric dashboards, the full compact response strip, and real data wiring remain deferred until the corresponding backend/data source work is approved.

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

## 1B. DARK MODE — TOKEN SWAP ONLY, NOT A SEPARATE BUILD

VYVA supports user-selectable light/dark mode (not the Zamora-deployment dark theme — this is a standard B2C preference toggle). **Light and dark must be the exact same components, screens, and content — only the color token values change.** A dark-mode screen introducing a different component (a button instead of the orb), a different layout (boxed cards instead of hairline rows), or missing content that the light version has is a bug, not a valid dark variant.

**Correction on a specific regression already caught in review:** dark mode must not introduce a separate layout, separate component set, or missing/extra content relative to light mode. For the current Health action-hub pass, that means the four Health rows, top controls, dock, spacing, and route behavior must remain identical across light/dark; only color tokens may change. Future live metrics/trend work must follow the same token-swap rule if it is reintroduced.

```css
/* Dark mode tokens — same structure as the light tokens above, dark values */
--ink-dark: #F2EDF8;           /* was --ink: #241C30 */
--ink-soft-dark: #A79DBB;      /* was --ink-soft: #8A8095 */
--card-dark: #251C33;          /* was white cards */
--page-bg-a-dark: #1A1226;     /* was --page-bg-a: #F2EAFB */
--page-bg-b-dark: #120C1C;     /* was --page-bg-b: #FAF7F2 */
--hairline-dark: #382B4A;      /* was #EFE9F7 */
--purple-dark: #A78BFA;        /* brightened for dark-bg contrast, was #7C3AED */
--green-deep-dark: #4ADE9E;    /* brightened, was #0F7A50 */
--red-dark: #F0847C;           /* brightened, was #E05B52 */
--amber-bg-dark: #3A2E1A;      /* was #FBF1E3 */
```

**Codex: verify contrast ratios meet WCAG AA (4.5:1 minimum for body text) against the dark backgrounds above — brightened accent colors are a starting point, not verified final values.** The orb's gradient, ripple, and glow states should shift to the brightened purple but keep identical animation timing/behavior to light mode.

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

  function cancelListening(): void
  // Cancels immediately back to idle from either 'listening' or 'responding'.
  // Calls the same onIdle as a natural completion would (e.g. Home resumes
  // its rotation, detail screens restore default text) — cancel and natural
  // completion should look identical once idle, only how you got there differs.

  isActive: boolean // true whenever state !== 'idle'
}
```

**Confirmed decision: tapping the orb again while it is `listening` or `responding` cancels back to idle immediately — it does not restart the sequence.** This was an explicit gap in an earlier version: the only way to recover from an accidental orb tap was to wait out the full ~4s sequence. The orb's own tap handler should check `isActive` and call `cancelListening()` instead of `startListening()` when already active:

```typescript
// Reference pattern (see design-reference/vyva_home_redesign_v5.html,
// search for cancelListeningOn — every orb instance in the prototype
// implements this toggle, not just Home's):
onOrbTap = () => {
  if (voiceOrb.isActive) voiceOrb.cancelListening();
  else voiceOrb.startListening(responseText);
};
```

**Implementation note on why this needs care:** if `startListening()` is called again while already active (rather than cancel), and the implementation recreates its internal state/target on every call instead of using one stable reference across calls, cancel has nothing to check against — this was a real bug caught while implementing the reference prototype. Ensure whatever holds "is this orb currently active" state (a ref, a piece of component state, whatever the codebase's convention is) persists across renders/calls for a given orb instance, not recreated per tap.

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

## 2B. COMPACT VOICE TRIGGER (for screens with no dedicated response area)

Home gets the full 172px orb. Every non-Home prototype surface in this polish pass uses the compact mic instead: Health, My Brain, Community, Concierge, My Reports, Menu, and Profile. The compact mic is a **mode return**: tapping it leaves the manual/settings/action-hub/detail surface and returns to the Home voice surface. It must not route to Menu, Profile, login, or any unrelated destination.

**Pattern: a small persistent trigger in the topbar that returns to Home voice mode**, not a scaled-down orb-hero.

- **Trigger:** 42px circle, top-right of the topbar (same position/weight as the Home manual-mode hand control, or the spacer on other detail-screen topbars) — sized to match ordinary topbar chrome, not to compete visually with the screen's content. Idle: purple circular fill with white mic icon, matching the Home hand control treatment.
- **Behavior:** tap returns to `/dev/home-master` in the prototype and to the Home voice surface in production. If voice capture/session is already active and the user switches from voice to manual via the hand control, the real integration must stop or suspend capture/session; it must not leave the microphone or ElevenLabs session running in the background.
- **No inline response strip on non-Home surfaces in this pass** — the spoken interaction belongs on the Home voice surface after the mode switch.

Apply this identical pattern to **Health (§4), My Brain/Community/Concierge/My Reports (§5), Menu (§7), and Profile (§6)** — do not design different compact-trigger treatments for the screens that need it.

---

## 3. HOME SCREEN

### Layout (top to bottom)
1. **Top bar:** VYVA/profile icon (left, opens Profile & settings), manual-mode hand icon (right, opens Menu). No date, no page title, no separate hamburger in the current approved polish pass.
2. **Greeting:** short, time-aware ("Good morning, Carmen." / afternoon / evening), Fraunces serif, ~32px.
3. **Talk-to-VYVA orb:** centered, ~172px diameter, stable size, with calm breathing waves while idle. Default caption: **"Touch the orb to begin."** Do not use "or just start talking" unless true open-mic/wake-word listening is actually implemented.
4. **Single calm moment chip:** one short message at a time, visually secondary to the orb. Show it only while the Home orb is idle; hide it while VYVA is listening or responding so it does not compete with the active voice turn. Do not reintroduce a data-card stack on Home.
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

- **Purpose:** Health is an action hub in this polish pass, not a live health dashboard. Keep it sparse, practical, and visually consistent with Menu.
- **Topbar:** same shell geometry as Home/Menu. Left VYVA/profile control opens Profile & settings. Right compact mic returns to the Home voice surface. No large back button, no extra title block, and no separate Health hero orb.
- **Rows:** four clear destinations, using the same row component language as Menu:
  - **My Health Plan** / Preventive steps and guidance.
  - **Symptom Check** / Aches, discomfort, or changes.
  - **Vitals Scan** / Latest readings and trends.
  - **Medicines** / Dose times and reminders.
- **Small nudges:** optional compact metadata pills are allowed (for example Today, Start, 72 bpm, 2:00 PM), but they must not turn the page into a dense dashboard.
- **Deferred:** live vital rows, progressive-disclosure metrics, interpreted trend charts, and full symptom-report integration remain future work. If reintroduced later, they must inherit the same row rhythm and dark/light token swap rather than becoming a separate visual system.

---

## 5. MY BRAIN / COMMUNITY / CONCIERGE / MY REPORTS

All four follow the same compact top-right mic mode-switch rule as Health/Menu/Profile. They do not render a page hero orb in this polish pass; tapping the mic returns to the Home voice surface.

- **My Brain:** default text "Five days strong — keep it going." Game rows (Rhythm Tap, Face-Name Match, Mood check-in) with Play/Check-in actions. Trend section for Rhythm Tap accuracy follows the same interpreted-sentence + sparkline pattern as Health's heart-rate trend.
- **Community:** default text "Elena replied in your Book Club room." Room rows with last-message preview and unread indicator (small colored dot, not a numeric badge).
- **Concierge:** default text "Your ride to Dr. Reyes is confirmed." Booking rows (ride, pharmacy refill, grocery delivery) with status dots (green = confirmed, amber = pending).
- **My Reports:** default text "A good week, Carmen." Plain-language weekly recap rows (steps, Rhythm Tap average, conversations, appointments kept) — this is Carmen's own recap, not a caregiver-facing report; confirm with product before pulling in any clinical/caregiver-report data source.

---

## 6. PROFILE SCREEN

- Hero: avatar circle with initial, name, location.
- Top-level profile tiles route one level deeper to local/profile-safe sub-screens; do not route to broken `/profile` or login handoffs in the prototype.
- **Care team** is a distinct privacy/data-visibility tile, not the same thing as Doctors & providers. Its sub-screen shows who can access Carmen's information:
  - Sofía (daughter): "Can see your health and daily activity" — Manage.
  - Dr. Pablo Rossi (care team): "Reviews your health reports monthly" — Manage.
- **Doctors & providers** remains a separate contact-directory tile for clinics and trusted help. Do not merge it with Care team.
- **Preferences** is a top-level tile for making VYVA easier to use. Its sub-screen has three rows:
  - Text size — currently Large — Change.
  - Theme — Light or dark mode — Change.
  - Language — currently English (US) — Change.
- A de-emphasized (gray, not purple) "Call support" action at the bottom — this connects to a human, and is intentionally lower-visual-priority than the VYVA voice interactions elsewhere.
- **Compact voice trigger in the topbar** — see §2B. Profile has no dedicated hero orb; use the same small mode-switch trigger as the other non-Home surfaces, not a scaled-down full orb.
- **No bottom dock on this screen.** Profile is reached only via the top-left profile icon on Home, not through the dock — it's a peer of Home in the navigation hierarchy, not a dock destination. Do not add Home/SOS/Reports at the bottom of Profile.

---

## 7. MENU SCREEN

Flat list, **no category headers/grouping** — this was explicitly decided against during design review (a 4-item list is short enough that grouping adds a parsing question — "is Health under Wellbeing?" — without earning its keep). **Menu tile count is settled at 4: Health, My Brain, Community, Concierge.** My Reports was deliberately relocated out of Menu and into the bottom dock (§8) in a later design revision specifically so it wouldn't compete with these four for space — do not add it back to Menu.

Each row: icon chip, title, one-line description, chevron. Full-width tappable rows, ≥80px min-height.

**Compact voice trigger in the topbar** — see §2B. It returns the user from manual mode to the Home voice surface.

---

## 8. NAVIGATION ARCHITECTURE

**This is the part most likely to drift if not followed exactly — read carefully.**

- **Bottom dock (persistent on Home, Reports, and visible-but-inactive on Health/Brain/Community/Concierge/Menu): 3 items — Home, SOS, Reports.**
- Home: jumps to the Home screen from any depth. **When already on Home, render this icon visibly inert** (muted gray, no highlight, not clickable) rather than an active-looking button that does nothing — this was a specific fix for a real usability confusion caught in design review.
  - SOS: existing emergency action — **locate and reuse the exact same handler/function the current production SOS button already calls; do not write a new implementation.** Visually: raised, red, distinct from the other two dock items.
  - Reports: jumps directly to My Reports from anywhere.
- **Menu is NOT in the bottom dock** — it lives behind the **manual-mode hand icon in the Home screen's top-right corner**. This was a deliberate late-stage revision (an earlier version put Menu in the dock; it was moved to free up dock space and because Reports needed dock-level prominence as a daily-use screen, while Health/Brain/Community/Concierge are browsed less frequently).
- **Back-button routing (top-left arrow on every detail screen) is hierarchical, not a flat "always go Home":**
  - Health / My Brain / Community / Concierge → Back goes to **Menu** (their parent).
  - Menu / My Reports / Profile → Back goes to **Home**.
- **Profile is not part of Menu and not part of the dock** — it's reached only via the top-left profile icon on Home, and is a peer of Menu in the navigation hierarchy (both go back to Home), not a child of it.

**Codex: implement navigation with a proper router (React Router or existing app convention) reflecting this hierarchy — do not hardcode `goToScreen()`-style imperative screen-swapping as in the prototype; that pattern exists there only because it's a single-file vanilla-JS mockup.**

---

## 9. INTEGRATION CHECKLIST

### Current Home/Menu/Profile/Health polish pass

- [ ] Home topbar uses left VYVA/profile control and right manual-mode hand control with fixed shared geometry.
- [ ] Menu and Health use the same shell width, topbar control positions, row rhythm, icon scale, and bottom dock placement.
- [ ] Health is the simplified 4-row action hub: My Health Plan, Symptom Check, Vitals Scan, Medicines.
- [ ] Profile routes to local/profile-safe settings surfaces and does not route to a broken `/profile` or login handoff in the prototype.
- [ ] Light and dark modes preserve identical structure and content; only token values change.
- [ ] Bottom dock is exactly 3 items (Home, SOS, Reports); SOS reuses the existing emergency event path.
- [ ] Menu is reached from Home via the manual-mode hand control and contains exactly 4 flat tiles (no category headers).
- [ ] All icons implemented via `lucide-react`, no custom SVG icon set unless a specific icon has no reasonable equivalent.
- [ ] All touch targets ≥56px, body text ≥16px, verified on a real device at 390px and 768px widths.
- [ ] `prefers-reduced-motion` disables orb/ripple animations app-wide.
- [ ] No emoji anywhere in production copy or iconography.

### Deferred full data/voice integration

- [ ] `useVoiceOrb()` hook implemented once for the Home full-orb instance; non-Home surfaces use the compact mic mode-switch
- [ ] Tapping an active orb (listening or responding) cancels back to idle — verify this on every orb instance, not just Home; each needs a stable per-instance active-state reference for cancel to work correctly
- [ ] Compact voice trigger (§2B) implemented once, used by all non-Home prototype surfaces that need voice access, and routes back to the Home voice surface
- [ ] Switching from voice to manual mode stops/suspends active voice capture/session in the real integration; the prototype documents this requirement but does not control ElevenLabs
- [ ] Fonts self-hosted, not loaded from Google Fonts CDN in production — confirm whether Fraunces/Figtree already exist as local assets in the project; if not, add them
- [ ] Time-of-day theming implemented as a hook/context, not hardcoded per screen
- [ ] Home's rotating moment feed wired to the real ranking engine (not the static prototype array)
- [ ] All data sources (vitals, medication, community, concierge, brain stats) confirmed against actual Supabase table/column names before wiring
- [ ] If live Health metrics return, the trend chart uses interpreted-sentence-first pattern, not raw bars.
- [ ] If additional live Health metrics return, progressive disclosure is extensible without adding new screens.
- [ ] Back-button routing matches the hierarchy in §8 exactly (Health/Brain/Community/Concierge → Menu; Menu/Reports/Profile → Home)

---

*Brief version: 1.0 | Scope: Home + Health + My Brain + Community + Concierge + My Reports + Menu + Profile | Stack: React · TypeScript · Vite · Supabase*
*Reference: vyva_home_redesign_v5.html (approved interactive prototype)*
*Companion brief: VYVA_Codex_Brief_CheckIn_Flow.md*
