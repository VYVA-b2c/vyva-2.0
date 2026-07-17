import type { PoolClient } from "pg";
import { pool } from "../db.js";
import {
  HOME_FAST_HELP_ACTION_IDS,
  homeFastHelpEventWinner,
  type HomeFastHelpActionId,
  type HomeFastHelpOutcomeAggregate,
  type HomeFastHelpOutcomeAggregateRow,
  type HomeFastHelpSyncedEvent,
  type HomeFastHelpSyncedJourney,
} from "../../shared/homeFastHelpSync.js";

type StoredJourneyRow = {
  id: string;
  action_id: HomeFastHelpActionId;
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
    select id, action_id, status, started_at, updated_at, reference_id
    from public.home_fast_help_journeys
    where user_id = $1::uuid
    order by updated_at desc, id desc
    limit $2
  `, [userId, Math.max(1, Math.min(limit, 50))]);
  const eventMap = await eventsForJourneys(client, userId, result.rows.map((row) => row.id));
  return result.rows.map((row) => ({
    id: row.id,
    actionId: row.action_id,
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
) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const journey of journeys) {
      const initialWinner = homeFastHelpEventWinner(journey.events);
      await client.query(`
        insert into public.home_fast_help_journeys (
          id, user_id, action_id, status, started_at, updated_at, reference_id, synced_at
        ) values ($1::uuid, $2::uuid, $3, $4, $5::timestamptz, $6::timestamptz, $7, now())
        on conflict (id) do nothing
      `, [
        journey.id,
        userId,
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
          synced_at = now()
        where id = $1::uuid and user_id = $2::uuid
      `, [
        journey.id,
        userId,
        winner.status,
        journey.startedAt,
        winner.occurredAt,
        winner.referenceId ?? null,
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
  opened: string | number;
  completed: string | number;
  dismissed: string | number;
  abandoned: string | number;
  blocked: string | number;
  resumed: string | number;
  recovered: string | number;
};

function emptyAggregateRow(actionId: HomeFastHelpActionId): HomeFastHelpOutcomeAggregateRow {
  return { actionId, opened: 0, completed: 0, dismissed: 0, abandoned: 0, blocked: 0, resumed: 0, recovered: 0 };
}

export async function homeFastHelpOutcomeAggregate(windowDays = 30): Promise<HomeFastHelpOutcomeAggregate> {
  const days = Math.max(1, Math.min(Math.round(windowDays), 90));
  const result = await pool.query<AggregateRow>(`
    with scoped as (
      select id, action_id, status
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
    )
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
  `, [days]);
  const byAction = new Map(result.rows.map((row) => [row.action_id, row]));
  const actions = HOME_FAST_HELP_ACTION_IDS.map((actionId) => {
    const row = byAction.get(actionId);
    if (!row) return emptyAggregateRow(actionId);
    return {
      actionId,
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
    opened: sum.opened + row.opened,
    completed: sum.completed + row.completed,
    dismissed: sum.dismissed + row.dismissed,
    abandoned: sum.abandoned + row.abandoned,
    blocked: sum.blocked + row.blocked,
    resumed: sum.resumed + row.resumed,
    recovered: sum.recovered + row.recovered,
  }), { opened: 0, completed: 0, dismissed: 0, abandoned: 0, blocked: 0, resumed: 0, recovered: 0 });

  return { generatedAt: new Date().toISOString(), windowDays: days, totals, actions };
}
