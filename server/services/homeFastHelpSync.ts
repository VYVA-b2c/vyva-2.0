import type { PoolClient } from "pg";
import { pool } from "../db.js";
import {
  HOME_FAST_HELP_ACTION_IDS,
  homeFastHelpEventWinner,
  type HomeFastHelpActionId,
  type HomeFastHelpOutcomeAggregate,
  type HomeFastHelpOutcomeAggregateRow,
  type HomeFastHelpSyncedEvent,
  type HomeFastHelpSyncedImpression,
  type HomeFastHelpSyncedJourney,
} from "../../shared/homeFastHelpSync.js";

type StoredJourneyRow = {
  id: string;
  action_id: HomeFastHelpActionId;
  impression_id: string | null;
  status: HomeFastHelpSyncedJourney["status"];
  started_at: Date | string;
  updated_at: Date | string;
  reference_id: string | null;
};

type StoredEventRow = {
  id: string;
  journey_id: string;
  status: HomeFastHelpSyncedEvent["status"];
  occurred_at: Date | string;
  reference_id: string | null;
};

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function storedEvent(row: StoredEventRow): HomeFastHelpSyncedEvent {
  return {
    id: row.id,
    status: row.status,
    occurredAt: iso(row.occurred_at),
    referenceId: row.reference_id,
  };
}

async function eventsForJourneys(
  client: Pick<PoolClient, "query">,
  userId: string,
  journeyIds: string[],
) {
  if (journeyIds.length === 0) return new Map<string, HomeFastHelpSyncedEvent[]>();
  const result = await client.query<StoredEventRow>(`
    select id, journey_id, status, occurred_at, reference_id
    from public.home_fast_help_journey_events
    where user_id = $1::uuid
      and journey_id = any($2::uuid[])
    order by occurred_at asc, id asc
  `, [userId, journeyIds]);
  const byJourney = new Map<string, HomeFastHelpSyncedEvent[]>();
  for (const row of result.rows) {
    byJourney.set(row.journey_id, [...(byJourney.get(row.journey_id) ?? []), storedEvent(row)]);
  }
  return byJourney;
}

async function loadJourneys(
  client: Pick<PoolClient, "query">,
  userId: string,
  limit = 30,
): Promise<HomeFastHelpSyncedJourney[]> {
  const result = await client.query<StoredJourneyRow>(`
    select id, action_id, impression_id, status, started_at, updated_at, reference_id
    from public.home_fast_help_journeys
    where user_id = $1::uuid
    order by updated_at desc, id desc
    limit $2
  `, [userId, Math.max(1, Math.min(limit, 50))]);
  const eventMap = await eventsForJourneys(client, userId, result.rows.map((row) => row.id));
  return result.rows.map((row) => ({
    id: row.id,
    actionId: row.action_id,
    impressionId: row.impression_id,
    status: row.status,
    startedAt: iso(row.started_at),
    updatedAt: iso(row.updated_at),
    referenceId: row.reference_id,
    events: eventMap.get(row.id) ?? [],
  }));
}

export async function homeFastHelpSyncAvailableForUser(userId: string) {
  const result = await pool.query<{ available: boolean }>(`
    select exists (
      select 1 from auth.users where id = $1::uuid
    ) as available
  `, [userId]);
  return Boolean(result.rows[0]?.available);
}

export async function listHomeFastHelpJourneys(userId: string) {
  return loadJourneys(pool, userId);
}

export async function syncHomeFastHelpJourneys(
  userId: string,
  journeys: HomeFastHelpSyncedJourney[],
  impressions: HomeFastHelpSyncedImpression[] = [],
) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const impression of impressions) {
      await client.query(`
        insert into public.home_fast_help_impressions (
          id, user_id, action_ids, ranking_version, shown_at
        ) values ($1::uuid, $2::uuid, $3::text[], $4, $5::timestamptz)
        on conflict (id) do nothing
      `, [impression.id, userId, impression.actionIds, impression.rankingVersion, impression.shownAt]);
    }

    for (const journey of journeys) {
      const initialWinner = homeFastHelpEventWinner(journey.events);
      await client.query(`
        insert into public.home_fast_help_journeys (
          id, user_id, impression_id, action_id, status, started_at, updated_at, reference_id, synced_at
        ) values (
          $1::uuid,
          $2::uuid,
          (
            select id
            from public.home_fast_help_impressions
            where id = $3::uuid
              and user_id = $2::uuid
              and $4 = any(action_ids)
          ),
          $4,
          $5,
          $6::timestamptz,
          $7::timestamptz,
          $8,
          now()
        )
        on conflict (id) do nothing
      `, [
        journey.id,
        userId,
        journey.impressionId ?? null,
        journey.actionId,
        initialWinner?.status ?? journey.status,
        journey.startedAt,
        initialWinner?.occurredAt ?? journey.updatedAt,
        initialWinner?.referenceId ?? journey.referenceId ?? null,
      ]);

      const owned = await client.query<{ id: string }>(`
        select id
        from public.home_fast_help_journeys
        where id = $1::uuid and user_id = $2::uuid
        for update
      `, [journey.id, userId]);
      if (owned.rows.length === 0) continue;

      for (const event of journey.events) {
        await client.query(`
          insert into public.home_fast_help_journey_events (
            id, journey_id, user_id, status, occurred_at, reference_id
          ) values ($1::uuid, $2::uuid, $3::uuid, $4, $5::timestamptz, $6)
          on conflict (id) do nothing
        `, [event.id, journey.id, userId, event.status, event.occurredAt, event.referenceId ?? null]);
      }

      const storedEvents = await client.query<StoredEventRow>(`
        select id, journey_id, status, occurred_at, reference_id
        from public.home_fast_help_journey_events
        where journey_id = $1::uuid and user_id = $2::uuid
        order by occurred_at asc, id asc
      `, [journey.id, userId]);
      const winner = homeFastHelpEventWinner(storedEvents.rows.map(storedEvent));
      if (!winner) continue;

      await client.query(`
        update public.home_fast_help_journeys
        set
          status = $3,
          started_at = least(started_at, $4::timestamptz),
          updated_at = $5::timestamptz,
          reference_id = $6,
          impression_id = coalesce(
            impression_id,
            (
              select i.id
              from public.home_fast_help_impressions i
              where i.id = $7::uuid
                and i.user_id = $2::uuid
                and home_fast_help_journeys.action_id = any(i.action_ids)
            )
          ),
          synced_at = now()
        where id = $1::uuid and user_id = $2::uuid
      `, [
        journey.id,
        userId,
        winner.status,
        journey.startedAt,
        winner.occurredAt,
        winner.referenceId ?? null,
        journey.impressionId ?? null,
      ]);
    }
    const merged = await loadJourneys(client, userId);
    await client.query("commit");
    return merged;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

type AggregateRow = {
  action_id: HomeFastHelpActionId;
  shown: string | number;
  attributed_opened: string | number;
  attributed_completed: string | number;
  attributed_blocked: string | number;
  opened: string | number;
  completed: string | number;
  dismissed: string | number;
  abandoned: string | number;
  blocked: string | number;
  resumed: string | number;
  recovered: string | number;
};

type RankingVersionAggregateRow = {
  ranking_version: string;
  impressions: string | number;
  version_shown: string | number;
  action_id: HomeFastHelpActionId;
  action_shown: string | number;
  opened: string | number;
  completed: string | number;
  blocked: string | number;
};

function emptyAggregateRow(actionId: HomeFastHelpActionId): HomeFastHelpOutcomeAggregateRow {
  return {
    actionId,
    shown: 0,
    attributedOpened: 0,
    attributedCompleted: 0,
    attributedBlocked: 0,
    opened: 0,
    completed: 0,
    dismissed: 0,
    abandoned: 0,
    blocked: 0,
    resumed: 0,
    recovered: 0,
  };
}

export async function homeFastHelpOutcomeAggregate(windowDays = 30): Promise<HomeFastHelpOutcomeAggregate> {
  const days = Math.max(1, Math.min(Math.round(windowDays), 90));
  const result = await pool.query<AggregateRow>(`
    with scoped_impressions as (
      select i.id, exposed.action_id
      from public.home_fast_help_impressions i
      cross join lateral unnest(i.action_ids) as exposed(action_id)
      where i.shown_at >= now() - ($1::int * interval '1 day')
    ), exposure as (
      select action_id, count(*)::int as shown
      from scoped_impressions
      group by action_id
    ), scoped as (
      select id, impression_id, action_id, status
      from public.home_fast_help_journeys
      where started_at >= now() - ($1::int * interval '1 day')
    ), resumed as (
      select
        e.journey_id,
        greatest(count(*) filter (where e.status = 'opened') - 1, 0)::int as resumed,
        bool_or(e.status = 'opened' and e.reference_id = 'recovery_nudge') as recovery_nudged
      from public.home_fast_help_journey_events e
      inner join scoped s on s.id = e.journey_id
      group by e.journey_id
    ), attributed as (
      select
        s.impression_id,
        s.action_id,
        bool_or(s.status = 'completed') as completed,
        bool_or(s.status = 'blocked') as blocked
      from scoped s
      inner join scoped_impressions i on i.id = s.impression_id and i.action_id = s.action_id
      group by s.impression_id, s.action_id
    ), attributed_totals as (
      select
        action_id,
        count(*)::int as attributed_opened,
        count(*) filter (where completed)::int as attributed_completed,
        count(*) filter (where blocked)::int as attributed_blocked
      from attributed
      group by action_id
    ), outcomes as (
      select
      s.action_id,
      count(*)::int as opened,
      count(*) filter (where s.status = 'completed')::int as completed,
      count(*) filter (where s.status = 'dismissed')::int as dismissed,
      count(*) filter (where s.status = 'abandoned')::int as abandoned,
      count(*) filter (where s.status = 'blocked')::int as blocked,
      coalesce(sum(r.resumed), 0)::int as resumed,
      count(*) filter (where s.status = 'completed' and r.recovery_nudged)::int as recovered
    from scoped s
    left join resumed r on r.journey_id = s.id
    group by s.action_id
    ), action_ids as (
      select action_id from exposure
      union
      select action_id from outcomes
      union
      select action_id from attributed_totals
    )
    select
      ids.action_id,
      coalesce(e.shown, 0)::int as shown,
      coalesce(a.attributed_opened, 0)::int as attributed_opened,
      coalesce(a.attributed_completed, 0)::int as attributed_completed,
      coalesce(a.attributed_blocked, 0)::int as attributed_blocked,
      coalesce(o.opened, 0)::int as opened,
      coalesce(o.completed, 0)::int as completed,
      coalesce(o.dismissed, 0)::int as dismissed,
      coalesce(o.abandoned, 0)::int as abandoned,
      coalesce(o.blocked, 0)::int as blocked,
      coalesce(o.resumed, 0)::int as resumed,
      coalesce(o.recovered, 0)::int as recovered
    from action_ids ids
    left join exposure e on e.action_id = ids.action_id
    left join outcomes o on o.action_id = ids.action_id
    left join attributed_totals a on a.action_id = ids.action_id
  `, [days]);
  const versionResult = await pool.query<RankingVersionAggregateRow>(`
    with scoped_impressions as (
      select id, action_ids, ranking_version, shown_at
      from public.home_fast_help_impressions
      where shown_at >= now() - ($1::int * interval '1 day')
    ), exposed as (
      select i.id, i.ranking_version, i.shown_at, action.action_id
      from scoped_impressions i
      cross join lateral unnest(i.action_ids) as action(action_id)
    ), version_exposure as (
      select
        ranking_version,
        count(*)::int as impressions,
        coalesce(sum(cardinality(action_ids)), 0)::int as shown,
        max(shown_at) as latest_shown_at
      from scoped_impressions
      group by ranking_version
    ), action_exposure as (
      select ranking_version, action_id, count(*)::int as shown
      from exposed
      group by ranking_version, action_id
    ), attributed as (
      select
        e.ranking_version,
        j.impression_id,
        j.action_id,
        bool_or(j.status = 'completed') as completed,
        bool_or(j.status = 'blocked') as blocked
      from exposed e
      inner join public.home_fast_help_journeys j
        on j.impression_id = e.id
        and j.action_id = e.action_id
      group by e.ranking_version, j.impression_id, j.action_id
    ), outcomes as (
      select
        ranking_version,
        action_id,
        count(*)::int as opened,
        count(*) filter (where completed)::int as completed,
        count(*) filter (where blocked)::int as blocked
      from attributed
      group by ranking_version, action_id
    )
    select
      v.ranking_version,
      v.impressions,
      v.shown as version_shown,
      a.action_id,
      a.shown as action_shown,
      coalesce(o.opened, 0)::int as opened,
      coalesce(o.completed, 0)::int as completed,
      coalesce(o.blocked, 0)::int as blocked
    from version_exposure v
    inner join action_exposure a on a.ranking_version = v.ranking_version
    left join outcomes o
      on o.ranking_version = a.ranking_version
      and o.action_id = a.action_id
    order by v.latest_shown_at desc, v.ranking_version asc, a.action_id asc
  `, [days]);
  const byAction = new Map(result.rows.map((row) => [row.action_id, row]));
  const actions = HOME_FAST_HELP_ACTION_IDS.map((actionId) => {
    const row = byAction.get(actionId);
    if (!row) return emptyAggregateRow(actionId);
    return {
      actionId,
      shown: Number(row.shown),
      attributedOpened: Number(row.attributed_opened),
      attributedCompleted: Number(row.attributed_completed),
      attributedBlocked: Number(row.attributed_blocked),
      opened: Number(row.opened),
      completed: Number(row.completed),
      dismissed: Number(row.dismissed),
      abandoned: Number(row.abandoned),
      blocked: Number(row.blocked),
      resumed: Number(row.resumed),
      recovered: Number(row.recovered),
    };
  });
  const totals = actions.reduce<HomeFastHelpOutcomeAggregate["totals"]>((sum, row) => ({
    shown: sum.shown + row.shown,
    attributedOpened: sum.attributedOpened + row.attributedOpened,
    attributedCompleted: sum.attributedCompleted + row.attributedCompleted,
    attributedBlocked: sum.attributedBlocked + row.attributedBlocked,
    opened: sum.opened + row.opened,
    completed: sum.completed + row.completed,
    dismissed: sum.dismissed + row.dismissed,
    abandoned: sum.abandoned + row.abandoned,
    blocked: sum.blocked + row.blocked,
    resumed: sum.resumed + row.resumed,
    recovered: sum.recovered + row.recovered,
  }), {
    shown: 0,
    attributedOpened: 0,
    attributedCompleted: 0,
    attributedBlocked: 0,
    opened: 0,
    completed: 0,
    dismissed: 0,
    abandoned: 0,
    blocked: 0,
    resumed: 0,
    recovered: 0,
  });
  const rankingVersions: HomeFastHelpOutcomeAggregate["rankingVersions"] = [];
  const versionByName = new Map<string, HomeFastHelpOutcomeAggregate["rankingVersions"][number]>();
  for (const row of versionResult.rows) {
    let version = versionByName.get(row.ranking_version);
    if (!version) {
      version = {
        rankingVersion: row.ranking_version,
        impressions: Number(row.impressions),
        shown: Number(row.version_shown),
        opened: 0,
        completed: 0,
        blocked: 0,
        actions: [],
      };
      versionByName.set(row.ranking_version, version);
      rankingVersions.push(version);
    }
    const action = {
      actionId: row.action_id,
      shown: Number(row.action_shown),
      opened: Number(row.opened),
      completed: Number(row.completed),
      blocked: Number(row.blocked),
    };
    version.actions.push(action);
    version.opened += action.opened;
    version.completed += action.completed;
    version.blocked += action.blocked;
  }

  return { generatedAt: new Date().toISOString(), windowDays: days, totals, actions, rankingVersions };
}
