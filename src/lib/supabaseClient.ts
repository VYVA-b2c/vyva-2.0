import { getToken } from "@/lib/auth";

type SupabaseConfig = {
  url: string;
  anonKey: string;
};

type QueryResult<T = unknown> = {
  data: T | null;
  error: { message: string; details?: unknown } | null;
};

let runtimeConfigPromise: Promise<SupabaseConfig | null> | null = null;

function getBuildtimeSupabaseConfig(): SupabaseConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!url || !anonKey) return null;
  return { url: url.replace(/\/$/, ""), anonKey };
}

async function getRuntimeSupabaseConfig(): Promise<SupabaseConfig | null> {
  if (!runtimeConfigPromise) {
    runtimeConfigPromise = fetch("/api/auth/supabase-config")
      .then(async (response) => {
        if (!response.ok) return null;
        const data = await response.json().catch(() => null) as {
          configured?: boolean;
          url?: string;
          anonKey?: string;
        } | null;
        if (!data?.configured || !data.url || !data.anonKey) return null;
        return { url: data.url.replace(/\/$/, ""), anonKey: data.anonKey };
      })
      .catch(() => null);
  }

  return runtimeConfigPromise;
}

async function getSupabaseConfig(): Promise<SupabaseConfig | null> {
  return getBuildtimeSupabaseConfig() ?? await getRuntimeSupabaseConfig();
}

function formatFilterValue(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function serializeBody(values: unknown) {
  return JSON.stringify(Array.isArray(values) ? values : values);
}

class SupabaseRestQuery {
  private method = "GET";
  private selectColumns = "*";
  private filters: Array<{ column: string; expression: string }> = [];
  private orderClause: string | null = null;
  private limitCount: number | null = null;
  private body: unknown = null;
  private prefer: string[] = [];
  private onConflict: string | null = null;

  constructor(private readonly table: string) {}

  select(columns = "*") {
    this.selectColumns = columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, expression: `eq.${formatFilterValue(value)}` });
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push({ column, expression: `gt.${formatFilterValue(value)}` });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ column, expression: `gte.${formatFilterValue(value)}` });
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push({ column, expression: `lt.${formatFilterValue(value)}` });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ column, expression: `lte.${formatFilterValue(value)}` });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({
      column,
      expression: `in.(${values.map(formatFilterValue).join(",")})`,
    });
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    this.filters.push({ column, expression: `not.${operator}.${formatFilterValue(value)}` });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderClause = `${column}.${options?.ascending === false ? "desc" : "asc"}`;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  insert(values: unknown) {
    this.method = "POST";
    this.body = values;
    this.prefer = ["return=representation"];
    return this;
  }

  upsert(values: unknown, options?: { onConflict?: string }) {
    this.method = "POST";
    this.body = values;
    this.prefer = ["resolution=merge-duplicates", "return=representation"];
    this.onConflict = options?.onConflict ?? null;
    return this;
  }

  update(values: unknown) {
    this.method = "PATCH";
    this.body = values;
    this.prefer = ["return=representation"];
    return this;
  }

  async single<T = unknown>(): Promise<QueryResult<T>> {
    return this.execute<T>("single");
  }

  async maybeSingle<T = unknown>(): Promise<QueryResult<T>> {
    return this.execute<T>("maybeSingle");
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute<T = unknown>(cardinality?: "single" | "maybeSingle"): Promise<QueryResult<T>> {
    const config = await getSupabaseConfig();
    if (!config) {
      return this.executeBackendFallback<T>(cardinality);
    }

    const params = new URLSearchParams();
    if (this.method !== "GET" || this.selectColumns) params.set("select", this.selectColumns);
    if (this.orderClause) params.set("order", this.orderClause);
    if (this.limitCount !== null) params.set("limit", String(this.limitCount));
    if (this.onConflict) params.set("on_conflict", this.onConflict);
    this.filters.forEach((filter) => {
      params.append(filter.column, filter.expression);
    });

    const token = getToken();
    const headers: Record<string, string> = {
      apikey: config.anonKey,
      Authorization: `Bearer ${token ?? config.anonKey}`,
      "Content-Type": "application/json",
    };

    if (cardinality) {
      headers.Accept = "application/vnd.pgrst.object+json";
    }

    if (this.prefer.length > 0) {
      headers.Prefer = this.prefer.join(",");
    }

    const response = await fetch(`${config.url}/rest/v1/${this.table}?${params.toString()}`, {
      method: this.method,
      headers,
      body: this.body === null ? undefined : serializeBody(this.body),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (cardinality === "maybeSingle" && response.status === 406) {
        return { data: null, error: null };
      }
      return {
        data: null,
        error: {
          message: data?.message ?? data?.error_description ?? data?.error ?? response.statusText,
          details: data,
        },
      };
    }

    return { data: data as T, error: null };
  }

  private async executeBackendFallback<T = unknown>(cardinality?: "single" | "maybeSingle"): Promise<QueryResult<T>> {
    const token = getToken();
    const response = await fetch(`/api/games/supabase/${encodeURIComponent(this.table)}`, {
      method: "POST",
      credentials: "include",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method: this.method,
        selectColumns: this.selectColumns,
        filters: this.filters,
        orderClause: this.orderClause,
        limitCount: this.limitCount,
        body: this.body,
        onConflict: this.onConflict,
      }),
    });

    const payload = await response.json().catch(() => null) as { data?: unknown; error?: string } | null;
    if (!response.ok) {
      return {
        data: null,
        error: {
          message: payload?.error ?? response.statusText,
          details: payload,
        },
      };
    }

    const data = payload?.data ?? null;
    if (cardinality) {
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      if (rows.length === 0 && cardinality === "maybeSingle") {
        return { data: null, error: null };
      }
      if (rows.length === 0) {
        return { data: null, error: { message: "No rows returned." } };
      }
      return { data: rows[0] as T, error: null };
    }

    return { data: data as T, error: null };
  }
}

export const supabase = {
  from(table: string) {
    return new SupabaseRestQuery(table);
  },
};
