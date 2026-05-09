import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outputPath = resolve("migrations/0014_category_sort.sql");

const languages = ["es", "de", "en"];
const colors = ["red", "blue", "yellow", "green", "purple", "orange"];
const shapes = ["circle", "square", "triangle", "star", "diamond", "cross"];
const sizes = ["small", "medium", "large"];

const colorLabels = {
  red: { es: "Rojo", de: "Rot", en: "Red" },
  blue: { es: "Azul", de: "Blau", en: "Blue" },
  yellow: { es: "Amarillo", de: "Gelb", en: "Yellow" },
  green: { es: "Verde", de: "Gruen", en: "Green" },
  purple: { es: "Morado", de: "Lila", en: "Purple" },
  orange: { es: "Naranja", de: "Orange", en: "Orange" },
};

const shapeLabels = {
  circle: { es: "Circulo", de: "Kreis", en: "Circle" },
  square: { es: "Cuadrado", de: "Quadrat", en: "Square" },
  triangle: { es: "Triangulo", de: "Dreieck", en: "Triangle" },
  star: { es: "Estrella", de: "Stern", en: "Star" },
  diamond: { es: "Diamante", de: "Raute", en: "Diamond" },
  cross: { es: "Cruz", de: "Kreuz", en: "Cross" },
};

const sizeLabels = {
  small: { es: "Pequeno", de: "Klein", en: "Small" },
  medium: { es: "Mediano", de: "Mittel", en: "Medium" },
  large: { es: "Grande", de: "Gross", en: "Large" },
};

const semanticLabels = {
  living: { es: "Vivo", de: "Lebendig", en: "Living" },
  non_living: { es: "No vivo", de: "Nicht lebendig", en: "Non-living" },
  food: { es: "Comida", de: "Essen", en: "Food" },
  non_food: { es: "No es comida", de: "Kein Essen", en: "Not food" },
  nature: { es: "Natural", de: "Natur", en: "Natural" },
  man_made: { es: "Creado por personas", de: "Von Menschen gemacht", en: "Made by people" },
};

const semanticRuleLabels = {
  living: { es: "Vivo o no vivo", de: "Lebendig oder nicht", en: "Living or non-living" },
  food: { es: "Comida o no comida", de: "Essen oder nicht", en: "Food or not food" },
  nature: { es: "Natural o creado", de: "Natur oder gemacht", en: "Natural or made" },
};

const semanticCategories = {
  living: ["living", "non_living"],
  food: ["food", "non_food"],
  nature: ["nature", "man_made"],
};

const semanticItems = [
  ...[
    ["animal", "living", "Perro", "Hund", "Dog", "🐕"],
    ["animal", "living", "Gato", "Katze", "Cat", "🐈"],
    ["animal", "living", "Pajaro", "Vogel", "Bird", "🐦"],
    ["animal", "living", "Pez", "Fisch", "Fish", "🐟"],
    ["animal", "living", "Conejo", "Kaninchen", "Rabbit", "🐇"],
    ["animal", "living", "Mariposa", "Schmetterling", "Butterfly", "🦋"],
    ["animal", "living", "Tortuga", "Schildkroete", "Turtle", "🐢"],
    ["animal", "living", "Rana", "Frosch", "Frog", "🐸"],
    ["animal", "living", "Leon", "Loewe", "Lion", "🦁"],
    ["animal", "living", "Elefante", "Elefant", "Elephant", "🐘"],
    ["animal", "living", "Zorro", "Fuchs", "Fox", "🦊"],
    ["animal", "living", "Pinguino", "Pinguin", "Penguin", "🐧"],
  ],
  ...[
    ["plant", "living", "Flor", "Blume", "Flower", "🌸"],
    ["plant", "living", "Hoja", "Blatt", "Leaf", "🌿"],
    ["plant", "living", "Cactus", "Kaktus", "Cactus", "🌵"],
    ["plant", "living", "Trigo", "Weizen", "Wheat", "🌾"],
    ["plant", "living", "Arbol", "Baum", "Tree", "🌲"],
    ["plant", "living", "Girasol", "Sonnenblume", "Sunflower", "🌻"],
    ["plant", "living", "Trebol", "Klee", "Clover", "🍀"],
    ["plant", "living", "Palmera", "Palme", "Palm", "🌴"],
  ],
  ...[
    ["food", "food", "Manzana", "Apfel", "Apple", "🍎"],
    ["food", "food", "Naranja", "Orange", "Orange", "🍊"],
    ["food", "food", "Limon", "Zitrone", "Lemon", "🍋"],
    ["food", "food", "Uvas", "Trauben", "Grapes", "🍇"],
    ["food", "food", "Zanahoria", "Karotte", "Carrot", "🥕"],
    ["food", "food", "Pan", "Brot", "Bread", "🍞"],
    ["food", "food", "Queso", "Kaese", "Cheese", "🧀"],
    ["food", "food", "Huevo", "Ei", "Egg", "🥚"],
    ["food", "food", "Tomate", "Tomate", "Tomato", "🍅"],
    ["food", "food", "Maiz", "Mais", "Corn", "🌽"],
    ["food", "food", "Fresa", "Erdbeere", "Strawberry", "🍓"],
    ["food", "food", "Brocoli", "Brokkoli", "Broccoli", "🥦"],
  ],
  ...[
    ["tool", "non_living", "Martillo", "Hammer", "Hammer", "🔨"],
    ["tool", "non_living", "Tijeras", "Schere", "Scissors", "✂️"],
    ["tool", "non_living", "Llave", "Schluessel", "Key", "🔑"],
    ["tool", "non_living", "Chincheta", "Reisszwecke", "Pin", "📌"],
    ["tool", "non_living", "Destornillador", "Schraubendreher", "Screwdriver", "🪛"],
    ["tool", "non_living", "Llave inglesa", "Schraubenschluessel", "Wrench", "🔧"],
    ["tool", "non_living", "Regla", "Lineal", "Ruler", "📏"],
    ["tool", "non_living", "Iman", "Magnet", "Magnet", "🧲"],
    ["tool", "non_living", "Pinza", "Klemme", "Clamp", "🗜️"],
    ["tool", "non_living", "Linterna", "Taschenlampe", "Flashlight", "🔦"],
  ],
  ...[
    ["vehicle", "non_living", "Coche", "Auto", "Car", "🚗"],
    ["vehicle", "non_living", "Bicicleta", "Fahrrad", "Bicycle", "🚲"],
    ["vehicle", "non_living", "Avion", "Flugzeug", "Plane", "✈️"],
    ["vehicle", "non_living", "Barco", "Boot", "Boat", "🚢"],
    ["vehicle", "non_living", "Tren", "Zug", "Train", "🚂"],
    ["vehicle", "non_living", "Moto", "Motorrad", "Motorcycle", "🏍️"],
    ["vehicle", "non_living", "Autobus", "Bus", "Bus", "🚌"],
    ["vehicle", "non_living", "Trineo", "Schlitten", "Sled", "🛷"],
  ],
  ...[
    ["clothing", "man_made", "Gorra", "Muetze", "Hat", "👒"],
    ["clothing", "man_made", "Abrigo", "Mantel", "Coat", "🧥"],
    ["clothing", "man_made", "Zapato", "Schuh", "Shoe", "👟"],
    ["clothing", "man_made", "Bufanda", "Schal", "Scarf", "🧣"],
    ["clothing", "man_made", "Vestido", "Kleid", "Dress", "👗"],
    ["clothing", "man_made", "Mochila", "Rucksack", "Backpack", "🎒"],
    ["clothing", "man_made", "Gafas", "Brille", "Glasses", "🕶️"],
    ["clothing", "man_made", "Calcetines", "Socken", "Socks", "🧦"],
  ],
  ...[
    ["nature", "nature", "Estrella", "Stern", "Star", "⭐"],
    ["nature", "nature", "Luna", "Mond", "Moon", "🌙"],
    ["nature", "nature", "Nube", "Wolke", "Cloud", "☁️"],
    ["nature", "nature", "Ola", "Welle", "Wave", "🌊"],
    ["nature", "nature", "Montana", "Berg", "Mountain", "🏔️"],
    ["nature", "nature", "Volcan", "Vulkan", "Volcano", "🌋"],
    ["nature", "nature", "Arco iris", "Regenbogen", "Rainbow", "🌈"],
    ["nature", "nature", "Nieve", "Schnee", "Snowflake", "❄️"],
  ],
  ...[
    ["building", "non_living", "Casa", "Haus", "House", "🏠"],
    ["building", "non_living", "Escuela", "Schule", "School", "🏫"],
    ["building", "non_living", "Hospital", "Krankenhaus", "Hospital", "🏥"],
    ["building", "non_living", "Iglesia", "Kirche", "Church", "⛪"],
    ["building", "non_living", "Tienda", "Laden", "Shop", "🏪"],
    ["building", "non_living", "Torre", "Turm", "Tower", "🗼"],
  ],
].map(([semanticClass, semanticGroup, labelEs, labelDe, labelEn, icon], index) => ({
  semanticClass,
  semanticGroup,
  labelEs,
  labelDe,
  labelEn,
  icon,
  itemIndex: index + 1,
}));

const tierConfig = {
  1: { count: 12, switchAfter: 4, rules: ["color", "shape", "color"] },
  2: { count: 14, switchAfter: 4, rules: ["color", "shape", "size"] },
  3: { count: 16, switchAfter: 4, rules: ["color", "shape", "size"] },
  4: { count: 18, switchAfter: 3, rules: ["color", "shape", "size"] },
  5: { count: 20, switchAfter: 3, rules: ["color", "shape", "size"] },
  6: { count: 22, switchAfter: 3, rules: ["color", "shape", "semantic"] },
  7: { count: 24, switchAfter: 3, rules: ["color", "semantic", "shape"] },
  8: { count: 26, switchAfter: 2, rules: ["shape", "semantic", "color"] },
  9: { count: 28, switchAfter: 2, rules: ["semantic", "color", "shape"] },
  10: { count: 30, switchAfter: 2, rules: ["semantic", "semantic", "color"] },
};

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

function shuffle(items, rng) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonSql(value) {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
}

function labelTriplet(source) {
  return {
    label_es: source.es,
    label_de: source.de,
    label_en: source.en,
  };
}

function semanticValueFor(card, semanticType) {
  if (semanticType === "living") {
    return card.semanticClass === "animal" || card.semanticClass === "plant" ? "living" : "non_living";
  }

  if (semanticType === "food") {
    return card.semanticClass === "food" ? "food" : "non_food";
  }

  if (card.semanticClass === "tool" || card.semanticClass === "vehicle" || card.semanticClass === "building" || card.semanticClass === "clothing") {
    return "man_made";
  }

  return "nature";
}

function semanticTypeFor(tier, sequenceIndex, semanticOrdinal) {
  if (tier === 10) return semanticOrdinal % 2 === 0 ? "living" : "food";
  return ["living", "food", "nature"][(sequenceIndex + semanticOrdinal) % 3];
}

function buildRule(ruleName, switchAfter, tier, sequenceIndex, semanticOrdinal) {
  if (ruleName === "color") {
    return { rule: "color", ...labelTriplet({ es: "Color", de: "Farbe", en: "Colour" }), switch_after: switchAfter };
  }

  if (ruleName === "shape") {
    return { rule: "shape", ...labelTriplet({ es: "Forma", de: "Form", en: "Shape" }), switch_after: switchAfter };
  }

  if (ruleName === "size") {
    return { rule: "size", ...labelTriplet({ es: "Tamano", de: "Groesse", en: "Size" }), switch_after: switchAfter };
  }

  const semanticType = semanticTypeFor(tier, sequenceIndex, semanticOrdinal);
  return {
    rule: "semantic_group",
    semantic_group_value: semanticType,
    ...labelTriplet(semanticRuleLabels[semanticType]),
    categories: semanticCategories[semanticType].map((value) => ({
      value,
      ...labelTriplet(semanticLabels[value]),
    })),
    switch_after: switchAfter,
  };
}

function selectCardsForSequence(allCards, config, tier, sequenceIndex, rules) {
  const rng = createRng(`category-sort:${tier}:${sequenceIndex}`);
  const allowedColors = Array.from({ length: 4 }, (_, offset) => colors[(sequenceIndex + offset) % colors.length]);
  const allowedShapes = Array.from({ length: 4 }, (_, offset) => shapes[(sequenceIndex * 2 + offset) % shapes.length]);
  const pool = shuffle(
    allCards.filter((card) => allowedColors.includes(card.color) && allowedShapes.includes(card.shape)),
    rng,
  );

  if (pool.length < config.count) {
    throw new Error(`Not enough cards for tier ${tier}, sequence ${sequenceIndex}: ${pool.length}`);
  }

  const selected = [];
  const selectedIds = new Set();
  const requireCard = (predicate) => {
    const card = pool.find((candidate) => predicate(candidate) && !selectedIds.has(candidate.id));
    if (!card) return;
    selected.push(card);
    selectedIds.add(card.id);
  };

  for (const color of allowedColors) requireCard((card) => card.color === color);
  for (const shape of allowedShapes) requireCard((card) => card.shape === shape);
  if (rules.some((rule) => rule.rule === "size")) {
    for (const size of sizes) requireCard((card) => card.size === size);
  }

  for (const rule of rules.filter((entry) => entry.rule === "semantic_group")) {
    for (const category of semanticCategories[rule.semantic_group_value]) {
      requireCard((card) => semanticValueFor(card, rule.semantic_group_value) === category);
    }
  }

  for (const card of pool) {
    if (selected.length >= config.count) break;
    if (selectedIds.has(card.id)) continue;
    selected.push(card);
    selectedIds.add(card.id);
  }

  return shuffle(selected, rng).slice(0, config.count);
}

const visualCombos = [];
for (const color of colors) {
  for (const shape of shapes) {
    const baseIndex = colors.indexOf(color) + shapes.indexOf(shape);
    visualCombos.push({ color, shape, size: sizes[baseIndex % sizes.length] });
    visualCombos.push({ color, shape, size: sizes[(baseIndex + 1) % sizes.length] });
  }
}

if (visualCombos.length !== 72 || semanticItems.length !== 72) {
  throw new Error("Category Sort expects exactly 72 visual combos and 72 semantic items.");
}

const cards = semanticItems.map((item, index) => ({
  id: deterministicUuid(`category-sort-card:${index + 1}`),
  ...visualCombos[index],
  ...item,
}));

const sequenceRows = [];
for (const [tierText, config] of Object.entries(tierConfig)) {
  const tier = Number(tierText);
  for (let sequenceIndex = 0; sequenceIndex < 20; sequenceIndex += 1) {
    let semanticOrdinal = 0;
    const rules = config.rules.map((ruleName) => {
      const rule = buildRule(ruleName, config.switchAfter, tier, sequenceIndex, semanticOrdinal);
      if (ruleName === "semantic") semanticOrdinal += 1;
      return rule;
    });
    const selectedCards = selectCardsForSequence(cards, config, tier, sequenceIndex, rules);

    for (const language of languages) {
      sequenceRows.push({
        id: deterministicUuid(`category-sort-sequence:${tier}:${sequenceIndex + 1}:${language}`),
        tier,
        cardIds: selectedCards.map((card) => card.id),
        cardCount: config.count,
        rules,
        language,
      });
    }
  }
}

const cardValues = cards
  .map((card) => `  (${[
    sqlString(card.id),
    sqlString(card.color),
    sqlString(card.shape),
    sqlString(card.size),
    sqlString(card.semanticClass),
    sqlString(card.semanticGroup),
    sqlString(card.labelEs),
    sqlString(card.labelDe),
    sqlString(card.labelEn),
    sqlString(card.icon),
  ].join(", ")})`)
  .join(",\n");

const sequenceValues = sequenceRows
  .map((row) => `  (${[
    sqlString(row.id),
    row.tier,
    jsonSql(row.cardIds),
    row.cardCount,
    jsonSql(row.rules),
    sqlString(row.language),
  ].join(", ")})`)
  .join(",\n");

const sql = `-- Category Sort schema and seed library.
-- Generated by scripts/generate-category-sort-seed.mjs.
-- Contains 72 cards and ${sequenceRows.length} sequences:
-- 20 per tier x 10 tiers x 3 languages.

CREATE TABLE IF NOT EXISTS public.category_sort_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  color           TEXT NOT NULL
                  CHECK (color IN ('red','blue','yellow','green','purple','orange')),
  shape           TEXT NOT NULL
                  CHECK (shape IN ('circle','square','triangle','star','diamond','cross')),
  size            TEXT NOT NULL
                  CHECK (size IN ('small','medium','large')),
  semantic_class  TEXT NOT NULL
                  CHECK (semantic_class IN ('animal','plant','food','tool','vehicle','clothing','nature','building')),
  semantic_group  TEXT NOT NULL
                  CHECK (semantic_group IN ('living','non_living','food','non_food','nature','man_made')),
  label_es        TEXT NOT NULL,
  label_de        TEXT NOT NULL,
  label_en        TEXT NOT NULL,
  icon            TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.category_sort_sequences (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  difficulty_tier     INTEGER NOT NULL CHECK (difficulty_tier BETWEEN 1 AND 10),
  card_ids            JSONB NOT NULL,
  card_count          INTEGER NOT NULL CHECK (card_count BETWEEN 12 AND 30),
  rules               JSONB NOT NULL,
  language            TEXT NOT NULL DEFAULT 'es',
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.category_sort_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  played_at             TIMESTAMPTZ DEFAULT NOW(),
  sequence_id           UUID REFERENCES public.category_sort_sequences(id),
  difficulty_tier       INTEGER NOT NULL,
  card_count            INTEGER NOT NULL,
  cards_sorted          INTEGER NOT NULL DEFAULT 0,
  cards_correct         INTEGER NOT NULL DEFAULT 0,
  perseverative_errors  INTEGER NOT NULL DEFAULT 0,
  rule_switches_total   INTEGER NOT NULL DEFAULT 0,
  rule_switches_handled INTEGER NOT NULL DEFAULT 0,
  accuracy_pct          NUMERIC(5,2),
  flexibility_pct       NUMERIC(5,2),
  avg_response_ms       INTEGER,
  score                 INTEGER,
  completed             BOOLEAN NOT NULL DEFAULT FALSE,
  abandoned             BOOLEAN NOT NULL DEFAULT FALSE,
  duration_seconds      INTEGER
);

CREATE TABLE IF NOT EXISTS public.category_sort_user_state (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_tier          INTEGER NOT NULL DEFAULT 1 CHECK (current_tier BETWEEN 1 AND 10),
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

ALTER TABLE public.category_sort_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_sort_user_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_sort_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_sort_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_own_cs_sessions" ON public.category_sort_sessions;
CREATE POLICY "user_own_cs_sessions" ON public.category_sort_sessions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_own_cs_state" ON public.category_sort_user_state;
CREATE POLICY "user_own_cs_state" ON public.category_sort_user_state
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cs_sequences_read" ON public.category_sort_sequences;
CREATE POLICY "cs_sequences_read" ON public.category_sort_sequences
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "cs_cards_read" ON public.category_sort_cards;
CREATE POLICY "cs_cards_read" ON public.category_sort_cards
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE UNIQUE INDEX IF NOT EXISTS idx_cs_cards_visual_unique
  ON public.category_sort_cards (color, shape, size);
CREATE INDEX IF NOT EXISTS idx_css_user_played
  ON public.category_sort_sessions (user_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_csseq_tier
  ON public.category_sort_sequences (difficulty_tier, is_active, language);

WITH seed_cards (
  id,
  color,
  shape,
  size,
  semantic_class,
  semantic_group,
  label_es,
  label_de,
  label_en,
  icon
) AS (
VALUES
${cardValues}
)
INSERT INTO public.category_sort_cards (
  id,
  color,
  shape,
  size,
  semantic_class,
  semantic_group,
  label_es,
  label_de,
  label_en,
  icon
)
SELECT
  seed_cards.id::uuid,
  seed_cards.color,
  seed_cards.shape,
  seed_cards.size,
  seed_cards.semantic_class,
  seed_cards.semantic_group,
  seed_cards.label_es,
  seed_cards.label_de,
  seed_cards.label_en,
  seed_cards.icon
FROM seed_cards
ON CONFLICT (id) DO UPDATE SET
  color = excluded.color,
  shape = excluded.shape,
  size = excluded.size,
  semantic_class = excluded.semantic_class,
  semantic_group = excluded.semantic_group,
  label_es = excluded.label_es,
  label_de = excluded.label_de,
  label_en = excluded.label_en,
  icon = excluded.icon,
  is_active = true;

WITH seed_sequences (
  id,
  difficulty_tier,
  card_ids,
  card_count,
  rules,
  language
) AS (
VALUES
${sequenceValues}
)
INSERT INTO public.category_sort_sequences (
  id,
  difficulty_tier,
  card_ids,
  card_count,
  rules,
  language
)
SELECT
  seed_sequences.id::uuid,
  seed_sequences.difficulty_tier,
  seed_sequences.card_ids,
  seed_sequences.card_count,
  seed_sequences.rules,
  seed_sequences.language
FROM seed_sequences
ON CONFLICT (id) DO UPDATE SET
  difficulty_tier = excluded.difficulty_tier,
  card_ids = excluded.card_ids,
  card_count = excluded.card_count,
  rules = excluded.rules,
  language = excluded.language,
  is_active = true;
`;

writeFileSync(outputPath, sql, "utf8");

console.log(`Generated ${cards.length} Category Sort cards and ${sequenceRows.length} sequences at ${outputPath}`);
