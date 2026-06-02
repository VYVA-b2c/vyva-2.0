# Brain Coach V2 System Audit

Date: 2026-05-31
Branch: `audit/brain-coach-v2`
Base audited: `origin/main` at `43310ac`

This is a report-only audit. No product code was changed.

## Executive Summary

The Brain Coach system is already more than a single memory game. It is a multi-entry cognitive activity area with voice support, several Supabase-backed adaptive games, a browser-local memory-game module, scheduled Brain Coach sessions, and onboarding fields for cognitive preferences. Its strongest current assets are senior-friendly UI, language support, voice companionship, seeded multi-tier game content, and per-game adaptive state.

The main weakness is fragmentation. Progress, scoring, difficulty, personalization, and retention are not governed by one Brain Coach model. Memory games save only to `localStorage`, while Spatial Navigator, Face-Name Match, Dual Task Walk, Category Sort, and Number Trails each maintain separate Supabase session/state tables. Scheduled Brain Coach calls exist, but they are not yet driven by performance, preferences, missed sessions, or caregiver goals.

Compared with leading cognitive-training products for older adults, VYVA has a promising care-context advantage, but lacks the baseline assessment, unified progress reporting, adaptive training plan, cross-device persistence, habit loop, and evidence/claims guardrails expected from mature products.

## 1. Current Architecture

### Product Surface

- Main entry is `/activities`, implemented by `src/pages/ActivitiesScreen.tsx`.
- `/activities` displays a Brain Coach voice hero, a voice action fulfillment panel, a mock weekly streak, and activity cards routed through `activityRoutes`.
- Routes are:
  - Trivia/attention hub: `/attention-boosters`
  - Memory hub: `/memory-games`
  - Spatial Navigator: `/spatial-navigator`
  - Language hub: `/language`
  - Executive hub: `/executive-function`
- Application route wiring is in `src/App.tsx:408-420`.

### Game Families

- Memory hub:
  - `src/games/memory/MemoryGamesPage.tsx`
  - `src/games/memory/MemoryGameRunner.tsx`
  - `src/games/memory/memoryGameRegistry.ts`
  - `src/games/memory/progressionEngine.ts`
  - `src/games/memory/gameStorage.ts`
- Language:
  - `src/games/LanguageGamesPage.tsx`
  - Routes Story Recall to `/memory-games/story_recall`.
- Attention:
  - `src/games/AttentionBoostersPage.tsx`
  - Routes Dual Task Walk and Rhythm Tap. Rhythm Tap reuses `MemoryGameRunner` with `sequence_memory`.
- Executive:
  - `src/games/ExecutiveFunctionPage.tsx`
  - Routes Number Trails, Category Sort, and Face-Name Match.
- Standalone Supabase-backed games:
  - `src/games/SpatialNavigator.jsx`
  - `src/games/FaceNameMatch.jsx`
  - `src/games/DualTaskWalk.jsx`
  - `src/games/CategorySort.jsx`
  - `src/games/NumberTrails.jsx`

### Backend and Services

- `server/routes/games.ts` exposes only two Brain Game API endpoints:
  - `POST /api/games/score-retell` for OpenAI-assisted Story Recall scoring.
  - `POST /api/games/tts` for ElevenLabs TTS playback.
- Most non-memory games write directly from the browser to Supabase tables.
- Scheduled Brain Coach sessions are part of `scheduled_interactions` and `interaction_logs`.
- Voice routing and context exist through:
  - `server/routes/router.ts`
  - `server/routes/conversationToken.ts`
  - `server/lib/voiceContext.ts`
  - `server/lib/conversationContext.ts`
  - `src/lib/voiceActionRegistry.ts`
  - `src/hooks/useVyvaVoice.ts`

### Data Architecture

Current Brain Coach data is split across these stores:

- Browser `localStorage`:
  - `vyva-memory-game-results` in `src/games/memory/gameStorage.ts:3-70`.
- Supabase game tables:
  - `spatial_nav_maps`, `spatial_nav_sessions`, `spatial_nav_user_state`
  - `dual_task_sequences`, `dual_task_sessions`, `dual_task_user_state`
  - `face_name_personas`, `face_name_sets`, `face_name_sessions`, `face_name_user_state`
  - `category_sort_cards`, `category_sort_sequences`, `category_sort_sessions`, `category_sort_user_state`
  - `number_trails_configs`, `number_trails_sessions`, `number_trails_user_state`
- General voice/session tables:
  - `session_state`
  - `session_exchanges`
  - `agent_difficulty`
- Scheduled engagement:
  - `scheduled_interactions`
  - `interaction_logs`
- Profile/personalization:
  - `profiles.data_sharing_consent`, where onboarding stores a `cognitive` section.
  - `profiles.mem0_user_id` for external memory lookup.

## 2. Session Flow

### Activities Hub Flow

1. User enters `/activities`.
2. `VoiceHero` starts or prepares Brain Coach context.
3. `VoiceActionFulfillmentPanel` exposes `domain="brain_coach"` and `actionTypes=["brain.activity"]`.
4. User taps an activity card.
5. The card navigates to a hub or direct game via `activityRoutes`.

### Memory Game Flow

1. `MemoryGamesPage` loads:
   - user id from auth or fallback `vyva-local-user`;
   - local history via `getGameHistory`;
   - recommendation via `selectNextMemoryGame`;
   - manual plans for game cards via `selectGamePlan`.
2. User starts a recommendation or manual plan.
3. `MemoryGameRunner` selects a variant by URL query or plan.
4. Current playable implementations:
   - Memory Match
   - Sequence Memory
   - Word Recall
   - Story Recall
5. Results are saved with `saveGameResult`, which currently writes only to localStorage.
6. Result actions offer continue, replay, or another game.

Important issue: the registry contains seven memory game types, but the runner only fully supports four. Number Memory, Routine Memory, and Association Memory route to a "Coming soon" screen from `MemoryGameRunner.tsx:1258-1280`.

### Supabase-Backed Game Flow

For Spatial Navigator, Face-Name Match, Dual Task Walk, Category Sort, and Number Trails:

1. Load or create per-game user state.
2. Select content for the current tier.
3. Avoid content already played today when possible.
4. Fall back to local practice content when no authenticated user or data load fails.
5. Run the game-specific phases.
6. Insert a session row.
7. Update the per-game user state.
8. Show score, streak, tier progress, and result actions.

### Scheduled Brain Coach Flow

- `server/routes/scheduledSupport.ts` creates a default `BRAIN_COACH` schedule on Monday, Wednesday, and Friday at 11:00, with `frequency_value: { session_type: "memory" }`.
- The user settings screen displays and edits scheduled support.
- The schedule system is currently not connected to actual game completion, game recommendation, missed training recovery, or difficulty adaptation.

## 3. Progress Tracking

### What Exists

- Per-game session tables capture raw play results and timestamps for Supabase-backed games.
- Per-game user state tables capture:
  - `current_tier`
  - `sessions_at_tier`
  - `consecutive_wins`
  - `consecutive_losses`
  - `total_sessions`
  - `best_score`
  - `last_played_at`
  - `streak_days`
  - `last_streak_date`
- Memory games track:
  - `userId`
  - `gameType`
  - `cognitiveDomain`
  - `variantId`
  - `level`
  - `score`
  - `accuracy`
  - `mistakes`
  - `durationSeconds`
  - `completedAt`
  - `language`

### Key Limitations

- Memory-game progress is device-local only.
- There is no unified Brain Coach progress table.
- There is no per-domain longitudinal score model.
- There is no caregiver-facing cognitive progress report.
- The activities hub streak uses mock data from `src/data/mockData.ts`, not real game completions.
- `NumberTrails.jsx` writes to `cognitive_session_index`, but no table definition or migration for `cognitive_session_index` exists in the repo.

## 4. Personalization

### What Exists

- App language influences content selection and speech language.
- Supabase-backed games prefer same-language seeded content, with fallbacks to Spanish, English, or German depending on game.
- Content selection avoids repeating the same map/sequence/config on the same day when possible.
- Memory progression rotates domains and variants.
- Cognitive onboarding captures:
  - memory difficulty
  - diagnosis
  - session length
  - preferred training time
  - pace
  - exercise variety
  - communication style
- Voice context can include `cognitive_notes` for `brain_coach`.

### Key Limitations

- Cognitive onboarding preferences are not used by the actual game recommendation or adaptation engines.
- There is no baseline assessment.
- There is no per-user cognitive profile used to choose domains, session length, pace, or modality.
- Voice memory and game history are not merged into one personalization layer.
- Diagnosis and support needs are not used to simplify instructions, adjust motor/visual load, or cap difficulty.

## 5. Difficulty Adaptation

### Memory Games

- Memory games use 5 levels.
- `getRecommendedLevelForGame` averages the last three results:
  - average accuracy >= 80: move up one level;
  - average accuracy < 50: move down one level;
  - otherwise stay at current level.
- Variant selection avoids recently used variants over a 30-day window.

### Supabase-Backed Games

- Most use 10 tiers.
- Spatial Navigator and Face-Name Match:
  - 3 wins at >= 80 percent accuracy promotes a tier.
  - 3 losses below 50 percent demotes a tier.
- Dual Task Walk:
  - 3 wins at >= 70 percent combined accuracy promotes.
  - 3 losses below 40 percent demotes.
- Number Trails and Category Sort:
  - 3 wins at >= 75 percent combined accuracy promotes.
  - 3 losses below 45 percent demotes.

### Key Limitations

- Adaptation is isolated by game, not coordinated across cognitive domains.
- No baseline calibration.
- No target challenge band beyond threshold rules.
- No fatigue-aware reduction after slow response, repeated frustration, missed sessions, or poor health check-ins.
- No age, diagnosis, vision, hearing, motor, or language-support adjustment.
- Several TODO comments point to future metrics, for example reaction-time adaptation in Dual Task Walk and caregiver trend surfacing in Spatial Navigator/Category Sort.

## 6. Memory Usage

The system uses "memory" in three different ways:

1. Cognitive memory games:
   - actual memory exercises in Memory Match, Word Recall, Story Recall, Sequence Memory, Face-Name Match, and Spatial Navigator.
2. Product memory:
   - local game history in `localStorage`;
   - Supabase session/state tables;
   - scheduled support logs.
3. Voice/AI memory:
   - `mem0` lookup through profile `mem0_user_id`;
   - `session_state` and `session_exchanges`;
   - `agent_difficulty` for voice agent difficulty context.

The major gap is that these memory stores are not reconciled. The voice agent can know conversational context, but not the user's actual Brain Coach performance history in a normalized way.

## 7. Scoring System

### Current Scoring

- Memory Match and Sequence Memory:
  - use accuracy, level, mistakes, and duration.
  - score has a floor of 60.
- Word Recall:
  - score equals percent of correct recalled words.
- Story Recall:
  - combines multiple-choice accuracy and AI-scored retell.
  - formula weights retell at 60 percent and choice questions at 40 percent.
- Spatial Navigator:
  - up to 700 points from route accuracy and 300 speed bonus.
- Face-Name Match:
  - score is based on name-to-face and face-to-name accuracy over a 1000-point range.
- Dual Task Walk:
  - combines serial-7 accuracy, tap F1, and completion bonus.
- Category Sort:
  - combines accuracy and flexibility.
  - records perseverative errors and response time.
- Number Trails:
  - combines node accuracy and speed.
  - records completion time, errors, par time, accuracy, and speed.

### Key Limitations

- Scores are not normalized across games.
- Some games use 0-1000, while memory games have lower and inconsistent ranges.
- Memory-game scoring floors can mask poor performance.
- No confidence intervals, measurement error, or trend reliability.
- No domain score rollups such as attention, processing speed, memory, executive function, and language.

## 8. Existing Metrics

### Session Metrics

- Spatial Navigator:
  - route steps correct, total steps, accuracy, draw time, score, completed/abandoned.
- Face-Name Match:
  - name-to-face attempts/correct/accuracy, face-to-name attempts/correct/accuracy, overall accuracy, score.
- Dual Task Walk:
  - serial-7 attempts/correct/accuracy, tap hits/misses/false positives/accuracy, combined score.
- Category Sort:
  - cards sorted/correct, perseverative errors, rule switches handled/total, flexibility, response time, score.
- Number Trails:
  - nodes correct/total, errors, completion time, par time, accuracy, speed, score.
- Memory games:
  - score, accuracy, mistakes, duration, completion timestamp.
- Voice:
  - recent Brain Coach turn streak is derived from `session_exchanges`.
- Scheduled support:
  - schedule status, next run, last completion, interaction logs.

### Test Coverage

- `server/__tests__/games.test.ts` covers retell fallback and TTS behavior.
- `src/games/memory/progressionEngine.test.ts` covers repeat-level threshold behavior.
- `src/games/memory/sequenceScoring.test.ts` covers sequence tile scoring.
- `src/games/shared/brainGamesInfrastructure.test.ts` covers translation and story payload infrastructure.
- Number Trails, Category Sort, Executive hub, and Face-Name logic have focused tests.

### Gaps

- No integration tests for Supabase save/update paths.
- No tests for promotion/demotion across all games.
- No tests proving scheduled Brain Coach calls reflect game completion.
- No analytics validation for retention, cohort activity, or caregiver reporting.

## 9. Engagement Mechanics

### What Exists

- Senior-friendly activity hub and game cards.
- Voice hero and voice fulfillment context.
- Result actions: continue, replay, play another game.
- Streak displays in per-game result screens.
- Mock weekly streak on `/activities`.
- Avoids same-day content repetition in Supabase-backed games.
- TTS and speech recognition support in memory-game experiences.
- Default Brain Coach scheduled support.

### Gaps

- Real streaks are not unified across the whole Brain Coach.
- No achievements, badges, streak freeze, personal goals, or weekly plan.
- No "today's training plan" across domains.
- No lapse recovery after missed sessions.
- No clear caregiver or family encouragement loop.
- No habit calendar based on actual play.

## 10. User Retention Mechanisms

### What Exists

- Default Brain Coach schedule three days per week.
- Per-game streak counters.
- Result actions encourage another session.
- Voice can encourage activity choice.
- Scheduled support settings can show Brain Coach schedules.

### Gaps

- Scheduled sessions are not tied to actual game completion.
- Missed Brain Coach sessions do not trigger a lighter recovery path.
- There is no lifecycle state such as new, active, at-risk, lapsed, recovered.
- No push/SMS/email reminder flow specific to Brain Coach outcomes.
- No caregiver digest of cognitive engagement.
- No experimentation framework for retention mechanics.

## 11. Missing Capabilities and Gap Analysis

| Gap | Impact | Complexity | Implementation effort |
| --- | --- | --- | --- |
| Unified Brain Coach data model and analytics index | High: enables real progress, retention, recommendations, caregiver reports, and voice context | Medium | 4-7 days |
| Server-backed memory-game persistence | High: fixes cross-device loss and makes memory games available to caregivers/voice/schedules | Medium | 3-5 days |
| `cognitive_session_index` migration and writer coverage for all games | High: current Number Trails write targets a missing table and other games lack a shared index | Medium | 2-4 days |
| Wire cognitive onboarding into game selection, pace, support, and schedule defaults | High: converts collected data into visible personalization | Medium | 3-6 days |
| Complete or hide stubbed memory games | Medium-high: current hub can send users to "Coming soon" experiences | Low-medium | 2-5 days |
| Standardized score normalization by domain | High: needed for longitudinal progress and fair recommendations | Medium | 4-7 days |
| Central recommendation engine across all Brain Coach games | High: moves from isolated games to a coherent training plan | Medium-high | 1-2 weeks |
| Baseline assessment and periodic reassessment | High: expected in mature products and necessary for personalization claims | High | 2-4 weeks |
| Adaptive engine beyond thresholds | High: improves fit, reduces frustration, and supports older-adult accessibility | High | 2-3 weeks |
| Real Brain Coach dashboard for user/caregiver/admin | Medium-high: makes progress visible and supports retention | Medium | 1-2 weeks |
| Evidence and claims guardrails | High: reduces risk around dementia, MCI, and cognitive-improvement claims | Low | 1-2 days |
| Senior accessibility personalization | Medium-high: improves usability for hearing, vision, motor, and cognitive support needs | Medium | 1-2 weeks |
| Voice coach connected to game state and actions | Medium-high: VYVA's voice-first advantage is underused today | Medium | 1 week |
| Lapse recovery and habit loop | Medium-high: improves retention and lowers abandonment | Medium | 1-2 weeks |
| Analytics and experimentation instrumentation | High: necessary to rank future improvements by real behavior | Medium | 1 week |
| Localization parity for Supabase-seeded games | Medium: app supports six languages, but several seeded games emphasize three | Medium | 1 week |
| Anti-tamper/server validation for game result writes | Medium: direct Supabase writes rely on RLS but not server-side score validation | Medium | 1 week |

## 12. Comparison Against Leading Cognitive-Training Products for Older Adults

### Benchmark Summary

| Product | Relevant benchmark | VYVA status |
| --- | --- | --- |
| BrainHQ | Dozens of exercises across memory, attention, speed, people skills, decision-making, and navigation; per-exercise adaptation; progress reporting; personal trainer; evidence base including ACTIVE study | VYVA has strong category breadth for an early product, especially navigation, face-name, dual task, and Trails-like tasks. It lacks BrainHQ-level unified reporting, mature adaptive training, exercise volume, and evidence framing. |
| CogniFit | Baseline assessment, personalized training, targeted cognitive abilities, ongoing adjustment of future sessions | VYVA collects cognitive profile preferences but does not yet assess baseline ability or build a personalized plan from measured cognitive strengths/weaknesses. |
| Lumosity | Broad game catalog, tutorials, detailed progress, habit support | VYVA has fewer complete games and fragmented progress. It has a stronger senior-care and voice-coach context, but less mature habit/product analytics. |
| NeuroNation | Fitness test, personalized training plan, flexible algorithm that can change exercise selection and sequence, progress saved to account | VYVA lacks account-backed memory history and a central plan. Supabase-backed games adapt locally, but not through one cross-game algorithm. |
| Elevate | 40+ games, personalized daily workouts, adaptive difficulty, detailed performance tracking, streak calendar | VYVA has early daily/scheduled mechanics but no true daily workout, streak calendar from real data, or broad skill report. |
| AARP Staying Sharp | Older-adult framing, brain-health challenges, education and habit content | VYVA has a stronger interactive game/voice layer, but lacks educational brain-health journeys and lifestyle challenge content. |

### Competitive Position

VYVA's differentiator is not being another generic brain-game app. Its moat could be "cognitive training inside a senior care companion": voice support, caregiver permissions, scheduled support, health context, medication context, social support, and accessibility-aware pacing.

To win against mature cognitive-training apps, VYVA should not try to out-catalog them first. The better path is:

1. Make progress real and persistent.
2. Turn onboarding and game results into a gentle personalized plan.
3. Use voice and caregiver context to keep older adults engaged safely.
4. Maintain strict evidence and claims boundaries.

## ROI-Ranked Improvement Plan

| Rank | Improvement | ROI rationale |
| --- | --- | --- |
| 1 | Create a unified `brain_coach_sessions` or `cognitive_session_index` model and populate it from all games | Highest leverage. Unlocks dashboards, recommendations, streaks, retention, and voice context. |
| 2 | Move memory-game history from localStorage to server-backed persistence with local fallback | High user impact and required for any meaningful progress story. |
| 3 | Replace mock `/activities` streak with real Brain Coach completion data | Low complexity, visible trust improvement. |
| 4 | Wire cognitive onboarding preferences into recommendations, session length, schedule defaults, and instruction style | Uses already-collected data and makes personalization tangible. |
| 5 | Complete or remove stubbed memory games from selectable recommendation paths | Prevents disappointment and cleans the user journey quickly. |
| 6 | Normalize scoring into domain-level metrics and trend summaries | Enables reporting and better adaptation; medium implementation cost. |
| 7 | Build a Brain Coach "Today" plan across memory, attention, executive, spatial, and language | Turns isolated games into a product experience. |
| 8 | Add caregiver/user progress summary cards | Strong fit for VYVA's care platform and older-adult support model. |
| 9 | Add claims guardrails and "wellness, not diagnosis" copy around Brain Coach | Low effort, high risk reduction. |
| 10 | Connect scheduled Brain Coach calls to actual completion, missed sessions, and lapse recovery | Improves retention after the data model exists. |
| 11 | Upgrade adaptation to use response time, error type, fatigue, and support needs | High product quality but depends on normalized metrics. |
| 12 | Add baseline assessment and periodic reassessment | Strategic and high value, but requires careful design and validation. |
| 13 | Expand localized seeded content to all supported app languages | Good polish after core analytics and plan are fixed. |
| 14 | Add experimentation and cohort analytics | Needed for scale, but depends on unified event data. |

## Detailed Recommendations

### A. Establish One Brain Coach Record

Create a shared session/index table with fields such as:

- `user_id`
- `game`
- `source_session_id`
- `played_at`
- `domain_primary`
- `domain_secondary`
- `difficulty_scale`
- `difficulty_level`
- `completed`
- `abandoned`
- `duration_seconds`
- `raw_score`
- `normalized_score`
- `accuracy_pct`
- `speed_pct`
- `error_count`
- `response_time_ms`
- `language`
- `input_mode`
- `support_mode`
- `metadata`

Use this table as the source for activity streaks, retention, dashboards, voice context, and recommendations.

### B. Persist Memory Games Server-Side

Replace the current local-only adapter with:

- server adapter for authenticated users;
- localStorage fallback for offline/anonymous use;
- migration path from localStorage to server after login;
- dedupe by `variantId`, `completedAt`, and user.

### C. Build the Brain Coach Plan Engine

The plan engine should choose:

- today's recommended domain;
- game;
- level/tier;
- support style;
- session length;
- reason label;
- recovery path after missed/low-performance sessions.

Inputs should include:

- cognitive onboarding;
- recent game history;
- weekly goal;
- fatigue/frustration signals;
- language and accessibility preferences;
- scheduled support context.

### D. Normalize Scores and Trends

Add domain-level rollups:

- visual memory;
- working memory;
- episodic memory;
- associative memory;
- attention;
- processing speed;
- executive function;
- language/comprehension;
- spatial navigation;
- social recognition.

Report trends cautiously as "practice progress" unless clinically validated.

### E. Strengthen Evidence Boundaries

Avoid claims that Brain Coach prevents, treats, delays, or diagnoses dementia, Alzheimer's disease, MCI, or other conditions unless supported by appropriate clinical evidence and review. Position VYVA Brain Coach as supportive practice, engagement, and routine-building.

## Source Highlights

- BrainHQ describes specialized exercises across memory, attention, brain speed, people skills, decision-making, and navigation, adaptive exercise difficulty, progress tracking, and schedule design: https://www.brainhq.com/
- BrainHQ Personal Trainer selects exercise levels and builds schedules: https://support.brainhq.com/hc/en-us/articles/360033432171-How-the-Personal-Trainer-picks-exercises
- BrainHQ progress reporting includes per-exercise level history: https://support.brainhq.com/hc/en-us/articles/360031596571-How-do-I-track-my-progress-for-a-specific-exercise
- BrainHQ/ACTIVE study page describes NIH-funded older-adult cognitive training research: https://www.brainhq.com/world-class-science/information-researchers/active-study/
- NIH reported in February 2026 that an ACTIVE speed-training regimen was linked with reduced Alzheimer disease and related dementia diagnoses over 20 years: https://www.nih.gov/news-events/news-releases/cognitive-speed-training-over-weeks-may-delay-diagnosis-dementia-over-decades
- Lumosity describes 40+ games, progress tracking, tutorials, and cognitive-skill challenges: https://www.lumosity.com/ and https://www.lumosity.com/en/brain-training/
- CogniFit describes personalized training programs, baseline assessment, and adjustment across sessions: https://support.cognifit.com/s/article/information-about-training and https://support.cognifit.com/CogniFit-FAQ/
- NeuroNation describes a fitness-test-based personalized plan that can adjust exercise selection and sequence: https://support.neuronation.de/hc/en-us/articles/201813982-Training-plan
- Elevate describes personalized daily workouts, adaptive difficulty, detailed tracking, and a streak calendar: https://support.elevateapp.com/hc/en-us/articles/4402922583067-What-is-Elevate
- AARP Staying Sharp frames older-adult brain-health challenges as educational/informational habit content: https://stayingsharp.aarp.org/about/brain-health/challenges-overview/
- FTC Lumosity action is an important caution for claims about age-related cognitive decline, dementia, Alzheimer's disease, and real-world cognitive improvement: https://www.ftc.gov/news-events/news/press-releases/2016/01/lumosity-pay-2-million-settle-ftc-deceptive-advertising-charges-its-brain-training-program
