# Daily Visitor Report (GMT+8) — Design

Date: 2026-06-15
Status: Approved (pending spec review)

## Goal

Generate a **per-day visitor summary report** for the Eternalgy main site, bucketed by
**Asia/Kuala_Lumpur (GMT+8) calendar day** (00:00:00–23:59:59). Reports are persisted,
backfilled for every missing date since logging began, and readable through a web page
with one report per day plus rule-based highlights.

## Context

- Data source: `main_site_visitor_logs` (Postgres). `visited_at` is `TIMESTAMP WITH TIME ZONE`.
  Columns: `ip_address, user_agent, url, referer, method, status_code, device_type,
  visitor_type (human|ai_crawler|seo_crawler|other_bot), bot_name, execution_time_ms`.
- Existing live dashboard: `GET /visitor-analysis` (rolling windows `NOW() - INTERVAL`,
  renders `visitor-analysis.ejs`). It is **not** day-boundaried — this feature is separate.
- Deploy model: Railway runs `node server.js`. `db.initDb()` runs idempotently on startup
  (`server.js:30`). `app.listen` at `server.js:2171`.
- Views are split desktop/mobile; `res.render` is wrapped to prefix `mobile/` or `desktop/`
  (`server.js:44`). Analytics pages use `currentTab: 'analytics'`.

## Day boundary & timezone

All day bucketing uses:

```sql
(visited_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date
```

Since `visited_at` is `timestamptz`, `AT TIME ZONE 'Asia/Kuala_Lumpur'` yields the local
wall-clock timestamp; casting to `::date` gives the GMT+8 calendar day. No dependency on the
server's own timezone.

"Today" in GMT+8 is `(now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date`. Only **complete** days
(`report_date < today_gmt8`) are generated/stored. The in-progress day is never frozen.

## Data model — new table `main_site_daily_reports`

Created in `db.initDb()` (idempotent `CREATE TABLE IF NOT EXISTS`, same transaction pattern
as existing tables).

```sql
CREATE TABLE IF NOT EXISTS main_site_daily_reports (
  report_date   DATE PRIMARY KEY,
  total_hits    INTEGER NOT NULL DEFAULT 0,
  unique_ips    INTEGER NOT NULL DEFAULT 0,
  human_hits    INTEGER NOT NULL DEFAULT 0,
  ai_hits       INTEGER NOT NULL DEFAULT 0,
  seo_hits      INTEGER NOT NULL DEFAULT 0,
  other_hits    INTEGER NOT NULL DEFAULT 0,
  mobile_hits   INTEGER NOT NULL DEFAULT 0,
  desktop_hits  INTEGER NOT NULL DEFAULT 0,
  error_hits    INTEGER NOT NULL DEFAULT 0,
  avg_exec_ms   INTEGER NOT NULL DEFAULT 0,
  data          JSONB   NOT NULL DEFAULT '{}'::jsonb,
  highlights    JSONB   NOT NULL DEFAULT '[]'::jsonb,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON main_site_daily_reports(report_date DESC);
```

Top-level INT columns power the fast list view. `data` JSONB holds detail:

```jsonc
{
  "weekday": "Monday",
  "topPages":   [{ "url": "/", "hits": 120, "human": 80, "ai": 20, "seo": 18, "other": 2 }],
  "aiBots":     [{ "bot_name": "GPTBot", "count": 30 }],
  "seoBots":    [{ "bot_name": "Googlebot", "count": 44 }],
  "topReferers":[{ "referer": "https://google.com", "count": 12 }],
  "hourly":     [ /* 24 ints, index = GMT+8 hour 0..23, total hits */ ],
  "peakHour":   14,
  "prevDay":    { "total_hits": 100, "human_hits": 70 },   // for deltas; null if none
  "avg7":       { "total_hits": 95.2, "ai_hits": 18.1, "seo_hits": 40.0, "human_hits": 60.5 }
}
```

`highlights` JSONB is an array of `{ type, severity, icon, message }` where
`severity ∈ {positive, warning, neutral}`.

## Module — `scripts/dailyReport.js`

Pure-SQL, no external API. Exports:

### `computeDailyReport(dateStr) → reportObject`
Runs aggregations for one GMT+8 date (`dateStr = 'YYYY-MM-DD'`). One combined query for
the top-level counts + device + error + avg exec; separate small queries for top pages,
AI bots, SEO bots, top referers, hourly histogram. Returns the column values + `data`
(without highlights yet). Uses parameterized queries (`$1 = dateStr`).

Filter pattern for every query:
```sql
WHERE (visited_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date = $1
```

Hourly histogram:
```sql
SELECT EXTRACT(HOUR FROM (visited_at AT TIME ZONE 'Asia/Kuala_Lumpur'))::int AS hr,
       COUNT(*)::int AS c
FROM main_site_visitor_logs
WHERE (visited_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date = $1
GROUP BY hr ORDER BY hr;
```
Mapped into a 24-slot array; `peakHour` = argmax (null if no hits).

### `evaluateHighlights(report, history) → highlights[]`
`history` provides: trailing 7-day averages (from prior stored reports or computed),
all-time max human hits, and the set of bot_names seen on any prior day. Applies the
trigger table below. Order: warnings, then positives, then neutral.

### `generateMissingReports() → { generated: number, dates: string[] }`
1. `firstDate = MIN((visited_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date)` from logs.
   If no logs, return `{ generated: 0 }`.
2. `today = (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date`.
3. Existing dates = `SELECT report_date FROM main_site_daily_reports`.
4. For each date from `firstDate` to `today - 1 day` inclusive that is **not** already stored:
   - `report = computeDailyReport(date)`
   - build `history` (prev day + trailing 7-day avg from stored reports and/or just-computed
     in-loop cache; all-time human max and seen-bot set queried from raw logs once, updated
     in loop)
   - `report.highlights = evaluateHighlights(report, history)`
   - `INSERT ... ON CONFLICT (report_date) DO NOTHING`
   - Zero-hit days are still inserted (row with zeros + `🔌 Low activity` highlight).
5. Process dates in **ascending** order so each day's history sees prior days.
6. Idempotent and safe to run repeatedly / concurrently (`ON CONFLICT DO NOTHING`).

Performance: backfill is bounded by number of days (small). Each day = a handful of indexed
aggregations. Acceptable for startup. Runs non-blocking (does not delay `app.listen`).

## Highlight triggers (rule-based)

| type            | icon | condition                                            | severity |
|-----------------|------|------------------------------------------------------|----------|
| traffic_spike   | 📈   | total_hits > 1.5 × avg7.total_hits (avg7 ≥ 5)        | positive |
| traffic_drop    | 📉   | total_hits < 0.5 × avg7.total_hits (avg7 ≥ 5)        | warning  |
| record_human    | 🏆   | human_hits > 0 and human_hits = all-time max          | positive |
| new_ai_crawler  | 🤖   | a bot_name (ai_crawler) not seen on any prior day     | neutral  |
| ai_surge        | 🚀   | ai_hits > 2 × avg7.ai_hits and ai_hits ≥ 10           | positive |
| seo_surge       | 🔍   | seo_hits > 2 × avg7.seo_hits and seo_hits ≥ 10        | neutral  |
| elevated_errors | ⚠️   | error_hits / total_hits > 0.10 and total_hits ≥ 20    | warning  |
| slow_responses  | 🐌   | avg_exec_ms > 1500                                    | warning  |
| bot_dominated   | 🤖   | (ai+seo+other) / total_hits > 0.70 and total_hits ≥ 20| neutral  |
| low_activity    | 🔌   | total_hits < 10                                       | neutral  |

`avg7` = mean over the up-to-7 complete days immediately preceding `report_date`. When fewer
than 2 prior days exist, spike/drop/surge triggers are skipped (insufficient baseline).
`new_ai_crawler` message lists the bot name(s).

## Backfill / scheduling triggers

- **On startup** (`server.js`, after `initDb()` resolves): call `generateMissingReports()`
  in a `.catch`-guarded async block. Failure is logged, never crashes startup, never blocks
  `app.listen`.
- **Hourly interval**: `setInterval(generateMissingReports, 60*60*1000)` (also guarded).
  Ensures yesterday's report appears the next GMT+8 day without a redeploy. `unref()` the
  timer is not needed (server is long-lived); errors are caught.

## Web UI

### Routes (in `server.js`)
- `GET /visitor-analysis/daily` — list view. Selects top-level columns + `highlights` for all
  rows, newest first. Renders `visitor-daily-list`. `?format=json` returns the rows.
- `GET /visitor-analysis/daily/:date` — detail view. Validates `:date` as `YYYY-MM-DD`; loads
  the one row; 404 if absent. Renders `visitor-daily`. `?format=json` returns the row.
- Register **before** the catch-all dynamic route (`app.get('/:slug')`, `server.js:2053`).
  That catch-all only matches single-segment paths, so the two-segment `/visitor-analysis/daily`
  paths are not shadowed regardless; registering earlier is for clarity/consistency. No change
  to the `systemRoutes` reserved list is needed.

### Views (desktop + mobile)
- `visitor-daily-list.ejs`: table/cards of days — date, weekday, total hits, mini stacked bar
  (human/ai/seo/other), highlight icons, link to detail. Newest first.
- `visitor-daily.ejs`: single-day report — headline totals with deltas vs prev day & 7-day
  avg, visitor mix, device split, AI/SEO bot tables, top pages, top referers, hourly bar,
  peak hour, health (error rate, avg response), and highlight chips colored by severity.
- Styled consistently with existing `visitor-analysis.ejs`; `currentTab: 'analytics'`; link
  from the existing dashboard to the daily list and back.

## Error handling

- All DB calls wrapped; route handlers return 500 with logged error (matches existing style).
- `generateMissingReports` swallows per-day errors? No — a failing day logs and continues to
  the next date so one bad day cannot block the rest; the failed date stays unstored and will
  be retried on the next run.
- Detail route 404s unknown/badly-formatted dates.

## Testing

- `scripts/dailyReport.test.js` style or a runnable check script (project has no test runner;
  `package.json` test is a stub). Provide a standalone `scripts/verifyDailyReport.js` that:
  - seeds a temp set of known logs (or runs against existing data for a known date),
  - asserts GMT+8 bucketing (a log at 2026-06-14 23:30 UTC = 2026-06-15 07:30 GMT+8 lands on
    the 15th),
  - asserts highlight triggers fire on crafted inputs (`evaluateHighlights` is pure and unit-
    testable without DB),
  - asserts idempotency (running `generateMissingReports` twice inserts no duplicates).
- Manual: hit `/visitor-analysis/daily` and a `/:date` page after backfill.

## Out of scope (YAGNI)

- No AI-generated prose (rule-based only).
- No Markdown export.
- No email/notification delivery.
- No regeneration UI for already-stored days (re-trigger logic can be added later; rows are
  immutable once written via `ON CONFLICT DO NOTHING`).

## Files touched

- `db.js` — add `main_site_daily_reports` table + index in `initDb`.
- `scripts/dailyReport.js` — new module (compute, highlights, backfill).
- `server.js` — call backfill on startup + interval; add two routes; cross-link from dashboard.
- `views/desktop/visitor-daily-list.ejs`, `views/mobile/visitor-daily-list.ejs` — new.
- `views/desktop/visitor-daily.ejs`, `views/mobile/visitor-daily.ejs` — new.
- `scripts/verifyDailyReport.js` — new verification script.
