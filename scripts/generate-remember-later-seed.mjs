import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const outputPath = resolve("migrations/0040_remember_later.sql");

export const ONGOING_RULES = [
  "shape_circle",
  "shape_square",
  "shape_triangle",
  "color_red",
  "color_blue",
  "color_yellow",
  "number_even",
  "number_odd",
];

const CUE_ICONS = ["bell", "moon", "key", "leaf", "heart", "sparkle", "flag", "music"];

export const TIER_SETTINGS = [
  { tier: 1, roundType: "event_based", duration: 35, items: 18, interval: 1900, responseWindow: 4 },
  { tier: 2, roundType: "event_based", duration: 40, items: 20, interval: 1900, responseWindow: 3 },
  { tier: 3, roundType: "event_based", duration: 45, items: 24, interval: 1800, responseWindow: 3 },
  { tier: 4, roundType: "event_based", duration: 50, items: 28, interval: 1750, responseWindow: 2 },
  { tier: 5, roundType: "time_based", duration: 60, items: 32, interval: 1700, tolerance: 10 },
  { tier: 6, roundType: "time_based", duration: 65, items: 35, interval: 1700, tolerance: 8 },
  { tier: 7, roundType: "time_based", duration: 75, items: 40, interval: 1750, tolerance: 8 },
  { tier: 8, roundType: "time_based", duration: 85, items: 45, interval: 1800, tolerance: 6 },
  { tier: 9, roundType: "dual", duration: 95, items: 50, interval: 1750, tolerance: 8, responseWindow: 3 },
  { tier: 10, roundType: "dual", duration: 110, items: 55, interval: 1850, tolerance: 5, responseWindow: 2 },
];

function deterministicUuid(input) {
  const chars = createHash("sha1").update(input).digest("hex").slice(0, 32).split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const hex = chars.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function createRng(seedText) {
  let state = Number.parseInt(createHash("sha1").update(seedText).digest("hex").slice(0, 8), 16) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function integerBetween(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function shuffle(random, items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function matchCountFor(itemCount) {
  return Math.floor(itemCount * 0.45);
}

function middleIndexRange(itemCount) {
  return {
    min: Math.ceil(itemCount * 0.2),
    max: Math.floor(itemCount * 0.8) - 1,
  };
}

function middleDelayRange(durationSeconds) {
  return {
    min: Math.ceil(durationSeconds * 0.5),
    max: Math.floor(durationSeconds * 0.7),
  };
}

function itemForRule(rule, shouldMatch, random) {
  const shapeValues = ["circle", "square", "triangle"];
  const colorValues = ["red", "blue", "yellow"];
  const evenValues = [2, 4, 6, 8];
  const oddValues = [1, 3, 5, 7, 9];
  const [category, value] = rule.split("_");

  if (category === "shape") {
    const pool = shouldMatch ? [value] : shapeValues.filter((entry) => entry !== value);
    return {
      type: "shape",
      value: pool[Math.floor(random() * pool.length)],
      matches_rule: shouldMatch,
    };
  }

  if (category === "color") {
    const pool = shouldMatch ? [value] : colorValues.filter((entry) => entry !== value);
    return {
      type: "color",
      value: pool[Math.floor(random() * pool.length)],
      matches_rule: shouldMatch,
    };
  }

  const pool = shouldMatch
    ? value === "even" ? evenValues : oddValues
    : value === "even" ? oddValues : evenValues;

  return {
    type: "number",
    value: pool[Math.floor(random() * pool.length)],
    matches_rule: shouldMatch,
  };
}

function eventIntention(settings, random, variant, maxCuePositionIndex = null) {
  const { min, max } = middleIndexRange(settings.items);
  const boundedMax = maxCuePositionIndex == null ? max : Math.min(max, maxCuePositionIndex);
  assert(boundedMax >= min, `No valid event cue range for tier ${settings.tier}.`);
  const cuePositionIndex = integerBetween(random, min, boundedMax);
  const cueIcon = CUE_ICONS[(settings.tier + variant) % CUE_ICONS.length];

  return {
    type: "event",
    cue_icon: cueIcon,
    cue_position_index: cuePositionIndex,
    response_window_items: settings.responseWindow,
  };
}

function timeIntention(settings, random, forbiddenCueIndex = null) {
  const { min, max } = middleDelayRange(settings.duration);
  const cueSecond = forbiddenCueIndex == null
    ? null
    : (forbiddenCueIndex * settings.interval) / 1000;

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const targetDelay = integerBetween(random, min, max);
    if (cueSecond == null || Math.abs(targetDelay - cueSecond) >= 15) {
      return {
        type: "time",
        target_delay_seconds: targetDelay,
        tolerance_seconds: settings.tolerance,
      };
    }
  }

  throw new Error(`Could not place separated time intention for tier ${settings.tier}.`);
}

function buildFillerStream(settings, rule, cuePositionIndex, random) {
  const indices = Array.from({ length: settings.items }, (_, index) => index);
  const tappableIndices = cuePositionIndex == null ? indices : indices.filter((index) => index !== cuePositionIndex);
  const matches = new Set(shuffle(random, tappableIndices).slice(0, matchCountFor(settings.items)));

  return indices.map((index) => {
    if (index === cuePositionIndex) {
      return {
        type: "icon",
        value: "cue",
        icon: "cue",
        matches_rule: false,
        cue: true,
      };
    }

    return itemForRule(rule, matches.has(index), random);
  });
}

export function buildRememberLaterRounds() {
  const rows = [];

  TIER_SETTINGS.forEach((settings) => {
    for (let variant = 1; variant <= 20; variant += 1) {
      const random = createRng(`remember-later:${settings.tier}:${variant}`);
      const ongoingRule = ONGOING_RULES[(settings.tier + variant - 2) % ONGOING_RULES.length];
      const intentions = [];
      let cuePositionIndex = null;

      if (settings.roundType === "event_based" || settings.roundType === "dual") {
        const maxCuePositionIndex = settings.roundType === "dual"
          ? Math.floor((middleDelayRange(settings.duration).min - 15) / (settings.interval / 1000))
          : null;
        const intention = eventIntention(settings, random, variant, maxCuePositionIndex);
        cuePositionIndex = intention.cue_position_index;
        intentions.push(intention);
      }

      if (settings.roundType === "time_based" || settings.roundType === "dual") {
        intentions.push(timeIntention(settings, random, cuePositionIndex));
      }

      const fillerStream = buildFillerStream(settings, ongoingRule, cuePositionIndex, random);

      rows.push({
        id: deterministicUuid(`remember-later:${settings.tier}:${variant}`),
        round_type: settings.roundType,
        difficulty_tier: settings.tier,
        round_duration_seconds: settings.duration,
        ongoing_task_rule: ongoingRule,
        filler_stream: fillerStream,
        filler_item_count: settings.items,
        filler_item_interval_ms: settings.interval,
        intentions,
      });
    }
  });

  validateRounds(rows);
  return rows;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateRound(row) {
  const settings = TIER_SETTINGS.find((entry) => entry.tier === row.difficulty_tier);
  assert(settings, `Missing tier settings for ${row.difficulty_tier}.`);
  assert(row.round_type === settings.roundType, `Tier ${row.difficulty_tier} has wrong round type.`);
  assert(row.round_duration_seconds === settings.duration, `Tier ${row.difficulty_tier} has wrong duration.`);
  assert(row.filler_item_count === settings.items, `Tier ${row.difficulty_tier} has wrong item count.`);
  assert(row.filler_stream.length === row.filler_item_count, `Round ${row.id} filler length mismatch.`);
  assert(ONGOING_RULES.includes(row.ongoing_task_rule), `Round ${row.id} has invalid rule.`);

  const matchRatio = row.filler_stream.filter((item) => item.matches_rule).length / row.filler_item_count;
  assert(matchRatio >= 0.4 && matchRatio <= 0.5, `Round ${row.id} match ratio ${matchRatio} is outside 40-50%.`);

  const event = row.intentions.find((entry) => entry.type === "event");
  const time = row.intentions.find((entry) => entry.type === "time");

  if (row.round_type === "event_based") {
    assert(Boolean(event) && !time, `Round ${row.id} should have one event intention.`);
  }
  if (row.round_type === "time_based") {
    assert(Boolean(time) && !event, `Round ${row.id} should have one time intention.`);
  }
  if (row.round_type === "dual") {
    assert(Boolean(event) && Boolean(time) && row.intentions.length === 2, `Round ${row.id} should have dual intentions.`);
  }

  if (event) {
    const { min, max } = middleIndexRange(row.filler_item_count);
    assert(event.cue_position_index >= min && event.cue_position_index <= max, `Round ${row.id} event cue is outside middle zone.`);
    assert(row.filler_stream[event.cue_position_index]?.cue === true, `Round ${row.id} missing cue item.`);
    assert(event.response_window_items === settings.responseWindow, `Round ${row.id} has wrong response window.`);
  }

  if (time) {
    const { min, max } = middleDelayRange(row.round_duration_seconds);
    assert(time.target_delay_seconds >= min && time.target_delay_seconds <= max, `Round ${row.id} time target is outside middle zone.`);
    assert(time.tolerance_seconds === settings.tolerance, `Round ${row.id} has wrong tolerance.`);
  }

  if (event && time) {
    const cueSecond = (event.cue_position_index * row.filler_item_interval_ms) / 1000;
    assert(Math.abs(time.target_delay_seconds - cueSecond) >= 15, `Round ${row.id} dual cues are too close.`);
  }
}

export function validateRounds(rows) {
  assert(rows.length === 200, `Expected 200 Remember Later rounds, got ${rows.length}.`);

  TIER_SETTINGS.forEach((settings) => {
    const tierRows = rows.filter((row) => row.difficulty_tier === settings.tier);
    assert(tierRows.length === 20, `Expected 20 rounds for tier ${settings.tier}, got ${tierRows.length}.`);
    const rules = new Set(tierRows.map((row) => row.ongoing_task_rule));
    ONGOING_RULES.forEach((rule) => {
      assert(rules.has(rule), `Tier ${settings.tier} is missing rule ${rule}.`);
    });
  });

  rows.forEach(validateRound);
  return true;
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonSql(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function valuesSql(rows) {
  return rows.map((row) => `(
  ${sqlString(row.id)},
  ${sqlString(row.round_type)},
  ${row.difficulty_tier},
  ${row.round_duration_seconds},
  ${sqlString(row.ongoing_task_rule)},
  ${jsonSql(row.filler_stream)},
  ${row.filler_item_count},
  ${row.filler_item_interval_ms},
  ${jsonSql(row.intentions)}
)`).join(",\n");
}

export function generateSql(rows = buildRememberLaterRounds()) {
  return `create extension if not exists pgcrypto;

create table if not exists public.remember_later_rounds (
  id uuid primary key default gen_random_uuid(),
  round_type text not null check (round_type in ('event_based', 'time_based', 'dual')),
  difficulty_tier integer not null check (difficulty_tier between 1 and 10),
  round_duration_seconds integer not null,
  ongoing_task_rule text not null check (
    ongoing_task_rule in (
      'shape_circle',
      'shape_square',
      'shape_triangle',
      'color_red',
      'color_blue',
      'color_yellow',
      'number_even',
      'number_odd'
    )
  ),
  filler_stream jsonb not null,
  filler_item_count integer not null,
  filler_item_interval_ms integer not null,
  intentions jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.remember_later_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  played_at timestamptz not null default now(),
  round_id uuid references public.remember_later_rounds(id),
  difficulty_tier integer not null check (difficulty_tier between 1 and 10),
  round_type text not null check (round_type in ('event_based', 'time_based', 'dual')),
  ongoing_correct integer not null default 0,
  ongoing_total integer not null default 0,
  ongoing_false_alarms integer not null default 0,
  ongoing_accuracy_pct numeric(5, 2),
  intention_results jsonb not null default '[]'::jsonb,
  pm_hits integer not null default 0,
  pm_total integer not null default 0,
  pm_false_alarms integer not null default 0,
  pm_accuracy_pct numeric(5, 2),
  avg_timing_error_seconds numeric(6, 2),
  score integer,
  completed boolean not null default false,
  abandoned boolean not null default false,
  duration_seconds integer
);

create table if not exists public.remember_later_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_tier integer not null default 1 check (current_tier between 1 and 10),
  sessions_at_tier integer not null default 0,
  consecutive_wins integer not null default 0,
  consecutive_losses integer not null default 0,
  total_sessions integer not null default 0,
  best_score integer not null default 0,
  has_seen_tutorial boolean not null default false,
  last_played_at timestamptz,
  streak_days integer not null default 0,
  last_streak_date date,
  updated_at timestamptz not null default now()
);

alter table public.remember_later_user_state
  add column if not exists has_seen_tutorial boolean not null default false;

alter table public.remember_later_rounds enable row level security;
alter table public.remember_later_sessions enable row level security;
alter table public.remember_later_user_state enable row level security;

drop policy if exists remember_later_rounds_read on public.remember_later_rounds;
create policy remember_later_rounds_read on public.remember_later_rounds
  for select using (auth.role() = 'authenticated');

drop policy if exists remember_later_sessions_user_all on public.remember_later_sessions;
create policy remember_later_sessions_user_all on public.remember_later_sessions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists remember_later_state_user_all on public.remember_later_user_state;
create policy remember_later_state_user_all on public.remember_later_user_state
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists remember_later_sessions_user_played_idx
  on public.remember_later_sessions (user_id, played_at desc);

create index if not exists remember_later_sessions_user_round_played_idx
  on public.remember_later_sessions (user_id, round_id, played_at desc);

create index if not exists remember_later_rounds_tier_active_idx
  on public.remember_later_rounds (difficulty_tier, is_active);

insert into public.remember_later_rounds (
  id,
  round_type,
  difficulty_tier,
  round_duration_seconds,
  ongoing_task_rule,
  filler_stream,
  filler_item_count,
  filler_item_interval_ms,
  intentions
) values
${valuesSql(rows)}
on conflict (id) do nothing;
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const rounds = buildRememberLaterRounds();
  writeFileSync(outputPath, generateSql(rounds));
  console.log(`Wrote ${rounds.length} Remember Later rounds to ${outputPath}`);
}
