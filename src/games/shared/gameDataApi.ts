import { apiFetch } from "@/lib/queryClient";

type GameDataFilter = {
  column: string;
  expression: string;
};

type GameDataResult<T = unknown> = {
  data: T | null;
  error: Error | null;
};

type Cardinality = "many" | "single" | "maybeSingle";

type GameDataPayload = {
  selectColumns?: string;
  filters?: GameDataFilter[];
  orderClause?: string | null;
  limitCount?: number | null;
  body?: unknown;
  onConflict?: string;
};

function valueForFilter(value: unknown): string {
  if (value === null) return "null";
  return String(value);
}

function errorFromResponse(status: number, statusText: string, body: unknown): Error {
  const message =
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error?: unknown }).error === "string"
      ? (body as { error: string }).error
      : statusText || `Request failed with status ${status}`;
  return new Error(message);
}

class GameDataQuery {
  private readonly resource: string;
  private method: "GET" | "POST" | "PATCH" = "GET";
  private selectColumns = "*";
  private filters: GameDataFilter[] = [];
  private orderClause: string | null = null;
  private limitCount: number | null = null;
  private body: unknown = undefined;
  private onConflict: string | undefined = undefined;

  constructor(resource: string) {
    this.resource = resource;
  }

  select(columns = "*") {
    this.selectColumns = columns;
    return this;
  }

  insert(body: unknown) {
    this.method = "POST";
    this.body = body;
    return this;
  }

  upsert(body: unknown, options?: { onConflict?: string }) {
    this.method = "POST";
    this.body = body;
    this.onConflict = options?.onConflict;
    return this;
  }

  update(body: unknown) {
    this.method = "PATCH";
    this.body = body;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, expression: `eq.${valueForFilter(value)}` });
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push({ column, expression: `gt.${valueForFilter(value)}` });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ column, expression: `gte.${valueForFilter(value)}` });
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push({ column, expression: `lt.${valueForFilter(value)}` });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ column, expression: `lte.${valueForFilter(value)}` });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ column, expression: `in.(${values.map(valueForFilter).join(",")})` });
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    this.filters.push({ column, expression: `not.${operator}.${valueForFilter(value)}` });
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

  single<T = unknown>(): Promise<GameDataResult<T>> {
    return this.execute<T>("single");
  }

  maybeSingle<T = unknown>(): Promise<GameDataResult<T>> {
    return this.execute<T>("maybeSingle");
  }

  then<TResult1 = GameDataResult<unknown[]>, TResult2 = never>(
    onfulfilled?: ((value: GameDataResult<unknown[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute<unknown[]>("many").then(onfulfilled, onrejected);
  }

  private async execute<T>(cardinality: Cardinality): Promise<GameDataResult<T>> {
    const payload: GameDataPayload = {
      selectColumns: this.selectColumns,
      filters: this.filters,
      orderClause: this.orderClause,
      limitCount: this.limitCount,
      body: this.body,
      onConflict: this.onConflict,
    };
    const path = this.method === "GET" ? "query" : "";
    const url = `/api/games/data/${encodeURIComponent(this.resource)}${path ? `/${path}` : ""}`;
    const response = await apiFetch(url, {
      method: this.method === "GET" ? "POST" : this.method,
      body: JSON.stringify(payload),
    });
    let responseBody: { data?: unknown; error?: string } | null = null;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = null;
    }

    if (!response.ok) {
      return { data: null, error: errorFromResponse(response.status, response.statusText, responseBody) };
    }

    const rows = Array.isArray(responseBody?.data) ? responseBody.data : [];
    const data =
      cardinality === "single"
        ? rows[0] ?? null
        : cardinality === "maybeSingle"
          ? rows[0] ?? null
          : rows;
    return { data: data as T, error: null };
  }
}

export const gameData = {
  table(resource: string) {
    return new GameDataQuery(resource);
  },
};
