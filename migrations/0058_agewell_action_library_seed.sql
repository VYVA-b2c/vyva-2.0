-- ─────────────────────────────────────────────────────────────────
-- VYVA AgeWell Plan — Action Library Seed
-- Table: agewell_action_library
-- All actions start is_active = FALSE — human review before going live
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agewell_action_library (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category            TEXT NOT NULL
                      CHECK (category IN ('eat','move','calm','avoid','sleep','home','medicine','follow-up')),
  label               TEXT NOT NULL,           -- ≤5 words, verb-led, senior-friendly
  description         TEXT NOT NULL,           -- ≤10 words, plain, warm
  destination_type    TEXT NOT NULL
                      CHECK (destination_type IN ('route','voice','inline','concierge','game')),
  destination_path    TEXT,                    -- route path, game id, or null for inline/concierge
  condition_tags      TEXT[] NOT NULL DEFAULT ARRAY['all'],
                                               -- ['all','heart','diabetes','alzheimers','anxiety','falls','asthma','oncology']
  tier_min            INTEGER NOT NULL DEFAULT 1
                      CHECK (tier_min BETWEEN 1 AND 4),
  avoid_after_done    INTEGER NOT NULL DEFAULT 1,  -- days before showing again after Done
  avoid_after_skip    INTEGER NOT NULL DEFAULT 0,  -- days before showing again after Skip
  language            TEXT NOT NULL DEFAULT 'es',
  last_shown_at       TIMESTAMPTZ,
  last_outcome        TEXT CHECK (last_outcome IN ('done','hard','skip', null)),
  is_active           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aal_category_tags ON agewell_action_library (category, condition_tags, tier_min, is_active);

-- ─────────────────────────────────────────────────────────────────
-- EAT — food and hydration actions
-- ─────────────────────────────────────────────────────────────────

INSERT INTO agewell_action_library
  (category, label, description, destination_type, destination_path, condition_tags, tier_min, avoid_after_done, avoid_after_skip, language)
VALUES

-- Universal eat actions
('eat', 'Drink a glass of water now',
 'Staying hydrated helps your heart and energy.',
 'inline', null, ARRAY['all'], 1, 1, 0, 'es'),

('eat', 'Have a colourful lunch today',
 'Vegetables with every meal supports your whole body.',
 'concierge', null, ARRAY['all'], 1, 2, 0, 'es'),

('eat', 'Eat slowly and without rushing',
 'Calm meals help digestion and reduce stress.',
 'inline', null, ARRAY['all'], 1, 3, 1, 'es'),

('eat', 'Add fruit to breakfast',
 'Natural sugars and fibre for a steady start.',
 'concierge', null, ARRAY['all'], 1, 2, 0, 'es'),

-- Heart / blood pressure
('eat', 'Lower-salt lunch today',
 'Less salt helps your heart work more easily.',
 'concierge', null, ARRAY['heart'], 1, 1, 0, 'es'),

('eat', 'Avoid canned or packaged food today',
 'Hidden salt is the main culprit for blood pressure.',
 'inline', null, ARRAY['heart'], 2, 2, 0, 'es'),

('eat', 'Try an olive-oil dressing',
 'Healthy fats are protective for your heart.',
 'concierge', null, ARRAY['heart'], 1, 3, 1, 'es'),

('eat', 'Eat potassium-rich food today',
 'Banana, potato or spinach helps balance blood pressure.',
 'concierge', null, ARRAY['heart'], 2, 2, 0, 'es'),

-- Diabetes
('eat', 'Protein breakfast today',
 'Protein keeps blood sugar steady through the morning.',
 'concierge', null, ARRAY['diabetes'], 1, 1, 0, 'es'),

('eat', 'Drink water before your main meal',
 'Slows absorption and helps with portion awareness.',
 'inline', null, ARRAY['diabetes'], 1, 1, 0, 'es'),

('eat', 'Avoid sugary drinks today',
 'Water, herbal tea, or sparkling water are better choices.',
 'inline', null, ARRAY['diabetes'], 1, 2, 0, 'es'),

('eat', 'Try smaller, more frequent meals',
 'Smaller portions spread through the day stabilise glucose.',
 'inline', null, ARRAY['diabetes'], 2, 3, 1, 'es'),

-- Asthma
('eat', 'Eat anti-inflammatory foods today',
 'Ginger, turmeric or oily fish can ease airways.',
 'concierge', null, ARRAY['asthma'], 1, 3, 1, 'es'),

('eat', 'Avoid cold drinks with meals',
 'Cold liquids can trigger airway sensitivity.',
 'inline', null, ARRAY['asthma'], 2, 2, 0, 'es'),

-- Oncology
('eat', 'High-protein snack today',
 'Protein supports recovery and keeps strength up.',
 'concierge', null, ARRAY['oncology'], 1, 1, 0, 'es'),

('eat', 'Eat something warm and easy to digest',
 'Gentle foods are kinder when appetite is low.',
 'concierge', null, ARRAY['oncology'], 2, 1, 0, 'es'),

-- ─────────────────────────────────────────────────────────────────
-- MOVE — gentle movement and physical activity
-- ─────────────────────────────────────────────────────────────────

-- Universal
('move', '10-minute gentle walk',
 'Even a short walk supports heart, mood and joints.',
 'route', '/health/exercises/gentle-walk', ARRAY['all'], 1, 1, 0, 'es'),

('move', 'Stand up every hour today',
 'Breaking sitting time protects heart and circulation.',
 'inline', null, ARRAY['all'], 1, 1, 0, 'es'),

('move', 'Morning stretch routine',
 'Five minutes of stretching reduces stiffness and pain.',
 'route', '/health/exercises/morning-stretch', ARRAY['all'], 1, 2, 0, 'es'),

-- Heart
('move', 'Steady walk after lunch',
 'Post-meal walking helps blood pressure and glucose.',
 'route', '/health/exercises/gentle-walk', ARRAY['heart','diabetes'], 1, 1, 0, 'es'),

('move', 'Light gardening or housework',
 'Gentle activity counts — movement is movement.',
 'inline', null, ARRAY['heart'], 1, 3, 1, 'es'),

-- Falls / mobility
('move', 'Chair mobility — 5 minutes',
 'Seated exercises for strength and balance.',
 'route', '/health/exercises/chair-mobility', ARRAY['falls'], 1, 1, 0, 'es'),

('move', 'Balance practice at the counter',
 'Hold the counter and shift weight gently side to side.',
 'route', '/health/exercises/balance', ARRAY['falls'], 1, 2, 0, 'es'),

('move', 'Ankle circles while seated',
 'Keeps circulation going and reduces fall risk.',
 'inline', null, ARRAY['falls'], 1, 1, 0, 'es'),

-- Asthma
('move', 'Gentle indoor walk today',
 'Avoid cold air — movement indoors is just as good.',
 'route', '/health/exercises/gentle-walk', ARRAY['asthma'], 1, 2, 0, 'es'),

('move', 'Slow breathing walk outside',
 'Breathe in through the nose, out through pursed lips.',
 'route', '/health/exercises/breathing-walk', ARRAY['asthma'], 2, 2, 0, 'es'),

-- Alzheimer's / cognitive
('move', 'Walk a familiar route today',
 'Familiar routes support confidence and navigation memory.',
 'route', '/health/exercises/gentle-walk', ARRAY['alzheimers'], 1, 1, 0, 'es'),

('move', 'Dance to one favourite song',
 'Rhythm and memory reinforce each other beautifully.',
 'inline', null, ARRAY['alzheimers'], 1, 3, 1, 'es'),

-- Oncology
('move', 'Short walk if energy allows',
 'Even 5 minutes outside lifts mood and circulation.',
 'route', '/health/exercises/gentle-walk', ARRAY['oncology'], 2, 1, 0, 'es'),

('move', 'Gentle arm stretches seated',
 'Keep joints mobile without tiring yourself.',
 'route', '/health/exercises/chair-mobility', ARRAY['oncology'], 1, 2, 0, 'es'),

-- ─────────────────────────────────────────────────────────────────
-- CALM — breathing, relaxation, mental ease
-- ─────────────────────────────────────────────────────────────────

('calm', '2-minute breathing now',
 'Slow breathing calms the nervous system in minutes.',
 'game', 'breath-garden', ARRAY['all'], 1, 1, 0, 'es'),

('calm', 'Sit quietly for 5 minutes',
 'No phone, no noise — just rest your mind.',
 'inline', null, ARRAY['all'], 1, 2, 0, 'es'),

('calm', 'Try a body scan relaxation',
 'Notice each part of your body, starting from the feet.',
 'route', '/health/exercises/body-scan', ARRAY['all'], 1, 3, 1, 'es'),

-- Anxiety
('calm', '4-7-8 breathing right now',
 'Inhale 4, hold 7, exhale 8. Calms anxiety quickly.',
 'game', 'breath-garden', ARRAY['anxiety'], 1, 1, 0, 'es'),

('calm', 'Name 5 things you can see',
 'Grounding technique that gently stops anxious thoughts.',
 'inline', null, ARRAY['anxiety'], 2, 1, 0, 'es'),

('calm', 'Warm drink and 10 quiet minutes',
 'Chamomile tea and stillness signal safety to your body.',
 'inline', null, ARRAY['anxiety'], 1, 2, 0, 'es'),

-- Heart
('calm', 'Deep breathing for your heart',
 'Slow breath reduces heart rate and blood pressure.',
 'game', 'breath-garden', ARRAY['heart'], 1, 1, 0, 'es'),

-- Alzheimer's
('calm', 'Listen to familiar music',
 'Familiar music reduces confusion and lifts mood.',
 'concierge', null, ARRAY['alzheimers'], 1, 2, 0, 'es'),

-- Oncology
('calm', 'Guided relaxation — 10 minutes',
 'Rest is part of recovery. Let yourself be still.',
 'route', '/health/exercises/body-scan', ARRAY['oncology'], 1, 1, 0, 'es'),

-- ─────────────────────────────────────────────────────────────────
-- AVOID — protective daily choices
-- ─────────────────────────────────────────────────────────────────

('avoid', 'Skip processed snacks today',
 'Salt and sugar hide in packaged foods.',
 'inline', null, ARRAY['all'], 1, 2, 0, 'es'),

('avoid', 'Limit alcohol today',
 'Even one drink raises blood pressure slightly.',
 'inline', null, ARRAY['heart','diabetes'], 2, 3, 1, 'es'),

('avoid', 'Avoid very hot or cold environments',
 'Extreme temperatures stress heart and airways.',
 'inline', null, ARRAY['heart','asthma'], 2, 3, 1, 'es'),

('avoid', 'Do not skip meals today',
 'Regular meals keep glucose and energy stable.',
 'inline', null, ARRAY['diabetes'], 1, 1, 0, 'es'),

('avoid', 'Avoid loose rugs or trailing wires',
 'Check your main walking routes are clear.',
 'inline', null, ARRAY['falls'], 1, 2, 0, 'es'),

('avoid', 'Avoid rushing when getting up',
 'Rise slowly from chairs and bed to prevent dizziness.',
 'inline', null, ARRAY['falls','heart'], 1, 1, 0, 'es'),

('avoid', 'Avoid dusty or smoky air today',
 'Irritants trigger airway inflammation quickly.',
 'inline', null, ARRAY['asthma'], 1, 2, 0, 'es'),

-- ─────────────────────────────────────────────────────────────────
-- SLEEP — rest and night-time routine
-- ─────────────────────────────────────────────────────────────────

('sleep', 'Wind-down at 9pm tonight',
 'A regular bedtime builds better sleep over time.',
 'concierge', null, ARRAY['all'], 1, 1, 0, 'es'),

('sleep', 'No screens an hour before bed',
 'Blue light delays sleep onset and reduces depth.',
 'inline', null, ARRAY['all'], 1, 2, 0, 'es'),

('sleep', 'Cool your room before sleeping',
 'Cooler rooms support deeper, more restorative sleep.',
 'inline', null, ARRAY['all'], 1, 3, 1, 'es'),

-- Anxiety
('sleep', 'Write down tomorrow''s worries tonight',
 'Getting worries on paper empties the mind for sleep.',
 'inline', null, ARRAY['anxiety'], 2, 2, 0, 'es'),

-- Heart
('sleep', 'Sleep on your left side tonight',
 'Left-side sleeping eases pressure on the heart.',
 'inline', null, ARRAY['heart'], 2, 3, 1, 'es'),

-- Alzheimer's
('sleep', 'Same bedtime as yesterday',
 'Routine anchors memory and reduces night-time confusion.',
 'concierge', null, ARRAY['alzheimers'], 1, 1, 0, 'es'),

-- ─────────────────────────────────────────────────────────────────
-- HOME — safety and environment
-- ─────────────────────────────────────────────────────────────────

('home', 'Check your walking path',
 'Clear main routes from any obstacles or trailing wires.',
 'inline', null, ARRAY['falls'], 1, 3, 0, 'es'),

('home', 'Make sure lights are working',
 'Good lighting in hallway and bathroom reduces fall risk.',
 'inline', null, ARRAY['falls'], 1, 7, 0, 'es'),

('home', 'Keep medications visible and labelled',
 'Organised meds reduce missed or doubled doses.',
 'inline', null, ARRAY['all'], 1, 7, 0, 'es'),

('home', 'Open a window for fresh air',
 'Fresh air improves mood, alertness and breathing.',
 'inline', null, ARRAY['all'], 1, 2, 0, 'es'),

-- Asthma
('home', 'Avoid sprays and strong scents today',
 'Air fresheners and cleaning sprays can trigger airways.',
 'inline', null, ARRAY['asthma'], 1, 3, 0, 'es'),

('home', 'Ventilate the kitchen when cooking',
 'Cooking fumes are a common asthma trigger.',
 'inline', null, ARRAY['asthma'], 1, 2, 0, 'es'),

-- ─────────────────────────────────────────────────────────────────
-- MEDICINE — awareness and adherence (no dosage, no changes)
-- ─────────────────────────────────────────────────────────────────

('medicine', 'Know your side effects',
 'Review what to watch for with your current medication.',
 'route', '/health/medications', ARRAY['all'], 1, 7, 0, 'es'),

('medicine', 'Take medication with food today',
 'Some medications are gentler on an empty stomach.',
 'inline', null, ARRAY['all'], 2, 3, 0, 'es'),

('medicine', 'Check your medication schedule',
 'Consistent timing makes medication more effective.',
 'route', '/health/medications', ARRAY['all'], 1, 3, 0, 'es'),

-- Heart
('medicine', 'Take heart medication at the same time',
 'Timing consistency is especially important for heart meds.',
 'route', '/health/medications', ARRAY['heart'], 1, 3, 0, 'es'),

-- Diabetes
('medicine', 'Note how you feel after medication',
 'Glucose response can vary — noting it helps your doctor.',
 'route', '/health/medications', ARRAY['diabetes'], 2, 3, 0, 'es'),

-- New medication (tier 2+)
('medicine', 'Watch for new side effects today',
 'First weeks of a new medication are worth extra attention.',
 'route', '/health/medications', ARRAY['all'], 2, 1, 0, 'es'),

-- ─────────────────────────────────────────────────────────────────
-- FOLLOW-UP — doctor communication and care coordination
-- ─────────────────────────────────────────────────────────────────

('follow-up', 'Prepare a question for your doctor',
 'Write down one thing you want to ask at your next visit.',
 'concierge', null, ARRAY['all'], 2, 7, 1, 'es'),

('follow-up', 'Tell your caregiver how you feel',
 'A quick update helps them support you better.',
 'concierge', null, ARRAY['all'], 3, 3, 0, 'es'),

('follow-up', 'Book your next appointment',
 'Regular check-ups catch changes before they grow.',
 'concierge', null, ARRAY['all'], 2, 14, 1, 'es'),

-- Post-symptom
('follow-up', 'Note if your symptom has changed',
 'Has it improved, stayed the same, or got worse?',
 'route', '/health/symptoms', ARRAY['all'], 2, 1, 0, 'es'),

-- Heart
('follow-up', 'Ask your doctor about BP targets',
 'Knowing your personal target helps you track progress.',
 'concierge', null, ARRAY['heart'], 2, 14, 1, 'es'),

-- Diabetes
('follow-up', 'Review glucose log with your doctor',
 'Patterns over days tell more than a single reading.',
 'route', '/health/vitals', ARRAY['diabetes'], 2, 7, 1, 'es'),

-- Alzheimer's
('follow-up', 'Ask family what they''ve noticed',
 'People close to you often spot changes first.',
 'concierge', null, ARRAY['alzheimers'], 2, 7, 1, 'es'),

-- Falls
('follow-up', 'Ask about a falls assessment',
 'A formal assessment can identify risks and solutions.',
 'concierge', null, ARRAY['falls'], 2, 14, 1, 'es'),

-- Oncology
('follow-up', 'Confirm your next care appointment',
 'Don''t let appointments slip when managing treatment.',
 'concierge', null, ARRAY['oncology'], 2, 7, 0, 'es');


-- ─────────────────────────────────────────────────────────────────
-- German translations (de) — key universal actions only
-- Full German set to be completed with clinical translator
-- ─────────────────────────────────────────────────────────────────

INSERT INTO agewell_action_library
  (category, label, description, destination_type, destination_path, condition_tags, tier_min, avoid_after_done, avoid_after_skip, language)
VALUES

('eat', 'Jetzt ein Glas Wasser trinken',
 'Ausreichend Wasser hält Herz und Energie stabil.',
 'inline', null, ARRAY['all'], 1, 1, 0, 'de'),

('move', '10-minütiger sanfter Spaziergang',
 'Auch kurze Bewegung unterstützt Herz und Stimmung.',
 'route', '/health/exercises/gentle-walk', ARRAY['all'], 1, 1, 0, 'de'),

('calm', '2 Minuten ruhig atmen',
 'Langsames Atmen beruhigt das Nervensystem.',
 'game', 'breath-garden', ARRAY['all'], 1, 1, 0, 'de'),

('sleep', 'Abendruhe um 21 Uhr',
 'Regelmäßige Schlafenszeiten verbessern den Schlaf.',
 'concierge', null, ARRAY['all'], 1, 1, 0, 'de'),

('medicine', 'Nebenwirkungen im Blick haben',
 'Schauen Sie, was bei Ihren Medikamenten zu beachten ist.',
 'route', '/health/medications', ARRAY['all'], 1, 7, 0, 'de');


-- ─────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE agewell_action_library ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active actions (content library, not personal data)
CREATE POLICY "actions_read_authenticated" ON agewell_action_library
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = TRUE);

-- Admin can read all (including inactive) for content review
CREATE POLICY "actions_read_all_admin" ON agewell_action_library
  FOR ALL USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────
-- Notes for content team before activating
-- ─────────────────────────────────────────────────────────────────

-- 1. All rows ship is_active = FALSE.
--    Activate via /admin/content-review after clinical review.
-- 2. German set is partial — complete with a native medical translator.
-- 3. Add English ('en') set following the same pattern when B2C launch requires it.
-- 4. destination_path values assume the existing vyva-2.0 route structure.
--    Confirm /health/exercises/* paths exist before activating move/calm actions.
-- 5. 'game' destination_type routes to the named Brain Coach game —
--    confirm game IDs match those used in brain_coach_games table.
-- 6. Follow-up actions at tier_min 2+ only show for seniors at Suggestion severity
--    or above — they should never be the only action shown to a well-managed senior.
