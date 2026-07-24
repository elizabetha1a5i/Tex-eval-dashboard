import { sql } from "@vercel/postgres";

export type EvalTest = {
  test_id: string;
  name: string;
  category: string;
  status: string;
  score?: string | null;
  alignment_score?: number | null;
  penalty_points?: number | null;
  importance?: number | null;
  summary?: string | null;
  response_time?: number | null;
  message_count?: number | null;
  screenshot_path?: string | null;
  conversation_text?: string | null;
};

export type EvalRun = {
  run_date: string;
  environment: string;
  methodology?: string;
  tests: EvalTest[];
};

export async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS eval_runs (
      id BIGSERIAL PRIMARY KEY,
      test_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      run_date TIMESTAMPTZ NOT NULL DEFAULT now(),
      environment TEXT,
      methodology TEXT,
      status TEXT,
      score TEXT,
      alignment_score NUMERIC,
      penalty_points NUMERIC,
      importance NUMERIC,
      summary TEXT,
      response_time NUMERIC,
      message_count INT,
      screenshot_path TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`ALTER TABLE eval_runs ADD COLUMN IF NOT EXISTS conversation_text TEXT;`;
  await sql`ALTER TABLE eval_runs ADD COLUMN IF NOT EXISTS notes TEXT;`;
  await sql`CREATE INDEX IF NOT EXISTS idx_eval_runs_run_date ON eval_runs (run_date DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_eval_runs_category ON eval_runs (category);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_eval_runs_status ON eval_runs (status);`;
}

export async function insertRun(run: EvalRun) {
  const runDate = run.run_date ? new Date(run.run_date).toISOString() : new Date().toISOString();
  for (const t of run.tests) {
    await sql`
      INSERT INTO eval_runs (
        test_id, name, category, run_date, environment, methodology, status,
        score, alignment_score, penalty_points, importance, summary,
        response_time, message_count, screenshot_path, conversation_text
      ) VALUES (
        ${t.test_id}, ${t.name}, ${t.category}, ${runDate}, ${run.environment}, ${run.methodology ?? null},
        ${t.status}, ${t.score ?? null}, ${t.alignment_score ?? null}, ${t.penalty_points ?? null},
        ${t.importance ?? null}, ${t.summary ?? null}, ${t.response_time ?? null},
        ${t.message_count ?? null}, ${t.screenshot_path ?? null}, ${t.conversation_text ?? null}
      );
    `;
  }
}

export async function updateRun(id: string | number, fields: { status?: string; notes?: string }) {
  if (fields.status !== undefined) {
    await sql`UPDATE eval_runs SET status = ${fields.status} WHERE id = ${id};`;
  }
  if (fields.notes !== undefined) {
    await sql`UPDATE eval_runs SET notes = ${fields.notes} WHERE id = ${id};`;
  }
}

export async function deleteRun(id: string | number) {
  await sql`DELETE FROM eval_runs WHERE id = ${id};`;
}

export async function getRunById(id: string | number) {
  const { rows } = await sql`SELECT * FROM eval_runs WHERE id = ${id} LIMIT 1;`;
  return rows[0] ?? null;
}

// ============================================================================
// TEST CASES — versioned test-case library (draft/in_review/approved/active/deprecated)
// ============================================================================

export type TestCaseHistoryEntry = {
  version: number;
  changed_at: string;
  changed_by: string;
  note?: string;
};

export type TestCase = {
  id: string;
  title: string;
  category?: string | null;
  preconditions?: string | null;
  conversation: { user: string; wait_for_response?: boolean }[];
  expected_result?: string | null;
  owner?: string | null;
  status: "draft" | "in_review" | "approved" | "active" | "deprecated";
  requirement_ref?: string | null;
};

export async function ensureTestCaseSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS test_cases (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT,
      preconditions TEXT,
      conversation JSONB NOT NULL,
      expected_result TEXT,
      owner TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      version INT NOT NULL DEFAULT 1,
      requirement_ref TEXT,
      history JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_test_cases_status ON test_cases (status);`;
}

export async function listTestCases(filters: { status?: string[] } = {}) {
  const statuses = filters.status && filters.status.length ? filters.status : null;
  const { rows } = await sql`
    SELECT * FROM test_cases
    WHERE (${statuses}::text[] IS NULL OR status = ANY(${statuses}::text[]))
    ORDER BY id ASC;
  `;
  return rows;
}

export async function getTestCase(id: string) {
  const { rows } = await sql`SELECT * FROM test_cases WHERE id = ${id} LIMIT 1;`;
  return rows[0] ?? null;
}

export async function upsertTestCase(tc: Partial<TestCase> & { id: string }, changedBy: string) {
  const existing = await getTestCase(tc.id);
  const now = new Date().toISOString();

  if (!existing) {
    await sql`
      INSERT INTO test_cases (
        id, title, category, preconditions, conversation, expected_result,
        owner, status, version, requirement_ref, history
      ) VALUES (
        ${tc.id}, ${tc.title}, ${tc.category ?? null}, ${tc.preconditions ?? null},
        ${JSON.stringify(tc.conversation ?? [])}, ${tc.expected_result ?? null},
        ${tc.owner ?? null}, ${tc.status ?? "draft"}, 1, ${tc.requirement_ref ?? null}, '[]'
      );
    `;
    return { id: tc.id, created: true };
  }

  const history: TestCaseHistoryEntry[] = Array.isArray(existing.history) ? existing.history : [];
  history.push({
    version: existing.version,
    changed_at: now,
    changed_by: changedBy,
    note: `status=${existing.status}`,
  });
  const nextVersion = existing.version + 1;

  await sql`
    UPDATE test_cases SET
      title = ${tc.title ?? existing.title},
      category = ${tc.category ?? existing.category},
      preconditions = ${tc.preconditions ?? existing.preconditions},
      conversation = ${JSON.stringify(tc.conversation ?? existing.conversation)},
      expected_result = ${tc.expected_result ?? existing.expected_result},
      owner = ${tc.owner ?? existing.owner},
      status = ${tc.status ?? existing.status},
      version = ${nextVersion},
      requirement_ref = ${tc.requirement_ref ?? existing.requirement_ref},
      history = ${JSON.stringify(history)},
      updated_at = ${now}
    WHERE id = ${tc.id};
  `;
  return { id: tc.id, created: false, version: nextVersion };
}

export type RunFilters = {
  environment?: string;
  category?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

export async function listRuns(filters: RunFilters) {
  // Treat empty strings the same as "not set" — an empty string cast to
  // ::timestamptz throws in Postgres, unlike null, and callers (query
  // params from a form) commonly send "" rather than omitting the key.
  const environment = filters.environment || null;
  const category = filters.category || null;
  const status = filters.status || null;
  const dateFrom = filters.dateFrom || null;
  const dateTo = filters.dateTo || null;
  const limit = filters.limit ?? 200;

  const { rows } = await sql`
    SELECT * FROM eval_runs
    WHERE
      (${environment}::text IS NULL OR environment = ${environment})
      AND (${category}::text IS NULL OR category = ${category})
      AND (${status}::text IS NULL OR UPPER(status) = UPPER(${status}))
      AND (${dateFrom}::timestamptz IS NULL OR run_date >= ${dateFrom})
      AND (${dateTo}::timestamptz IS NULL OR run_date <= ${dateTo})
    ORDER BY run_date DESC
    LIMIT ${limit};
  `;
  return rows;
}
