import { sql } from "@vercel/postgres";

export type EvalResult = {
  test_id: string;
  name: string;
  category: string;
  date: string;
  environment: string;
  status: string;
  score: number | null;
  criteria_tested: number | null;
  criteria_passed: number | null;
  criteria_failed: number | null;
  critical_failures: number | null;
  high_failures: number | null;
  other_failures: number | null;
  all_failed_criteria: string | null;
  url_failures: string | null;
  url_warnings: string | null;
  response_time: number | null;
  message_count: number | null;
  screenshot_path: string | null;
  conversation_path: string | null;
  summary: string | null;
  notes: string | null;
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
      status TEXT,
      score NUMERIC,
      criteria_tested INT,
      criteria_passed INT,
      criteria_failed INT,
      critical_failures INT,
      high_failures INT,
      other_failures INT,
      all_failed_criteria TEXT,
      url_failures TEXT,
      url_warnings TEXT,
      response_time NUMERIC,
      message_count INT,
      screenshot_path TEXT,
      conversation_path TEXT,
      summary TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_eval_runs_run_date ON eval_runs (run_date DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_eval_runs_category ON eval_runs (category);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_eval_runs_status ON eval_runs (status);`;
}

export async function insertResults(results: EvalResult[]) {
  for (const r of results) {
    await sql`
      INSERT INTO eval_runs (
        test_id, name, category, run_date, environment, status, score,
        criteria_tested, criteria_passed, criteria_failed,
        critical_failures, high_failures, other_failures,
        all_failed_criteria, url_failures, url_warnings,
        response_time, message_count, screenshot_path, conversation_path,
        summary, notes
      ) VALUES (
        ${r.test_id}, ${r.name}, ${r.category},
        ${r.date ? new Date(r.date).toISOString() : new Date().toISOString()},
        ${r.environment}, ${r.status}, ${r.score},
        ${r.criteria_tested}, ${r.criteria_passed}, ${r.criteria_failed},
        ${r.critical_failures}, ${r.high_failures}, ${r.other_failures},
        ${r.all_failed_criteria}, ${r.url_failures}, ${r.url_warnings},
        ${r.response_time}, ${r.message_count}, ${r.screenshot_path}, ${r.conversation_path},
        ${r.summary}, ${r.notes}
      );
    `;
  }
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
  const limit = filters.limit ?? 200;
  const { rows } = await sql`
    SELECT * FROM eval_runs
    WHERE
      (${filters.environment ?? null}::text IS NULL OR environment = ${filters.environment ?? null})
      AND (${filters.category ?? null}::text IS NULL OR category = ${filters.category ?? null})
      AND (${filters.status ?? null}::text IS NULL OR status = ${filters.status ?? null})
      AND (${filters.dateFrom ?? null}::timestamptz IS NULL OR run_date >= ${filters.dateFrom ?? null})
      AND (${filters.dateTo ?? null}::timestamptz IS NULL OR run_date <= ${filters.dateTo ?? null})
    ORDER BY run_date DESC
    LIMIT ${limit};
  `;
  return rows;
}
