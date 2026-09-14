# VYVA Codex Brief — Preventive Check-in Flow (UI only)
# Flow ID: health.preventive_check@1.0.0
# Layers: Flow-State UI · Voice/Touch Presentation · Safety Interruption

---

## 0. CONTEXT FOR CODEX — READ THIS SECTION FIRST

**STEP ONE, BEFORE ANYTHING ELSE:** open and read these files in full — they contain the exact values (copy, spacing, timing, state behavior) this brief refers to throughout:
- `design-reference/vyva_home_redesign_v5.html` — specifically the `symptomScreen` and `safetyScreen` sections
- `design-reference/preview_7_checkin_desktop.html`
- `design-reference/storyboard/VYVA_CheckIn_Storyboard.md` — an annotated frame-by-frame walkthrough of the full journey (Home → entry → Q1 by voice → answer by touch → Q2 by voice → touch continuation → summary → complete, plus the Safety branch). Each frame is annotated with its Flow state, authoritative data, voice behavior, touch behavior, and presentation state/ID — this is the clearest single reference for how presentation IDs stay stable across voice/touch handoff (see §3). The nine linked HTML frames in `design-reference/storyboard/` are live, not static images — open them to see the actual state.

Also read `design-reference/VYVA_Codex_Brief_Home_Nav_Redesign.md` — this flow depends on the shared `useVoiceOrb()` hook and design tokens specified there. Do not build a separate/duplicate orb implementation for this flow.

If any of these paths don't exist in this repo, stop and ask where they were placed before proceeding.

---

**This brief is frontend UI presentation only. It is not a Flow-engine implementation.**

Per the approved Flow architecture doc for this feature: the UI is a projection of one authoritative Flow state, owned server-side / by the Presentation Registry. Voice, touch, and text are different input modalities for the *same* Flow, not separate journeys with separate logic. **Do not implement branching, question sequencing, or completion logic as hardcoded React state that owns the "truth" of where the user is in the check-in** — that decision belongs to the Flow engine. This brief specifies what the UI should *render* for a given state and how it should behave, not the Flow's internal logic.

**Reference artifact:** an approved interactive prototype (read in Step One above) at `design-reference/vyva_home_redesign_v5.html`, screens `symptomScreen` and `safetyScreen`, plus `design-reference/preview_7_checkin_desktop.html`. The prototype's JS (`checkinQuestions` array, `renderCheckinStep()`, etc.) is a **visual behavior reference only** — it simulates a Flow using local state because it's a standalone mockup with no backend. Production code must instead subscribe to real Flow state and render accordingly.

**Explicit content constraints (do not deviate without product sign-off):**
- No diagnostic scoring, risk meter, "you may have…", treatment advice, or medication-dose decisions.
- No caregiver automation in this Flow — no "we've notified your caregiver," no auto-call/SMS, no escalation, no permission changes.
- No scheduling or proactive UX — no "repeat every morning," no future check-in reminders, no outbound calls, no recurrence/quiet-hours settings.
- No external-action expansion — no doctor booking, pharmacy action, provider contact, call/email/WhatsApp handoff, payment, or checkout.
- Summary reflects **collected information only** — "here's what you told VYVA," never a manufactured conclusion or diagnosis-shaped statement.
- Keep Health visually familiar — reuse existing VYVA Health typography, spacing, controls, and navigation (see companion brief `VYVA_Codex_Brief_Home_Nav_Redesign.md` for the shared design tokens and orb component this flow depends on). This is not a Health redesign.

**Architecture decision for this pass (do not deviate without a product/backend conversation):** there is no confirmed client-readable Presentation/Flow state source for this Flow yet. Build **only UI components plus a narrow adapter layer that fakes the shape of a real Flow subscription** — do not let any component own or compute Flow truth itself.

```typescript
// The adapter's job: pretend to be what a real Flow subscription will look
// like later, so swapping the fixture for the real thing is a data-source
// change, not a component rewrite.
interface CheckInFlowState {
  flowState: 'idle' | 'collecting' | 'safety' | 'summary' | 'complete';
  currentQuestion: { id: string; voice: string; options: string[] } | null;
  answers: Record<string, string>;
  resumeStep: string | null; // set when Safety is entered, used by "I'm okay — go back"
}

interface CheckInFlowActions {
  onAnswer: (questionId: string, value: string) => void;
  onSafetyTrigger: () => void;
  onSafetyResolved: (action: 'get_help' | 'resume') => void;
  onComplete: () => void;
}

// Backed for this pass by a local fixture (mirrors checkinQuestions in the
// prototype) — NOT a real Flow-engine subscription. Isolate this behind a
// single hook/provider (e.g. useCheckInFlow()) so every component below only
// ever consumes CheckInFlowState/Actions, never the fixture directly. When a
// real Presentation Registry / Flow subscription exists, only this one hook
// needs to change.
```

**Codex: confirm with the backend/Flow-engine owner whether this fixture-adapter approach is acceptable for this pass, or whether a real integration point already exists that should be used instead — do not assume based on this brief alone.**

---

## 1. FLOW STATES COVERED IN THIS UI PASS

Per the architecture doc, not every possible lifecycle state needs to be forced into the UI. This pass covers:

| State | What it means | Covered? |
|---|---|---|
| Entry/Idle | Not yet started; entry point visible on Health | ✅ |
| Collecting | An active question is being asked/answered | ✅ |
| Safety/Interrupted | Emergency-relevant input has preempted the check-in | ✅ |
| Summary | Collected answers are being reflected back | ✅ |
| Complete | Flow has ended, returning to Health | ✅ (implicit — Summary's "Done" action) |
| Resumable | Returning to an in-progress check-in later | ❌ not designed in this pass — confirm with product if needed |

---

## 2. ENTRY / IDLE STATE

Location: a row on the Health screen (see companion brief §4), not a separate screen.

- Label: **"Quick check-in"** / subtext **"A gentle preventive check with VYVA"**.
- Deliberately calm styling (light lavender background, not an alert color) — this is a wellness check-in, not a symptom-emergency prompt.
- Tapping it initiates the Flow (`health.preventive_check@1.0.0`) and navigates to the Collecting-state screen.

---

## 3. COLLECTING STATE

### Core presentation principle: voice and touch render the same state, not two modes

Each question should be presented as **VYVA asking it out loud, with tap options available at the same time** — not "here's the voice UI" vs. "here's the touch UI" as separate screens or separate flows. In the reference prototype this is simulated by:
1. The question text reveals word-by-word via the same synced-caption engine used elsewhere in the app (see companion brief §2, `useVoiceOrb`'s reveal mechanism) — representing VYVA speaking it.
2. Tap options fade in once the question finishes "being spoken."
3. Answering by touch and (in a real build) answering by voice must both update the **same** underlying Flow state and produce the **same** subsequent UI — no duplicate question, no restart, no separate progress indicator per modality.

**Codex: when wiring real voice input, an answer given by speech before the touch options finish revealing must still register correctly — do not gate voice input on the touch-reveal animation completing.**

### Layout
- Progress indicator: thin segmented bar at top, one segment per question in the current Flow path, filled = answered, highlighted = current. **Do not hardcode a fixed total** — the number of questions can vary by branch (see §4); the indicator should reflect the Flow's actual remaining-step count if the Flow engine exposes it, or be reduced to a simpler "in progress" indicator if it doesn't.
- Small VYVA avatar (mic-icon circle, non-interactive) above the question — visual anchor establishing VYVA is asking, not a form interrogating the user.
- Question text: Fraunces serif, ~22px, reserve vertical space so the touch options don't jump as text reveals.
- Options: full-width rows, ≥60px min-height, single-select unless a specific question is explicitly multi-select (none in the current approved question set — see §4).
- **Persistent "If this feels urgent, tap here" link** at the bottom of every question card (small, understated — text link, not a prominent button). This is the Safety escape hatch (§5) — it must be present and functional on **every** question, not only a subset.

### Reference question content (confirm exact wording/branching with product — this is what was approved in design review, not necessarily final)
1. "How are you feeling today, Carmen?" → Great / Okay / Not my best / Something's bothering me
   - If "Great" or "Okay" → Flow may shortcut directly to Summary (not every question is forced for every user).
2. "Want to tell me a bit more?" → Tired or low energy / Aches or discomfort / Trouble sleeping / Just an off day / Something else
   - Only asked if Q1 answer indicated something's off.

**Codex: this two-question set with shortcut logic is what's specified for the current scope. Confirm with the Flow-engine owner whether additional branches exist server-side that the UI needs to accommodate (e.g., follow-up questions per Q2 answer) — do not invent additional questions beyond what the Flow actually asks.**

---

## 4. SAFETY / INTERRUPTED STATE

**This is its own screen state, reached from the persistent link on any question — it is explicitly not "another answer option" within the question sequence.** This was a corrected mistake from an earlier design iteration where a red-flag question sat as the last step of a linear sequence; the approved design requires safety to be reachable from anywhere and to preempt the flow outright.

- Full-screen, centered content, no progress indicator, no dock/navigation chrome — this is a focused interruption, not a browsable screen.
- Icon: calm-but-clear circular icon (not the mic avatar — a distinct urgent-context icon), amber/red tone, not alarming animation (no fast pulsing).
- Headline: **"Let's get you help right now, Carmen."**
- Subtext: **"I've paused the check-in. Tap below and I'll connect you right away."**
- Primary action: **"Get help now"** — **locate and reuse the exact same handler/function the existing production SOS button already calls (see companion Home/Nav brief §8); do not write a new emergency-contact implementation for this feature.**
- Secondary action: **"I'm okay — go back"** — must **resume the check-in at the question the user left**, not restart from Question 1. This is a required recoverability path for mis-taps.
- **No caregiver-notification copy or logic on this screen** — do not add "we've notified Sofía" or similar, per the explicit constraint in §0.

---

## 5. SUMMARY STATE

- Icon: calm affirmative (checkmark), green tone.
- Headline: **"Here's what you told VYVA."**
- Subtext: **"Thanks for checking in, Carmen."**
- Body: a plain list of the answers actually collected during this session (label + value rows, hairline-separated, matching the Health screen's row style) — **this must reflect only what was collected, not a generated interpretation, score, or recommendation.**
- Single action: **"Done"** → returns to Health. No secondary actions (no "book a visit," no "contact your doctor," no "remind me tomorrow") per the explicit constraints in §0.

---

## 6. DESKTOP REPRESENTATION

A desktop layout is required for this Flow specifically (not the rest of the app — confirmed out of scope for this brief). See `preview_7_checkin_desktop.html` for the reference: same design tokens as mobile, centered ~520px column inside the existing page chrome, not a multi-panel dashboard layout. The Collecting and Safety states are the two that must have desktop representations; Entry and Summary can reasonably inherit the same centered-column treatment without a separate spec.

---

## 7. INTEGRATION CHECKLIST

- [ ] Components consume `CheckInFlowState`/`CheckInFlowActions` only through the `useCheckInFlow()`-style adapter — never own Flow branching logic directly (see architecture decision in §0)
- [ ] Adapter is backed by a local fixture for this pass, isolated so a real Flow subscription can be swapped in later without touching component code
- [ ] Voice and touch inputs both update the same Flow state; verify no duplicate-question or restart bug when switching modalities mid-question
- [ ] Safety link present and functional on every question card, not just the last one
- [ ] Safety state stops the Flow outright — verify no "Continue" path back into the question sequence except via the explicit "I'm okay — go back" recovery action
- [ ] "I'm okay — go back" resumes at the correct question, not Question 1
- [ ] Summary renders only collected answers — no scoring, no diagnosis-shaped language, no manufactured recommendation
- [ ] No caregiver-notification, external-action (booking/calling/contact), or scheduling/recurrence logic or copy anywhere in this Flow
- [ ] Desktop layout implemented for Collecting and Safety states at minimum
- [ ] Uses the shared `useVoiceOrb()` hook and design tokens from the companion Home/Nav brief — no duplicate orb implementation
- [ ] Confirm with product/legal that all copy stays in general-wellness framing per existing VYVA regulatory-lane discipline (no clinical decision support language)

---

*Brief version: 1.0 | Flow: health.preventive_check@1.0.0 | Scope: UI presentation only — Flow orchestration is out of scope*
*Reference: vyva_home_redesign_v5.html (`symptomScreen`, `safetyScreen`) + preview_7_checkin_desktop.html*
*Companion brief: VYVA_Codex_Brief_Home_Nav_Redesign.md (shared design tokens + voice orb engine)*
