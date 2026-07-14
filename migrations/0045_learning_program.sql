create extension if not exists pgcrypto;

create table if not exists public.learning_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  description text not null default '',
  color text not null default '#7C3AED',
  icon text not null default 'book-open',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_learning_categories_active_sort
  on public.learning_categories (is_active, sort_order);

create table if not exists public.learning_lessons (
  id uuid primary key default gen_random_uuid(),
  external_id text,
  category_slug text not null,
  language text not null default 'en',
  title text not null,
  hook text not null,
  body text not null,
  reflection_prompt text not null,
  source_notes text,
  estimated_minutes integer not null default 3,
  difficulty text not null default 'easy',
  tags text[] not null default '{}',
  status text not null default 'draft',
  is_active boolean not null default true,
  reviewed_at timestamptz,
  reviewed_by text,
  published_at timestamptz,
  published_by text,
  archived_at timestamptz,
  archived_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_learning_lessons_external_id_unique
  on public.learning_lessons (external_id);

create index if not exists idx_learning_lessons_status_language_category
  on public.learning_lessons (status, language, category_slug);

create index if not exists idx_learning_lessons_active_status
  on public.learning_lessons (is_active, status);

create table if not exists public.learning_programs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  status text not null default 'active',
  interests text[] not null default '{}',
  pace text not null default 'gentle',
  daily_time text not null default '09:00',
  lesson_length_minutes integer not null default 3,
  language text not null default 'en',
  start_date date not null,
  end_date date not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_learning_programs_user_status
  on public.learning_programs (user_id, status, start_date);

create table if not exists public.learning_program_items (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.learning_programs(id) on delete cascade,
  user_id text not null,
  lesson_id uuid not null references public.learning_lessons(id) on delete cascade,
  program_day integer not null,
  scheduled_date date not null,
  status text not null default 'recommended',
  completed_at timestamptz,
  saved_at timestamptz,
  skipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_program_items_program_day_unique unique (program_id, program_day)
);

create index if not exists idx_learning_program_items_user_date
  on public.learning_program_items (user_id, scheduled_date);

create index if not exists idx_learning_program_items_program_day
  on public.learning_program_items (program_id, program_day);

create table if not exists public.learning_program_events (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.learning_programs(id) on delete cascade,
  program_item_id uuid references public.learning_program_items(id) on delete set null,
  lesson_id uuid references public.learning_lessons(id) on delete set null,
  user_id text not null,
  event_type text not null,
  source text not null default 'app',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_learning_program_events_program
  on public.learning_program_events (program_id, created_at desc);

create index if not exists idx_learning_program_events_user
  on public.learning_program_events (user_id, created_at desc);

create index if not exists idx_learning_program_events_item
  on public.learning_program_events (program_item_id, created_at desc);

insert into public.learning_categories (slug, label, description, color, icon, sort_order, is_active)
values
  ('science', 'Science', 'Short discoveries about the world and how it works.', '#2563EB', 'atom', 10, true),
  ('language', 'Language', 'Words, meanings, memory, and communication.', '#7C3AED', 'languages', 20, true),
  ('arts', 'Arts', 'Painting, design, craft, and creative observation.', '#DB2777', 'palette', 30, true),
  ('general_knowledge', 'General Knowledge', 'Useful everyday facts and gentle trivia.', '#B45309', 'sparkles', 40, true),
  ('music', 'Music', 'Songs, rhythm, instruments, and listening.', '#0F766E', 'music', 50, true),
  ('history', 'History', 'Human stories, objects, places, and time.', '#92400E', 'landmark', 60, true),
  ('nature', 'Nature', 'Plants, animals, seasons, and habitats.', '#0A7C4E', 'leaf', 70, true),
  ('technology', 'Technology', 'Simple explanations of modern tools.', '#475569', 'cpu', 80, true)
on conflict (slug) do update set
  label = excluded.label,
  description = excluded.description,
  color = excluded.color,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.learning_lessons (
  category_slug, language, title, hook, body, reflection_prompt,
  source_notes, estimated_minutes, difficulty, tags, status, is_active,
  reviewed_at, reviewed_by, published_at, published_by
)
select *
from (values
  ('science', 'en', 'Why soap helps water clean', 'Soap has a tiny split personality.', 'One end of a soap molecule likes water. The other end likes oil and grease. When you wash, soap helps water surround oily dirt so it can lift away and rinse off.', 'Where else have you seen two different things work better together?', 'Starter curated library', 3, 'easy', array['chemistry','everyday'], 'published', true, now(), 'system', now(), 'system'),
  ('science', 'en', 'Why the sky changes color', 'The sky is not painted blue; it is scattered blue.', 'Sunlight contains many colors. Air scatters shorter blue light more than red light, so blue reaches your eyes from many directions. At sunset, sunlight travels farther through air and warmer colors become easier to see.', 'What is the most memorable sky color you have noticed?', 'Starter curated library', 3, 'easy', array['light','weather'], 'published', true, now(), 'system', now(), 'system'),
  ('language', 'en', 'Where words borrow from', 'English is full of borrowed treasures.', 'Many English words came from other languages. Cafe came through French, piano from Italian, and algebra from Arabic. Borrowed words are a record of travel, trade, food, music, and ideas moving between people.', 'Can you think of a word that sounds like it came from somewhere else?', 'Starter curated library', 3, 'easy', array['words','culture'], 'published', true, now(), 'system', now(), 'system'),
  ('language', 'en', 'Why sayings stick', 'A good saying is a tiny memory machine.', 'Phrases like piece of cake or once in a blue moon are easy to remember because they create a picture. The image gives the mind a small hook to hold onto.', 'Which saying or phrase do you still use often?', 'Starter curated library', 2, 'easy', array['memory','phrases'], 'published', true, now(), 'system', now(), 'system'),
  ('arts', 'en', 'How painters guide the eye', 'Artists can quietly decide where you look first.', 'Painters use contrast, lines, light, and empty space to guide attention. A bright sleeve, a doorway, or a diagonal road can pull the eye through a picture almost like a gentle path.', 'When you look at a picture, what usually catches your eye first?', 'Starter curated library', 3, 'easy', array['painting','attention'], 'published', true, now(), 'system', now(), 'system'),
  ('arts', 'en', 'Why frames matter', 'A frame changes how art feels before you notice it.', 'A simple frame can make an image feel calm and modern. A heavy ornate frame can make the same image feel formal or historic. The edge tells your brain how to approach what is inside.', 'What kind of frame would you choose for a favorite photo?', 'Starter curated library', 3, 'easy', array['design','observation'], 'published', true, now(), 'system', now(), 'system'),
  ('general_knowledge', 'en', 'Why calendars need leap years', 'A year is not exactly 365 days.', 'Earth takes about 365 and a quarter days to go around the sun. Without leap years, the calendar would slowly drift away from the seasons. Adding February 29 keeps dates and seasons lined up.', 'What season do you most associate with your birthday?', 'Starter curated library', 3, 'easy', array['calendar','time'], 'published', true, now(), 'system', now(), 'system'),
  ('general_knowledge', 'en', 'Why maps use symbols', 'A map is a quiet agreement.', 'Maps cannot show everything at full size, so they use symbols for roads, stations, parks, and borders. Once you learn the code, a small page can describe a whole town.', 'What map symbol do you recognize immediately?', 'Starter curated library', 3, 'easy', array['maps','everyday'], 'published', true, now(), 'system', now(), 'system'),
  ('music', 'en', 'Why music sticks in memory', 'A melody gives memory a rhythm to walk on.', 'Music combines pattern, repetition, emotion, and timing. That makes songs easier to remember than plain words. This is why old songs can return so clearly after many years.', 'What song can you remember from long ago?', 'Starter curated library', 3, 'easy', array['memory','songs'], 'published', true, now(), 'system', now(), 'system'),
  ('music', 'en', 'Why rhythm feels physical', 'You do not only hear rhythm; you feel it.', 'Rhythm is timing made noticeable. Your brain and body can predict the next beat, which is why tapping a foot can feel almost automatic when music has a strong pulse.', 'What kind of rhythm makes you want to tap along?', 'Starter curated library', 2, 'easy', array['rhythm','listening'], 'published', true, now(), 'system', now(), 'system'),
  ('history', 'en', 'The story hidden in postage stamps', 'A stamp is a tiny poster from its time.', 'Postage stamps often show leaders, landmarks, inventions, plants, animals, or celebrations. Looking at old stamps can reveal what a country wanted people to remember.', 'If you designed a stamp, what would you put on it?', 'Starter curated library', 3, 'easy', array['objects','culture'], 'published', true, now(), 'system', now(), 'system'),
  ('history', 'en', 'Why old recipes matter', 'Recipes carry history in everyday language.', 'A recipe can show what ingredients were common, what tools people had, and what families celebrated. Food history often survives because someone wrote down how to make something loved.', 'What family recipe or meal feels connected to memory?', 'Starter curated library', 3, 'easy', array['food','family'], 'published', true, now(), 'system', now(), 'system'),
  ('nature', 'en', 'How trees share warning signals', 'A forest is quieter than it looks, but not silent.', 'Some trees release chemicals when insects attack their leaves. Nearby plants can respond by increasing their own defenses. Nature often communicates through scent, chemistry, and timing.', 'What is a natural scent that immediately brings a place to mind?', 'Starter curated library', 3, 'easy', array['plants','senses'], 'published', true, now(), 'system', now(), 'system'),
  ('nature', 'en', 'Why birds sing at dawn', 'Morning air can be a good stage.', 'Many birds sing early because sound travels well in cooler, calmer morning air. Dawn songs can mark territory, attract mates, and announce that the singer made it through the night.', 'What morning sound do you notice most?', 'Starter curated library', 3, 'easy', array['birds','morning'], 'published', true, now(), 'system', now(), 'system'),
  ('technology', 'en', 'Why touchscreens know where you tap', 'Your finger changes a tiny electrical field.', 'Many touchscreens hold a fine electrical charge. When your finger touches the glass, it changes the field at that point. The device reads the change and turns it into a tap, swipe, or pinch.', 'Which everyday device still feels a little surprising to you?', 'Starter curated library', 3, 'easy', array['devices','everyday'], 'published', true, now(), 'system', now(), 'system'),
  ('technology', 'en', 'Why passwords like patterns', 'A strong password is less predictable.', 'Computers can try common words and patterns very quickly. A longer password with unrelated words or characters gives the computer many more possibilities to test.', 'What helps you remember important passwords safely?', 'Starter curated library', 3, 'easy', array['safety','digital'], 'published', true, now(), 'system', now(), 'system')
) as seed(category_slug, language, title, hook, body, reflection_prompt, source_notes, estimated_minutes, difficulty, tags, status, is_active, reviewed_at, reviewed_by, published_at, published_by)
where not exists (
  select 1
  from public.learning_lessons existing
  where existing.category_slug = seed.category_slug
    and existing.language = seed.language
    and existing.title = seed.title
);
