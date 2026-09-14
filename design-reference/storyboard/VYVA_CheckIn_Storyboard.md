# VYVA Preventive Check-in — Annotated Storyboard
### Flow: `health.preventive_check@1.0.0` — one Flow, two modalities

Each frame below has a live HTML file in `storyboard/` (open directly in a browser — each opens frozen at, or plays naturally into, the exact moment described). Per frame: **Flow state, authoritative data shown, voice behavior, touch behavior, presentation state/ID needed.**

The core thing this storyboard is built to demonstrate: **the presentation ID does not change when input switches from voice to touch or back.** Only the authoritative data (current question, collected answers) changes. Voice and touch are two ways of writing to the same state, not two different screens.

---

## Frame 1 — Home (idle)
**File:** `storyboard/frame_1_home_idle.html`

| | |
|---|---|
| **Flow state** | None — pre-Flow. Home's own idle state. |
| **Authoritative data shown** | None relevant to this Flow yet. |
| **Voice behavior** | Orb at rest (slow breathing animation). No active speech. Home's own rotating-moment feed is running independently of this Flow. |
| **Touch behavior** | User can tap the orb, tap a moment, or navigate to Health. The check-in entry point lives on Health, not Home — see Frame 2. |
| **Presentation state/ID** | `home.idle` (not part of this Flow's ID space) |

---

## Frame 2 — Entry
**File:** `storyboard/frame_2_entry.html`

| | |
|---|---|
| **Flow state** | Idle/Entry — Flow instance not yet created. |
| **Authoritative data shown** | None yet. The "Quick check-in" row itself is static UI, not Flow-driven. |
| **Voice behavior** | None required to reach this point. (If voice-initiated instead — e.g., Carmen says "let's check in" — this frame is skipped entirely and the Flow starts directly into Frame 3.) |
| **Touch behavior** | Tap "Quick check-in" row on Health. This is the only touch-initiated entry point currently built. |
| **Presentation state/ID** | `checkin.entry` — brief/transitional, may not warrant its own rendered screen once wired to a real Flow engine (current UI treats it as instant). |

---

## Frame 3 — Question 1, by voice
**File:** `storyboard/frame_3_q1_voice.html` (auto-plays on load)

| | |
|---|---|
| **Flow state** | Collecting — step 1 of the Flow (`question_id: 'feeling'`). |
| **Authoritative data shown** | `current_question = 'feeling'`, `answers = {}` |
| **Voice behavior** | VYVA asks **"How are you feeling today, Carmen?"** — rendered via the same word-synced caption reveal used elsewhere in the app (simulates speech pacing; a real build syncs to actual TTS word-boundary timestamps instead of the fixed pacing shown here). |
| **Touch behavior** | Answer options fade in once the spoken question finishes revealing, and are tappable at that point. **Note for implementation:** a real voice-input answer given *before* the touch options finish fading in must still register correctly — don't gate voice input on this animation. |
| **Presentation state/ID** | `checkin.question` (parameterized by `question_id`, `options[]`) |

---

## Frame 4 — Answer, by touch (Q1)
**File:** `storyboard/frame_4_q1_touch_answered.html` (frozen ~2.6s after load)

| | |
|---|---|
| **Flow state** | Collecting — step 1, answer captured, about to advance. |
| **Authoritative data shown** | `answers.feeling = "Something's bothering me"` (about to be committed) |
| **Voice behavior** | None — no VYVA speech needed to acknowledge a touch answer. A brief non-verbal confirmation (the option highlighting) is sufficient. |
| **Touch behavior** | User tapped **"Something's bothering me."** The option highlights (border + fill color change) and holds for ~380ms before the Flow advances — this is the actual visible "answered" moment; the previous build had no such confirmation, which was a real gap. |
| **Presentation state/ID** | **Same as Frame 3: `checkin.question`.** The selected-state highlight is temporary UI feedback layered on the same presentation instance — it is not a new presentation state. This is the frame that most directly demonstrates the "same Flow, same presentation ID, different data/input-modality" principle. |

---

## Frame 5 — Question 2, by voice
**File:** `storyboard/frame_5_q2_voice.html` (auto-plays: clicks through Q1, then plays Q2's voice reveal)

| | |
|---|---|
| **Flow state** | Collecting — step 2 (`question_id: 'detail'`). Reached because Q1's answer ("Something's bothering me") did not match the shortcut-to-Summary condition. |
| **Authoritative data shown** | `current_question = 'detail'`, `answers = { feeling: "Something's bothering me" }` |
| **Voice behavior** | VYVA asks **"Want to tell me a bit more?"** — same synced-reveal mechanism as Frame 3. |
| **Touch behavior** | Same pattern as Frame 3: options fade in after the spoken question completes. |
| **Presentation state/ID** | **`checkin.question` again** — same ID as Frames 3–4, now rendering different data (`question_id: 'detail'`, new options). This is the second demonstration that the presentation layer doesn't need a new ID per question, only new data per Flow step. |

---

## Frame 6 — Touch continuation (Q2)
**File:** `storyboard/frame_6_q2_touch_answered.html` (frozen after both real clicks + confirm delay)

| | |
|---|---|
| **Flow state** | Collecting — step 2, answer captured, about to advance to Summary. |
| **Authoritative data shown** | `answers.detail = "Aches or discomfort"` (about to be committed); `answers.feeling` already set from Frame 4. |
| **Voice behavior** | None required. |
| **Touch behavior** | User tapped **"Aches or discomfort."** Same highlight-and-hold pattern as Frame 4. |
| **Presentation state/ID** | **Still `checkin.question`.** Third and final demonstration of the same principle — this is the last question in the current scope, so the next transition (on the ~380ms timeout firing) moves to `checkin.summary`. |

---

## Frame 7 — Summary
**File:** `storyboard/frame_7_summary.html` (auto-plays through both questions)

| | |
|---|---|
| **Flow state** | Summary — all questions in this path answered. |
| **Authoritative data shown** | `answers = { feeling: "Something's bothering me", detail: "Aches or discomfort" }` |
| **Voice behavior** | None currently built to read the summary aloud automatically. **Flagged gap, not a decision:** given VYVA is voice-first everywhere else, consider whether Summary should offer an explicit "hear this back" voice affordance — not built in this pass, worth a product call. |
| **Touch behavior** | User reviews the two answer rows (plain text, no scoring/interpretation applied — matches the "reflect collected info, not manufacture conclusions" requirement), then taps **Done**. |
| **Presentation state/ID** | `checkin.summary` (parameterized by the full `answers` object) |

---

## Frame 8 — Complete
**File:** `storyboard/frame_8_complete.html` (auto-plays the full path, then taps Done)

| | |
|---|---|
| **Flow state** | Complete. |
| **Authoritative data shown** | Flow instance closed. Nothing further persists in-session (no follow-up Flow is spawned — no reminder, no scheduled recheck, per explicit scope constraints). |
| **Voice behavior** | None. |
| **Touch behavior** | None required — the "Done" tap in Frame 7 *is* the completing action; this frame is the resulting state, showing the return to Health. |
| **Presentation state/ID** | No `checkin.*` ID — returns to the existing `health.home` presentation. Completion is "unmistakable" simply by being back on familiar, already-established Health UI, not a new screen. |

---

## Safety Interruption Example
**File:** `storyboard/frame_9_safety.html` (auto-plays: starts Q1, then taps the safety link)

| | |
|---|---|
| **Flow state** | Safety/Interrupted — **can be entered from any Collecting step**, demonstrated here from Q1 but structurally identical if triggered from Q2. This is not a branch within the question sequence; it fully preempts it. |
| **Authoritative data shown** | `interrupted = true`, `resume_step` preserved (whichever question was active when the safety link was tapped) so "I'm okay — go back" can resume correctly rather than restarting. |
| **Voice behavior** | Not currently built with voice output on this screen. **Flagged gap:** given the urgency, VYVA arguably should speak this screen's headline aloud automatically rather than requiring the user to read it — not built in this pass, worth a product/safety-review call before shipping. |
| **Touch behavior** | Two options: **"Get help now"** (wires to existing SOS mechanism — not a new emergency flow) or **"I'm okay — go back"** (resumes the Flow at `resume_step`, does not restart at Question 1). |
| **Presentation state/ID** | `checkin.safety_interrupt` — deliberately a distinct ID from `checkin.question`, since this is not a variation of asking a question, it's a different kind of screen entirely (no progress indicator, no dock/nav chrome). |

---

## Summary table

| Frame | Flow state | Presentation ID |
|---|---|---|
| 1 | (none — Home idle) | `home.idle` |
| 2 | Entry | `checkin.entry` |
| 3 | Collecting (Q1, voice) | `checkin.question` |
| 4 | Collecting (Q1, touch) | `checkin.question` *(same as 3)* |
| 5 | Collecting (Q2, voice) | `checkin.question` *(same ID, new data)* |
| 6 | Collecting (Q2, touch) | `checkin.question` *(same ID, new data)* |
| 7 | Summary | `checkin.summary` |
| 8 | Complete | *(none — returns to `health.home`)* |
| Safety | Interrupted | `checkin.safety_interrupt` |

**Three presentation IDs cover the entire Flow** (`checkin.entry`, `checkin.question`, `checkin.summary`, plus `checkin.safety_interrupt` for the interruption branch) — not one ID per screen-look or one ID per modality. That's the whole point the architecture doc was making, made concrete.

---

*Two flagged gaps, not decisions made unilaterally: (1) whether Summary should offer a "hear this back" voice affordance, (2) whether the Safety screen should have VYVA speak its headline aloud automatically rather than relying on the user reading it. Both are product/safety-review calls, not UI calls — noted here so they don't get silently resolved one way or the other during implementation.*
