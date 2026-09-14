import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outputPath = resolve("migrations/0015_number_trails.sql");
const languages = ["es", "de", "en"];
const minDistance = 0.175;
const margin = 0.06;

const tiers = [
  { tier: 1, type: "numeric", nodes: 5, par: 30 },
  { tier: 2, type: "numeric", nodes: 8, par: 45 },
  { tier: 3, type: "numeric", nodes: 10, par: 55 },
  { tier: 4, type: "numeric", nodes: 12, par: 65 },
  { tier: 5, type: "numeric", nodes: 15, par: 80 },
  { tier: 6, type: "alternating", nodes: 8, par: 50 },
  { tier: 7, type: "alternating", nodes: 10, par: 65 },
  { tier: 8, type: "alternating", nodes: 14, par: 85 },
  { tier: 9, type: "alternating", nodes: 18, par: 110 },
  { tier: 10, type: "alternating", nodes: 25, par: 150 },
  { tier: 11, type: "numeric", nodes: 18, par: 95 },
  { tier: 12, type: "numeric", nodes: 20, par: 105 },
  { tier: 13, type: "alternating", nodes: 18, par: 105 },
  { tier: 14, type: "alternating", nodes: 20, par: 118 },
  { tier: 15, type: "alternating", nodes: 22, par: 132 },
  { tier: 16, type: "numeric", nodes: 22, par: 105 },
  { tier: 17, type: "alternating", nodes: 22, par: 118 },
  { tier: 18, type: "numeric", nodes: 25, par: 120 },
  { tier: 19, type: "alternating", nodes: 24, par: 128 },
  { tier: 20, type: "alternating", nodes: 25, par: 136 },
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

function shuffle(random, items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function alternatingLabel(index) {
  if (index % 2 === 0) return String(index / 2 + 1);
  return String.fromCharCode("A".charCodeAt(0) + Math.floor(index / 2));
}

function labelFor(type, index) {
  return type === "numeric" ? String(index + 1) : alternatingLabel(index);
}

function candidateGrid(random, tier) {
  const coordinates = [0.08, 0.29, 0.5, 0.71, 0.92];
  const jitter = tier <= 2 ? 0.006 : tier <= 5 ? 0.01 : 0.013;
  const points = [];

  coordinates.forEach((x, col) => {
    coordinates.forEach((y, row) => {
      const jx = (random() - 0.5) * jitter * 2;
      const jy = (random() - 0.5) * jitter * 2;
      points.push({
        x: Number(Math.min(0.94, Math.max(0.06, x + jx)).toFixed(3)),
        y: Number(Math.min(0.94, Math.max(0.06, y + jy)).toFixed(3)),
        col,
        row,
      });
    });
  });

  return shuffle(random, points);
}

function chooseSpreadPoints(random, count, tier) {
  const candidates = candidateGrid(random, tier);
  const chosen = [candidates[Math.floor(random() * candidates.length)]];

  while (chosen.length < count) {
    const remaining = candidates.filter((candidate) => !chosen.includes(candidate));
    const ranked = remaining
      .map((candidate) => ({
        candidate,
        nearest: Math.min(...chosen.map((point) => distance(candidate, point))),
      }))
      .sort((a, b) => b.nearest - a.nearest);

    const poolSize = Math.min(Math.max(2, Math.floor(ranked.length / 4)), ranked.length);
    chosen.push(ranked[Math.floor(random() * poolSize)].candidate);
  }

  return chosen.map(({ x, y }) => ({ x, y }));
}

function pathIsScattered(points) {
  if (points.length < 5) return true;

  let straightishTriples = 0;
  for (let index = 2; index < points.length; index += 1) {
    const a = points[index - 2];
    const b = points[index - 1];
    const c = points[index];
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const bc = { x: c.x - b.x, y: c.y - b.y };
    const denom = Math.hypot(ab.x, ab.y) * Math.hypot(bc.x, bc.y);
    if (!denom) continue;
    const cosine = Math.abs((ab.x * bc.x + ab.y * bc.y) / denom);
    if (cosine > 0.965) straightishTriples += 1;
  }

  return straightishTriples <= Math.max(2, Math.floor(points.length / 4));
}

function buildLayout(config, variant) {
  for (let attempt = 0; attempt < 800; attempt += 1) {
    const random = createRng(`number-trails:${config.tier}:${variant}:${attempt}`);
    const points = shuffle(random, chooseSpreadPoints(random, config.nodes, config.tier));
    const nodes = points.map((point, index) => ({
      label: labelFor(config.type, index),
      x: point.x,
      y: point.y,
    }));

    try {
      validateNodes(config, nodes);
      if (pathIsScattered(nodes)) return nodes;
    } catch {
      // Keep searching; the final error below is more useful than a random attempt failure.
    }
  }

  throw new Error(`Could not build a valid layout for tier ${config.tier}, variant ${variant}.`);
}

function validateNodes(config, nodes) {
  if (nodes.length !== config.nodes) {
    throw new Error(`Tier ${config.tier} has ${nodes.length} nodes, expected ${config.nodes}.`);
  }

  nodes.forEach((node, index) => {
    const expectedLabel = labelFor(config.type, index);
    if (node.label !== expectedLabel) {
      throw new Error(`Tier ${config.tier} label ${index} is ${node.label}, expected ${expectedLabel}.`);
    }

    if (node.x < margin || node.x > 1 - margin || node.y < margin || node.y > 1 - margin) {
      throw new Error(`Tier ${config.tier} node ${node.label} is outside the canvas margin.`);
    }
  });

  for (let left = 0; left < nodes.length; left += 1) {
    for (let right = left + 1; right < nodes.length; right += 1) {
      const gap = distance(nodes[left], nodes[right]);
      if (gap < minDistance) {
        throw new Error(`Tier ${config.tier} nodes ${nodes[left].label}/${nodes[right].label} are too close: ${gap}.`);
      }
    }
  }
}

function validateRows(rows) {
  if (rows.length !== 1200) {
    throw new Error(`Expected 1200 seed rows, generated ${rows.length}.`);
  }

  for (const config of tiers) {
    const tierRows = rows.filter((row) => row.difficulty_tier === config.tier);
    if (tierRows.length !== 60) {
      throw new Error(`Tier ${config.tier} expected 60 rows, generated ${tierRows.length}.`);
    }

    for (const language of languages) {
      const languageRows = tierRows.filter((row) => row.language === language);
      if (languageRows.length !== 20) {
        throw new Error(`Tier ${config.tier}/${language} expected 20 rows, generated ${languageRows.length}.`);
      }
    }

    const baseLayouts = rows
      .filter((row) => row.difficulty_tier === config.tier && row.language === "es")
      .map((row) => JSON.stringify(row.nodes));
    const uniqueLayouts = new Set(baseLayouts);
    if (uniqueLayouts.size !== 20) {
      throw new Error(`Tier ${config.tier} expected 20 unique layouts, generated ${uniqueLayouts.size}.`);
    }
  }
}

function jsonSql(value) {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
}

const rows = [];

for (const config of tiers) {
  const layouts = [];
  for (let variant = 1; variant <= 20; variant += 1) {
    const nodes = buildLayout(config, variant);
    validateNodes(config, nodes);
    layouts.push(nodes);
  }

  for (let variant = 1; variant <= 20; variant += 1) {
    for (const language of languages) {
      rows.push({
        id: deterministicUuid(`number-trails:${config.tier}:${variant}:${language}`),
        trail_type: config.type,
        node_count: config.nodes,
        nodes: layouts[variant - 1],
        par_time_seconds: config.par,
        difficulty_tier: config.tier,
        language,
      });
    }
  }
}

validateRows(rows);

const valuesSql = rows
  .map((row) => `  (${[
    `'${row.id}'`,
    `'${row.trail_type}'`,
    row.node_count,
    jsonSql(row.nodes),
    row.par_time_seconds,
    row.difficulty_tier,
    `'${row.language}'`,
  ].join(", ")})`)
  .join(",\n");

const sql = `-- Number Trails schema and validated seed library.
-- Generated by scripts/generate-number-trails-seed.mjs.
-- Contains ${rows.length} trail configs: 20 per tier x 20 tiers x 3 languages.
-- Par times use the explicit tier table from VYVA Brain Game Brief #07.

CREATE TABLE IF NOT EXISTS public.number_trails_configs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_type         TEXT NOT NULL CHECK (trail_type IN ('numeric', 'alternating')),
  node_count         INTEGER NOT NULL CHECK (node_count BETWEEN 5 AND 25),
  nodes              JSONB NOT NULL,
  par_time_seconds   INTEGER NOT NULL,
  difficulty_tier    INTEGER NOT NULL CHECK (difficulty_tier BETWEEN 1 AND 20),
  language           TEXT NOT NULL DEFAULT 'es',
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.number_trails_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  played_at             TIMESTAMPTZ DEFAULT NOW(),
  config_id             UUID REFERENCES public.number_trails_configs(id),
  difficulty_tier       INTEGER NOT NULL,
  trail_type            TEXT NOT NULL CHECK (trail_type IN ('numeric', 'alternating')),
  node_count            INTEGER NOT NULL,
  nodes_correct         INTEGER NOT NULL DEFAULT 0,
  nodes_total           INTEGER NOT NULL,
  errors                INTEGER NOT NULL DEFAULT 0,
  completion_time_ms    INTEGER,
  par_time_ms           INTEGER NOT NULL,
  accuracy_pct          NUMERIC(5,2),
  speed_pct             NUMERIC(5,2),
  completed             BOOLEAN NOT NULL DEFAULT FALSE,
  abandoned             BOOLEAN NOT NULL DEFAULT FALSE,
  score                 INTEGER
);

CREATE TABLE IF NOT EXISTS public.number_trails_user_state (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_tier          INTEGER NOT NULL DEFAULT 1 CHECK (current_tier BETWEEN 1 AND 20),
  sessions_at_tier      INTEGER NOT NULL DEFAULT 0,
  consecutive_wins      INTEGER NOT NULL DEFAULT 0,
  consecutive_losses    INTEGER NOT NULL DEFAULT 0,
  total_sessions        INTEGER NOT NULL DEFAULT 0,
  best_score            INTEGER NOT NULL DEFAULT 0,
  last_played_at        TIMESTAMPTZ,
  streak_days           INTEGER NOT NULL DEFAULT 0,
  last_streak_date      DATE,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.number_trails_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.number_trails_user_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.number_trails_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_own_nt_sessions" ON public.number_trails_sessions;
CREATE POLICY "user_own_nt_sessions" ON public.number_trails_sessions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_own_nt_state" ON public.number_trails_user_state;
CREATE POLICY "user_own_nt_state" ON public.number_trails_user_state
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "nt_configs_read" ON public.number_trails_configs;
CREATE POLICY "nt_configs_read" ON public.number_trails_configs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_nts_user_played
  ON public.number_trails_sessions (user_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_ntc_tier
  ON public.number_trails_configs (difficulty_tier, is_active);
CREATE INDEX IF NOT EXISTS idx_ntc_tier_language
  ON public.number_trails_configs (difficulty_tier, language, is_active);

WITH seed (
  id,
  trail_type,
  node_count,
  nodes,
  par_time_seconds,
  difficulty_tier,
  language
) AS (
VALUES
${valuesSql}
)
INSERT INTO public.number_trails_configs (
  id,
  trail_type,
  node_count,
  nodes,
  par_time_seconds,
  difficulty_tier,
  language
)
SELECT
  seed.id::uuid,
  seed.trail_type,
  seed.node_count,
  seed.nodes,
  seed.par_time_seconds,
  seed.difficulty_tier,
  seed.language
FROM seed
ON CONFLICT (id) DO UPDATE SET
  trail_type = excluded.trail_type,
  node_count = excluded.node_count,
  nodes = excluded.nodes,
  par_time_seconds = excluded.par_time_seconds,
  difficulty_tier = excluded.difficulty_tier,
  language = excluded.language,
  is_active = true;
`;

writeFileSync(outputPath, sql, "utf8");
console.log(`Generated ${rows.length} Number Trails seed rows at ${outputPath}`);
