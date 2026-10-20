// Small, dependency-free fake of the Supabase JS query builder. It records the
// chain and lets each test answer from the final query shape, so route tests
// exercise the real handler logic without a database or network.

export type FakeFilter = {
  kind: "eq" | "neq" | "gte" | "in" | "is";
  column: string;
  value: unknown;
};

export type FakeQuery = {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  select?: string;
  count?: "exact" | "planned" | "estimated";
  head?: boolean;
  values?: unknown;
  filters: FakeFilter[];
  order?: { column: string; ascending: boolean };
  limit?: number;
  range?: { from: number; to: number };
};

export type FakeResult = {
  data?: unknown;
  error?: unknown;
  count?: number | null;
};

export type FakeHandler = (q: FakeQuery) => FakeResult | Promise<FakeResult>;

export type FakeSupabase = {
  from: (table: string) => unknown;
};

export function fakeSupabase(handler: FakeHandler): {
  client: FakeSupabase;
  queries: FakeQuery[];
} {
  const queries: FakeQuery[] = [];

  function from(table: string) {
    const q: FakeQuery = { table, op: "select", filters: [] };

    const resolve = async (mode: "many" | "single" | "maybe") => {
      queries.push(q);
      const result = await handler(q);
      if (result.error) {
        return { data: null, error: result.error, count: result.count ?? null };
      }
      // Emulate PostgREST column projection for SELECTs (the real API never
      // returns columns that were not requested).
      let data = result.data;
      if (q.op === "select" && q.select && !q.count && q.select.trim() !== "*") {
        const cols = q.select.split(",").map((s) => s.trim()).filter(Boolean);
        const project = (row: unknown) => {
          if (!row || typeof row !== "object") return row;
          return Object.fromEntries(cols.map((c) => [c, (row as Record<string, unknown>)[c]]));
        };
        data = Array.isArray(data) ? data.map(project) : project(data);
      }
      if (mode === "many") {
        return { data: data ?? [], error: null, count: result.count ?? null };
      }
      const raw = data;
      const one = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
      return { data: one, error: null, count: result.count ?? null };
    };

    const builder: Record<string, unknown> = {
      select(columns?: string, options?: { count?: FakeQuery["count"]; head?: boolean }) {
        q.select = columns;
        if (options?.count) q.count = options.count;
        if (options?.head) q.head = true;
        return builder;
      },
      insert(values: unknown) {
        q.op = "insert";
        q.values = values;
        return builder;
      },
      update(values: unknown) {
        q.op = "update";
        q.values = values;
        return builder;
      },
      delete() {
        q.op = "delete";
        return builder;
      },
      eq(column: string, value: unknown) {
        q.filters.push({ kind: "eq", column, value });
        return builder;
      },
      neq(column: string, value: unknown) {
        q.filters.push({ kind: "neq", column, value });
        return builder;
      },
      gte(column: string, value: unknown) {
        q.filters.push({ kind: "gte", column, value });
        return builder;
      },
      in(column: string, value: unknown[]) {
        q.filters.push({ kind: "in", column, value });
        return builder;
      },
      is(column: string, value: unknown) {
        q.filters.push({ kind: "is", column, value });
        return builder;
      },
      order(column: string, options?: { ascending?: boolean }) {
        q.order = { column, ascending: options?.ascending !== false };
        return builder;
      },
      limit(n: number) {
        q.limit = n;
        return builder;
      },
      range(from: number, to: number) {
        q.range = { from, to };
        return builder;
      },
      maybeSingle() {
        return resolve("maybe");
      },
      single() {
        return resolve("single");
      },
      then(
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) {
        return resolve("many").then(onFulfilled, onRejected);
      },
    };

    return builder;
  }

  return { client: { from }, queries };
}

export function filterValue(q: FakeQuery, column: string): unknown {
  return q.filters.find((f) => f.kind === "eq" && f.column === column)?.value;
}

export function inValues(q: FakeQuery, column: string): string[] {
  const v = q.filters.find((f) => f.kind === "in" && f.column === column)?.value;
  return Array.isArray(v) ? v.map(String) : [];
}
