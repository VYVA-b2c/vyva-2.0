# Cognitive Compass — English item-by-item review

Date: 2026-10-04. Source: `node scripts/export-cc-content-audit.mjs en` run
against Development after the Production → Development copy. It covers 120
`story_recall_immediate` rows and 60 `similarities` rows. Companion to
`cognitive-compass-en-content-audit.md`.

## Verdict

| Bank | Verdict |
|---|---|
| **Stories (120)** | **The story text can be saved; the idea units can't.** The bodies are plain and readable and avoid age references or distressing content. But every story ends with a recycled stock sentence, about ten form near-duplicate clusters, and the idea units are a mechanical word dump that the current scorer turns into "count shared words". Fix the endings, drop the duplicates, regenerate every idea-unit list, then review. |
| **Similarities (60)** | **Keep 25, revise 4, replace 31.** Tiers 1–2 are sound. Most of tiers 3–5 are metaphor and analogy items with no defensible shared category, so a 2/1/0 rule can't score them reliably. The answer examples also mislabel concrete answers as abstract. |

Nothing here needs to be regenerated from scratch.

---

## Stories

### S1. Every story ends with a stock sentence (systemic)

Every one of the 120 bodies ends with `<Name> <stock phrase> the <title>`,
drawn from roughly 14 templates:

- "…set the X straight before leaving the room."
- "…left the X close to the table." / "…where it was easy to reach."
- "…placed the X in the soft light."
- "…kept the X beside a clean cloth."
- "…made sure the X had enough space." / "…made the X look neat and ready."
- "…put the X back in its usual spot."
- "…checked that the X still looked tidy." / "…checked the X one last time."
- "…gave the X a final careful look." / "…looked over the X with a small smile."
- "…noted the X on a small paper." / "…placed one small note beside the X."
- "…brushed the nearby surface once more."

Consequences:

- **They don't fit the stories.** Examples:
  - Marion "set the **rainy walk** straight before leaving the room."
  - Nina "left the **bus seat** close to the table" (she's at a bus stop).
  - James "placed the green bell in the soft light" (the bell is bolted to his bicycle).
  - Isaac's rain gauge (outdoors, by a fence) and Bernard's garden bench both end "before leaving the room".
  - Andrew's wall-fixed lantern hook ends "in the soft light".
  - Leah "kept the apple pie beside a clean cloth."
- **Grammar:** "put the bookends / tile coasters / map magnets / hammock straps back in **its** usual spot" (Victor, Nathan, Jack, Denise).
- **They give away credit in the delayed recall.** After a few weekly sessions a member knows the endings, and the endings are scored (see S3). For Aaron and Simon, "checked it one last time" alone matches 3 of 22 units.

**Fix:** delete the last sentence of every story. This is mechanical and the
stories still read complete without it (about 35–45 words). Then regenerate
the idea units (S3).

### S2. Near-duplicate clusters (interference across weeks)

Weekly use means a member will meet several of these. Similar stories blur
together in memory, which costs recall and adds noise to the trend.

| Cluster | Stories | Overlap |
|---|---|---|
| A | **Max's Biscuit Tin** ↔ **Frank's Biscuit Label** | oat biscuits, counted twelve, "before the chess/card group arrived", tin, two o'clock / blue ink. Keep one. |
| B | **Evelyn's Tea Caddy** ↔ **Emma's Sugar Tin** | refilled a tin on the counter, poured from a paper packet/bag, "tapped the lid closed", scoop beside. Keep one. |
| C | **Felix's Workshop Pegs** ↔ **Malcolm's Peg Board** (+ Keith's Wall Hooks, Bruce's Tool Apron) | hung tape, scraper and small brush in a row, drew a line under the row. Keep one of Felix/Malcolm; the other two are borderline. |
| D | **Lydia's Garden Markers** ↔ **Cynthia's Herb Labels** | wrote three plant names on wooden sticks, let them dry, placed them by the plants. Keep one. |
| E | **Hazel's Fruit Bowl** ↔ **Susan's Clay Bowl** | fruit (green apples) arranged in a bowl, cloth or napkin under it, on the table before lunch. Keep one. |
| F | **Rebecca's Wool Blanket** ↔ **Laura's Orange Scarf** | "aired" over a rail or chair back, brushed off, folded. Keep one. |
| G | **Louise's Ribbon Bookmark** ↔ **Colin's Bird Bookmark** | handmade bookmark, tied string or ribbon, put in a book. Keep one. |
| H | **Maria's Fruit Tags** ↔ **Ingrid's Fruit Stall** ↔ **Thomas's Chalkboard Sign** | fruit labels and signs at a market. Keep at most two. |
| I | **Grace's Letter Tray** ↔ **Wendy's Desk Drawer** ↔ **Olivia's Stationery Box** | sorting small desk items into slots. Keep at most two. |
| J | **Peter's Shell Jar** ↔ **Barbara's Shell Frame** | counted shells, placed by a picture of the sea. Borderline. |

Removing one from each clear pair (A, B, C, D, E, F, G) and trimming H and I
cuts about 10 stories, leaving about 110. That's still more than two years of
weekly sessions without a repeat, once selection tracks what each member has
already seen.

Weaker themes that also recur: sewing-table scenes (Sara, Helen, Angela,
Molly, Julia, Florence, Nora) and craft-table paper crafts (Valerie, Hannah,
Sophie, Eric). Keep them, but don't let selection serve two from the same
theme within a few weeks.

### S3. Idea units are a word dump, and the scorer makes it worse (systemic)

Each list is the first ~22 content tokens of the story, auto-tagged. Problems
seen across the bank:

- **Function words and adverbs counted as ideas:**
  - adverbs tagged as objects: `object_gently`, `object_softly`, `object_slightly`, `object_carefully`
  - modal and filler words: `object_could` (Raymond), `object_still` (Oliver, Wendy, Ruby), `object_sure`, `object_enough` (Richard, Daniel), `object_where`, `object_easy` (Amelia, Patrick)
  - prepositions: `object_away`, `object_between`, `object_around`, `object_along`, `object_through`, `object_about`, `object_until`, `object_toward`, `object_below`
  - common verbs: `object_just`, `object_like`, `object_other`, `object_put`, `object_took`, `object_saw`, `object_said`, `object_went`, `object_came`, `object_gave`, `object_look`, `object_let`, `object_ones`
  - Olivia's "thank you" split into `object_thank` and `object_you`.
- **Wrong categories:**
  - the verb "checked" tagged `color_checked` (Aaron, Simon, Arthur, Trevor, Julia, Paula, Denise, Pamela and others)
  - "card" tagged as a place (`location_card`: Megan, Betty, Alice, Trevor, Charles)
  - "tea spoons" → `time_tea` (Vera); "card group" → `time_group`
  - "to the left" / "left hook" → `action_left` (Edward, Ruby)
  - adjectives tagged as actions: "drying rack" → `action_drying`, "measuring jug" → `action_measuring`, "folding seat" → `action_folding`, "painted tiles" → `action_painted`
  - "clear sound" / "clear lines" → `color_clear`
  - "garden books" → `location_garden` (Sylvia); "library book" → `location_library` (Louise)
- **One idea counted three times:** almost every list has `main_object_toy_boats` plus `object_toy` plus `object_boats`, and the character's name is a unit of its own. Recalling the title earns about 3 units.
- **The back half of the story is unscored.** The list stops at 22 tokens, so later details never count:
  - Owen: "the date on blue labels"
  - Nina: "seat twelve"
  - Sylvia: "the striped bag"
  - Elaine: "both hands"

  Recall that follows the end of a story is under-credited.
- **Stock-ending words are scored.** `object_sure`, `object_enough`, `object_noted`, `object_soft`, `object_light`, `object_last` and `quantity_one` come from the S1 sentences.

Together with the any-token match in `shared/cognitiveStoryRecallScoring.ts`,
generic text earns credit for stories the member never read. The sentence
*"I placed a small blue cloth on the table and set it down"* matches:

- **Hazel's Fruit Bowl:** 5 of 22 units (`placed`, `blue`, `cloth`, `table`, `set`)
- **Margaret's Glass Pitcher:** 3 of 22
- **Susan's Clay Bowl:** 2 of 22

Words like *placed, set, small, blue, table, cloth, window* run through dozens
of stories, so an ordinary description of any tidy room scores a few units on
most of the bank.

**Fix:** regenerate every idea-unit list under one written rule, and switch the
scorer to that format. Proposed rule (product-design rationale, not a sourced
norm):

- 12–16 units per story, each a **proposition** ("Joan floated toy boats",
  "in a basin on the patio", "one boat had a blue flag"), not a single word.
- Each unit lists its key words plus accepted variants and synonyms
  (`boat|boats|ship`, `basin|tub|bowl`).
- No function words, adverbs or stock-ending content. Name and title count
  once.
- Cover the whole story, beginning to end.
- An LLM may draft the lists. A human reviews them in the admin review surface
  before activation.

The scorer then credits a unit only when its required key words, or their
variants, appear. That follows the idea-unit approach of logical-memory
paradigms; any cut-offs on top of it remain unvalidated product design.

### S4. Stories with a specific defect (beyond S1–S3)

| Story | Issue |
|---|---|
| Sara's Sewing Pattern | "marked the **sleeve** line" on an **apron** pattern. Aprons have no sleeves. |
| Sylvia's Library Card | The title names a library card, but the story is about returning books and a yellow card from a poster. Retitle. |
| Marion's Rainy Walk / Nina's Bus Seat | The title is an activity or place, so the stock ending makes no sense. Fixed by S1. |
| Samuel's Garden Seat | "tested the seat with a nod" is unclear. Rewrite. |
| Owen's Lemon Jam | Sliced lemons with sugar is marmalade. Minor; retitle or leave. |
| Victor / Nathan / Jack / Denise | "its" with a plural noun. Fixed by S1. |

### S5. Character and setting patterns (observation)

- Names are uniformly Anglophone. That's fine for EN; check that ES/DE/FR/PT localize names and settings rather than translating these.
- The tasks follow gender lines throughout: women sew, bake and arrange; men work in the workshop, garage and with tools (Rita's door stop is the exception). It's harmless in any one story, but it stands out across a bank of 120. Balance it while editing.
- All stories are plotless sequences of chores, with almost no goal, problem or outcome (Nina's scarf is the exception). Product-design note: gist recall is easier when something happens. If the bodies are edited anyway, a one-clause event per story would make them more distinct.

---

## Similarities

### Issues across the bank

1. **Tiers 3–5 are mostly metaphor and analogy items**, not similarities.
   Pairs like window–question, compass–promise, hinge–conversation,
   zipper–summary and teapot–host have no shared superordinate category. The
   "abstract" answer is one writer's metaphor ("They both allow opening"). A
   member who finds a different, equally good metaphor gets nothing from an
   example-matching scorer, and a human rater would disagree too. Several also
   rest on English idioms (thread of a story, anchor, lantern as guidance) that
   won't carry evenly into the other four languages.
2. **The answer examples mislabel concrete as abstract.** In 2/1/0 logic, a
   shared category or essential function earns 2, a shared physical property
   earns 1, and a difference or a description of each item separately earns 0.
   The bank breaks this:
   - "Small, round objects" (button–coin), "solid and steady" (stone–table) and "soft and light" (cotton–cloud) are listed as **abstract**, but they're physical properties (1 point).
   - Many **concrete** examples are two separate statements, one per item ("A clock shows the hour." / "A calendar shows the day."). They state no likeness and would score 0. That's true for most of tiers 4–5 and several in tiers 2–3.

   Neither example list can be used as a scoring anchor as it stands.
3. **Repeated words make items near-duplicates:**
   - seed–idea (T3) and seed–question (T5) have the same answer.
   - lantern–advice (T4) and lantern–example (T5) have the same answer.
   - bookmark–memory (T4) and echo–memory (T5); thread–path (T3) and thread–story (T4); window–picture (T3) and window–question (T4).

   With 4 items per session drawn without regard to what a member has seen, these will co-occur.
4. **Tiers are a quota (12 each), not a calibration.** clock–metronome (T4) is
   easier than most of T3, and basket–bag, lamp–candle and oven–toaster (T2)
   are effectively tier 1.
5. **Content note:** "memory" appears twice, in a memory check-in. Avoid it.

### Item table

K = keep · R = revise examples or tier · X = replace

| T | Pair | | Note |
|---|---|---|---|
| 1 | shirt–coat | K | clothing |
| 1 | cup–glass | K | drinking vessels |
| 1 | chair–sofa | K | furniture |
| 1 | robin–sparrow | K | birds ("small animals" is the weaker example) |
| 1 | apple–orange | K | fruit |
| 1 | rose–tulip | K | flowers |
| 1 | bed–pillow | X | Associated objects or part–whole, no superordinate. "Belong in a bedroom" is a location, not a category. |
| 1 | bread–rice | K | staple foods |
| 1 | bus–train | K | transport |
| 1 | cat–dog | K | animals / pets |
| 1 | spoon–fork | K | cutlery |
| 1 | pencil–pen | K | writing tools |
| 2 | needle–tape | K | tools for joining or fastening |
| 2 | umbrella–roof | K | shelter from rain |
| 2 | map–sign | K | sources of direction |
| 2 | notebook–envelope | R | Concrete examples describe each item separately (0-point). Rewrite them. |
| 2 | broom–cloth | K | cleaning tools; fix the concrete examples |
| 2 | basket–bag | K | containers; really tier 1 |
| 2 | clock–calendar | K | time-keeping; fix the concrete examples |
| 2 | radio–phone | K | add "communication devices" to the abstract examples |
| 2 | key–handle | R | Weak link. A handle doesn't control access the way a key does. Rework or swap the pair. |
| 2 | fence–gate | R | Part–whole ("a gate can be part of a fence"). Replace or reframe as "barriers". |
| 2 | lamp–candle | K | light sources; really tier 1 |
| 2 | oven–toaster | K | kitchen appliances; really tier 1 |
| 3 | thread–path | X | visual metaphor only |
| 3 | book–garden | X | no defensible shared category |
| 3 | cotton–cloud | X | perceptual only; both example lists are 1-point |
| 3 | bell–whistle | K | signalling devices; move to tier 2 |
| 3 | window–picture | X | frame or view metaphor; repeats "window" |
| 3 | button–coin | X | shape only (1-point), labelled abstract |
| 3 | recipe–map | K | sets of instructions or guides; a good item |
| 3 | stone–table | X | property only |
| 3 | ribbon–river | X | shape only |
| 3 | seed–idea | X | metaphor; duplicates seed–question |
| 3 | mirror–water | X | reflective surfaces = property (1-point) |
| 3 | blanket–tea | X | "comfort" is too subjective to score |
| 4 | window–question | X | metaphor |
| 4 | root–address | X | metaphor |
| 4 | bookmark–memory | X | metaphor; "memory" |
| 4 | net–plan | X | metaphor |
| 4 | shelf–schedule | K | organizing systems; defensible abstraction |
| 4 | compass–promise | X | metaphor |
| 4 | button–habit | X | metaphor |
| 4 | thread–story | X | English idiom |
| 4 | clock–metronome | R | Easy: both keep time. Move to tier 2. |
| 4 | anchor–routine | X | metaphor |
| 4 | lantern–advice | X | metaphor; duplicates lantern–example |
| 4 | bridge–telephone | K | connections across distance; defensible |
| 5 | frame–rule | X | metaphor |
| 5 | curtain–pause | X | metaphor |
| 5 | recipe–tradition | K | knowledge passed down; defensible |
| 5 | garden–friendship | X | metaphor; sentimental |
| 5 | hinge–conversation | X | metaphor |
| 5 | pocket–secret | X | metaphor |
| 5 | zipper–summary | X | metaphor |
| 5 | teapot–host | X | metaphor |
| 5 | lantern–example | X | metaphor; duplicate |
| 5 | seed–question | X | metaphor; duplicate |
| 5 | echo–memory | X | metaphor; "memory" |
| 5 | knot–agreement | X | idiom-dependent |

Totals: 25 K, 4 R, 31 X. Five pairs also change tier (bell–whistle, basket–bag, lamp–candle, oven–toaster, clock–metronome).

**Replacement principle** (product-design rationale): higher tiers should
reach **less obvious shared categories**, not metaphors. Each pair should have
one defensible superordinate that a rater would accept, plus listed 1-point
answers (a shared property) and 0-point answers (a difference, or each item
described separately). Write original pairs. Don't take items from published
instruments; WAIS Similarities items are copyrighted.

---

## Order of work

1. **Stories:** delete the stock ending (mechanical), drop the near-duplicates, fix the S4 items.
2. **Idea units:** regenerate under the S3 rule, and change the scorer to match propositions with variants. Do this together with the shared-scoring work (content audit §7 step 2), not separately.
3. **Similarities:** replace 31, revise 4, retier 5, rewrite every example list against the 2/1/0 rubric.
4. **Review:** everything through the admin review surface. Edited rows land `is_active = false` until approved, per the content-pipeline rule.
5. **Other languages:** they were generated separately, so expect the same template defects. Review DE and ES next (DRK and Zamora).
