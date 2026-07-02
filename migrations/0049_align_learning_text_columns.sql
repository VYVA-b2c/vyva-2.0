do $$
begin
  if to_regclass('public.learning_categories') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'learning_categories'
        and column_name = 'title'
    ) then
      execute $sql$
        update public.learning_categories
        set label = coalesce(
          nullif(label, ''),
          nullif(title->>'en', ''),
          nullif(title->>'es', ''),
          nullif(title->>'default', ''),
          nullif(slug, ''),
          'Learning category'
        )
        where label is null or label = ''
      $sql$;
    else
      update public.learning_categories
      set label = coalesce(nullif(label, ''), nullif(slug, ''), 'Learning category')
      where label is null or label = '';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'learning_categories'
        and column_name = 'description'
        and udt_name = 'jsonb'
    ) then
      alter table public.learning_categories
        alter column description drop default;

      execute $sql$
        alter table public.learning_categories
        alter column description type text
        using coalesce(
          nullif(description->>'en', ''),
          nullif(description->>'es', ''),
          nullif(description->>'default', ''),
          case when jsonb_typeof(description) = 'string' then description #>> '{}' else null end,
          ''
        )
      $sql$;
    end if;

    update public.learning_categories
    set
      slug = coalesce(nullif(slug, ''), id::text),
      label = coalesce(nullif(label, ''), nullif(slug, ''), 'Learning category'),
      description = coalesce(description, ''),
      color = coalesce(nullif(color, ''), '#7C3AED'),
      icon = coalesce(nullif(icon, ''), 'book-open')
    where slug is null
      or slug = ''
      or label is null
      or label = ''
      or description is null
      or color is null
      or color = ''
      or icon is null
      or icon = '';

    alter table public.learning_categories
      alter column slug set not null,
      alter column label set not null,
      alter column description set default '',
      alter column description set not null,
      alter column color set default '#7C3AED',
      alter column color set not null,
      alter column icon set default 'book-open',
      alter column icon set not null;
  end if;
end $$;

do $$
begin
  if to_regclass('public.learning_lessons') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'learning_lessons'
        and column_name = 'title'
        and udt_name = 'jsonb'
    ) then
      alter table public.learning_lessons
        alter column title drop default;

      execute $sql$
        alter table public.learning_lessons
        alter column title type text
        using coalesce(
          nullif(title->>'en', ''),
          nullif(title->>'es', ''),
          nullif(title->>'default', ''),
          nullif(title->>'text', ''),
          case when jsonb_typeof(title) = 'string' then title #>> '{}' else null end,
          nullif(external_id, ''),
          'Untitled lesson'
        )
      $sql$;
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'learning_lessons'
        and column_name = 'body'
        and udt_name = 'jsonb'
    ) then
      alter table public.learning_lessons
        alter column body drop default;

      execute $sql$
        alter table public.learning_lessons
        alter column body type text
        using coalesce(
          nullif(body->>'en', ''),
          nullif(body->>'es', ''),
          nullif(body->>'default', ''),
          nullif(body->>'text', ''),
          case when jsonb_typeof(body) = 'string' then body #>> '{}' else null end,
          ''
        )
      $sql$;
    end if;

    update public.learning_lessons
    set
      external_id = nullif(external_id, ''),
      category_slug = coalesce(nullif(category_slug, ''), 'general_knowledge'),
      language = coalesce(nullif(language, ''), 'en'),
      title = coalesce(nullif(title, ''), nullif(external_id, ''), 'Untitled lesson'),
      hook = coalesce(hook, ''),
      body = coalesce(body, ''),
      reflection_prompt = coalesce(reflection_prompt, ''),
      estimated_minutes = coalesce(estimated_minutes, 3),
      difficulty = coalesce(nullif(difficulty, ''), 'easy'),
      tags = coalesce(tags, '{}'::text[]),
      status = coalesce(nullif(status, ''), 'draft'),
      is_active = coalesce(is_active, true)
    where category_slug is null
      or category_slug = ''
      or language is null
      or language = ''
      or title is null
      or title = ''
      or hook is null
      or body is null
      or reflection_prompt is null
      or estimated_minutes is null
      or difficulty is null
      or difficulty = ''
      or tags is null
      or status is null
      or status = ''
      or is_active is null;

    alter table public.learning_lessons
      alter column category_slug set not null,
      alter column language set default 'en',
      alter column language set not null,
      alter column title set not null,
      alter column hook set default '',
      alter column hook set not null,
      alter column body set not null,
      alter column reflection_prompt set default '',
      alter column reflection_prompt set not null,
      alter column estimated_minutes set default 3,
      alter column estimated_minutes set not null,
      alter column difficulty set default 'easy',
      alter column difficulty set not null,
      alter column tags set default '{}'::text[],
      alter column tags set not null,
      alter column status set default 'draft',
      alter column status set not null,
      alter column is_active set default true,
      alter column is_active set not null;
  end if;
end $$;
