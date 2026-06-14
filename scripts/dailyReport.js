const db = require('../db');

const TZ = 'Asia/Kuala_Lumpur'; // GMT+8

/**
 * Daily visitor reporting, bucketed by GMT+8 calendar day.
 *
 * Reports are pre-computed and persisted into main_site_daily_reports so the
 * web views read fast and "missing" days can be backfilled on deploy. Every
 * aggregation buckets a log into a day using:
 *     (visited_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date
 * which is independent of the server's own timezone.
 */

// ---- Highlight trigger thresholds (predefined) -------------------------------
const TH = {
  SPIKE_RATIO: 1.5,      // total > 1.5x 7-day avg
  DROP_RATIO: 0.5,       // total < 0.5x 7-day avg
  SURGE_RATIO: 2.0,      // ai/seo > 2x own 7-day avg
  SURGE_MIN: 10,         // ...and at least this many hits
  ERROR_RATE: 0.10,      // >10% of hits are 4xx/5xx
  ERROR_MIN_HITS: 20,    // ...with at least this many hits
  SLOW_MS: 1500,         // avg exec time over this is "slow"
  BOT_DOMINATED: 0.70,   // bots > 70% of traffic
  BOT_MIN_HITS: 20,
  LOW_ACTIVITY: 10       // total < 10 hits
};

/**
 * Compute the metrics for a single GMT+8 date (no highlights yet).
 * @param {string} dateStr 'YYYY-MM-DD'
 * @returns {Promise<object>} row-shaped object with column values + data
 */
async function computeDailyReport(dateStr) {
  const dayFilter = `(visited_at AT TIME ZONE '${TZ}')::date = $1`;

  // 1. Top-level counts (one pass)
  const totalsQ = `
    SELECT
      COUNT(*)::int AS total_hits,
      COUNT(DISTINCT ip_address)::int AS unique_ips,
      COALESCE(SUM(CASE WHEN visitor_type = 'human' THEN 1 ELSE 0 END),0)::int AS human_hits,
      COALESCE(SUM(CASE WHEN visitor_type = 'ai_crawler' THEN 1 ELSE 0 END),0)::int AS ai_hits,
      COALESCE(SUM(CASE WHEN visitor_type = 'seo_crawler' THEN 1 ELSE 0 END),0)::int AS seo_hits,
      COALESCE(SUM(CASE WHEN visitor_type = 'other_bot' THEN 1 ELSE 0 END),0)::int AS other_hits,
      COALESCE(SUM(CASE WHEN device_type = 'mobile' THEN 1 ELSE 0 END),0)::int AS mobile_hits,
      COALESCE(SUM(CASE WHEN device_type = 'desktop' THEN 1 ELSE 0 END),0)::int AS desktop_hits,
      COALESCE(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END),0)::int AS error_hits,
      COALESCE(ROUND(AVG(execution_time_ms)),0)::int AS avg_exec_ms
    FROM main_site_visitor_logs
    WHERE ${dayFilter}
  `;

  const topPagesQ = `
    SELECT url,
      COUNT(*)::int AS hits,
      COALESCE(SUM(CASE WHEN visitor_type = 'human' THEN 1 ELSE 0 END),0)::int AS human,
      COALESCE(SUM(CASE WHEN visitor_type = 'ai_crawler' THEN 1 ELSE 0 END),0)::int AS ai,
      COALESCE(SUM(CASE WHEN visitor_type = 'seo_crawler' THEN 1 ELSE 0 END),0)::int AS seo,
      COALESCE(SUM(CASE WHEN visitor_type = 'other_bot' THEN 1 ELSE 0 END),0)::int AS other
    FROM main_site_visitor_logs
    WHERE ${dayFilter}
    GROUP BY url ORDER BY hits DESC LIMIT 10
  `;

  const aiBotsQ = `
    SELECT bot_name, COUNT(*)::int AS count
    FROM main_site_visitor_logs
    WHERE ${dayFilter} AND visitor_type = 'ai_crawler' AND bot_name IS NOT NULL
    GROUP BY bot_name ORDER BY count DESC LIMIT 10
  `;

  const seoBotsQ = `
    SELECT bot_name, COUNT(*)::int AS count
    FROM main_site_visitor_logs
    WHERE ${dayFilter} AND visitor_type = 'seo_crawler' AND bot_name IS NOT NULL
    GROUP BY bot_name ORDER BY count DESC LIMIT 10
  `;

  const referersQ = `
    SELECT referer, COUNT(*)::int AS count
    FROM main_site_visitor_logs
    WHERE ${dayFilter} AND referer IS NOT NULL AND referer <> ''
    GROUP BY referer ORDER BY count DESC LIMIT 10
  `;

  const hourlyQ = `
    SELECT EXTRACT(HOUR FROM (visited_at AT TIME ZONE '${TZ}'))::int AS hr,
           COUNT(*)::int AS c
    FROM main_site_visitor_logs
    WHERE ${dayFilter}
    GROUP BY hr ORDER BY hr
  `;

  const statusCodesQ = `
    SELECT status_code, COUNT(*)::int AS count
    FROM main_site_visitor_logs
    WHERE ${dayFilter}
    GROUP BY status_code
    ORDER BY count DESC, status_code
  `;

  const errorPagesQ = `
    SELECT url, status_code, visitor_type, COUNT(*)::int AS count
    FROM main_site_visitor_logs
    WHERE ${dayFilter} AND status_code >= 400
    GROUP BY url, status_code, visitor_type
    ORDER BY count DESC, url
    LIMIT 25
  `;

  const errorByTypeQ = `
    SELECT visitor_type, status_code, COUNT(*)::int AS count
    FROM main_site_visitor_logs
    WHERE ${dayFilter} AND status_code >= 400
    GROUP BY visitor_type, status_code
    ORDER BY count DESC, visitor_type, status_code
  `;

  const [totals, topPages, aiBots, seoBots, referers, hourly, statusCodes, errorPages, errorByType] = await Promise.all([
    db.pool.query(totalsQ, [dateStr]),
    db.pool.query(topPagesQ, [dateStr]),
    db.pool.query(aiBotsQ, [dateStr]),
    db.pool.query(seoBotsQ, [dateStr]),
    db.pool.query(referersQ, [dateStr]),
    db.pool.query(hourlyQ, [dateStr]),
    db.pool.query(statusCodesQ, [dateStr]),
    db.pool.query(errorPagesQ, [dateStr]),
    db.pool.query(errorByTypeQ, [dateStr])
  ]);

  const t = totals.rows[0];

  // Hourly histogram → 24-slot array; peak hour
  const hourlyArr = new Array(24).fill(0);
  for (const row of hourly.rows) hourlyArr[row.hr] = row.c;
  let peakHour = null;
  if (t.total_hits > 0) {
    peakHour = hourlyArr.indexOf(Math.max(...hourlyArr));
  }

  const weekday = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', timeZone: 'UTC'
  });

  return {
    report_date: dateStr,
    total_hits: t.total_hits,
    unique_ips: t.unique_ips,
    human_hits: t.human_hits,
    ai_hits: t.ai_hits,
    seo_hits: t.seo_hits,
    other_hits: t.other_hits,
    mobile_hits: t.mobile_hits,
    desktop_hits: t.desktop_hits,
    error_hits: t.error_hits,
    avg_exec_ms: t.avg_exec_ms,
    data: {
      weekday,
      topPages: topPages.rows,
      aiBots: aiBots.rows,
      seoBots: seoBots.rows,
      topReferers: referers.rows,
      hourly: hourlyArr,
      peakHour,
      statusCodes: statusCodes.rows,
      errorPages: errorPages.rows,
      errorByType: errorByType.rows
    }
  };
}

/**
 * Evaluate predefined highlight triggers for a report.
 * Pure function (no DB) so it is easy to test.
 * @param {object} report   output of computeDailyReport
 * @param {object} history  { avg7:{total_hits,ai_hits,seo_hits}, priorDays:int,
 *                            allTimeMaxHuman:int, seenBots:Set<string> }
 * @returns {Array<{type,severity,icon,message}>}
 */
function evaluateHighlights(report, history) {
  const out = [];
  const r = report;
  const h = history || {};
  const avg7 = h.avg7 || { total_hits: 0, ai_hits: 0, seo_hits: 0 };
  const hasBaseline = (h.priorDays || 0) >= 2;
  const pct = (n, d) => (d > 0 ? (n / d) * 100 : 0);

  // --- warnings ---
  if (r.total_hits >= TH.ERROR_MIN_HITS && pct(r.error_hits, r.total_hits) / 100 > TH.ERROR_RATE) {
    out.push({ type: 'elevated_errors', severity: 'warning', icon: '⚠️',
      message: `Elevated error rate: ${r.error_hits} of ${r.total_hits} requests (${pct(r.error_hits, r.total_hits).toFixed(1)}%) returned 4xx/5xx.` });
  }
  if (r.avg_exec_ms > TH.SLOW_MS) {
    out.push({ type: 'slow_responses', severity: 'warning', icon: '🐌',
      message: `Slow responses: average ${r.avg_exec_ms} ms.` });
  }
  if (hasBaseline && avg7.total_hits >= 5 && r.total_hits < TH.DROP_RATIO * avg7.total_hits) {
    out.push({ type: 'traffic_drop', severity: 'warning', icon: '📉',
      message: `Traffic drop: ${r.total_hits} hits vs ${avg7.total_hits.toFixed(0)} 7-day average.` });
  }

  // --- positives ---
  if (hasBaseline && avg7.total_hits >= 5 && r.total_hits > TH.SPIKE_RATIO * avg7.total_hits) {
    out.push({ type: 'traffic_spike', severity: 'positive', icon: '📈',
      message: `Traffic spike: ${r.total_hits} hits, ${pctDelta(r.total_hits, avg7.total_hits)} vs 7-day average.` });
  }
  if (r.human_hits > 0 && h.allTimeMaxHuman != null && r.human_hits >= h.allTimeMaxHuman) {
    out.push({ type: 'record_human', severity: 'positive', icon: '🏆',
      message: `Record human traffic: ${r.human_hits} human visits — an all-time daily high.` });
  }
  if (hasBaseline && r.ai_hits >= TH.SURGE_MIN && r.ai_hits > TH.SURGE_RATIO * avg7.ai_hits) {
    out.push({ type: 'ai_surge', severity: 'positive', icon: '🚀',
      message: `AI crawler surge: ${r.ai_hits} LLM-bot hits, well above the 7-day average.` });
  }

  // --- neutral ---
  const newBots = (r.data.aiBots || [])
    .map(b => b.bot_name)
    .filter(name => name && h.seenBots && !h.seenBots.has(name));
  if (newBots.length > 0) {
    out.push({ type: 'new_ai_crawler', severity: 'neutral', icon: '🤖',
      message: `New AI crawler${newBots.length > 1 ? 's' : ''} seen for the first time: ${newBots.join(', ')}.` });
  }
  if (hasBaseline && r.seo_hits >= TH.SURGE_MIN && r.seo_hits > TH.SURGE_RATIO * avg7.seo_hits) {
    out.push({ type: 'seo_surge', severity: 'neutral', icon: '🔍',
      message: `Search-engine indexing surge: ${r.seo_hits} SEO-crawler hits.` });
  }
  const botHits = r.ai_hits + r.seo_hits + r.other_hits;
  if (r.total_hits >= TH.BOT_MIN_HITS && pct(botHits, r.total_hits) / 100 > TH.BOT_DOMINATED) {
    out.push({ type: 'bot_dominated', severity: 'neutral', icon: '🤖',
      message: `Bot-dominated day: ${pct(botHits, r.total_hits).toFixed(0)}% of traffic was automated.` });
  }
  if (r.total_hits < TH.LOW_ACTIVITY) {
    out.push({ type: 'low_activity', severity: 'neutral', icon: '🔌',
      message: r.total_hits === 0 ? 'No visitor traffic recorded on this day.' : `Low activity: only ${r.total_hits} hits recorded.` });
  }

  return out;
}

function pctDelta(value, base) {
  if (!base) return 'n/a';
  const d = ((value - base) / base) * 100;
  return (d >= 0 ? '+' : '') + d.toFixed(0) + '%';
}

/**
 * Generate and persist any missing daily reports from the first logged GMT+8
 * day up to (but not including) today. Idempotent — existing dates are skipped.
 * @returns {Promise<{generated:number, dates:string[]}>}
 */
async function generateMissingReports() {
  // Earliest logged day and today, both in GMT+8.
  const boundsQ = `
    SELECT
      MIN((visited_at AT TIME ZONE '${TZ}')::date)::text AS first_date,
      (now() AT TIME ZONE '${TZ}')::date::text AS today
    FROM main_site_visitor_logs
  `;
  const bounds = (await db.pool.query(boundsQ)).rows[0];
  if (!bounds || !bounds.first_date) return { generated: 0, dates: [] };

  const firstDate = bounds.first_date;
  const today = bounds.today;

  // Dates already stored.
  const existing = new Set(
    (await db.pool.query(`SELECT report_date::text AS d FROM main_site_daily_reports`)).rows.map(r => r.d)
  );

  // All-time max human hits and the set of AI bots ever seen (for highlight context).
  const maxHumanQ = `SELECT COALESCE(MAX(c),0)::int AS m FROM (
      SELECT COUNT(*) AS c FROM main_site_visitor_logs
      WHERE visitor_type='human'
      GROUP BY (visited_at AT TIME ZONE '${TZ}')::date) s`;
  let allTimeMaxHuman = 0;
  try { allTimeMaxHuman = (await db.pool.query(maxHumanQ)).rows[0].m; } catch (_) {}

  const seenBots = new Set();

  const generated = [];
  // Iterate ascending so each day's history reflects prior days.
  let cur = firstDate;
  const recent = []; // rolling list of {report} for the last 7 generated/considered days

  while (cur < today) {
    if (!existing.has(cur)) {
      try {
        const report = await computeDailyReport(cur);

        // Build trailing 7-day averages from the recent window.
        const window = recent.slice(-7);
        const priorDays = window.length;
        const sum = window.reduce((a, w) => ({
          total: a.total + w.total_hits,
          ai: a.ai + w.ai_hits,
          seo: a.seo + w.seo_hits
        }), { total: 0, ai: 0, seo: 0 });
        const avg7 = priorDays > 0
          ? { total_hits: sum.total / priorDays, ai_hits: sum.ai / priorDays, seo_hits: sum.seo / priorDays }
          : { total_hits: 0, ai_hits: 0, seo_hits: 0 };

        report.highlights = evaluateHighlights(report, {
          avg7, priorDays, allTimeMaxHuman, seenBots
        });

        await db.pool.query(
          `INSERT INTO main_site_daily_reports
             (report_date, total_hits, unique_ips, human_hits, ai_hits, seo_hits, other_hits,
              mobile_hits, desktop_hits, error_hits, avg_exec_ms, data, highlights)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (report_date) DO NOTHING`,
          [report.report_date, report.total_hits, report.unique_ips, report.human_hits,
           report.ai_hits, report.seo_hits, report.other_hits, report.mobile_hits,
           report.desktop_hits, report.error_hits, report.avg_exec_ms,
           JSON.stringify(report.data), JSON.stringify(report.highlights)]
        );

        // Update rolling context.
        recent.push(report);
        if (report.human_hits > allTimeMaxHuman) allTimeMaxHuman = report.human_hits;
        for (const b of report.data.aiBots || []) if (b.bot_name) seenBots.add(b.bot_name);
        generated.push(cur);
      } catch (err) {
        console.error(`Daily report generation failed for ${cur}:`, err.message);
        // Leave the date unstored; it will be retried next run.
      }
    } else {
      // Already stored — still load it into the rolling window for averages/seen-bots.
      try {
        const rowRes = await db.pool.query(
          `SELECT total_hits, ai_hits, seo_hits, human_hits, data
           FROM main_site_daily_reports WHERE report_date = $1`, [cur]);
        if (rowRes.rows[0]) {
          const row = rowRes.rows[0];
          recent.push({ total_hits: row.total_hits, ai_hits: row.ai_hits, seo_hits: row.seo_hits });
          for (const b of (row.data && row.data.aiBots) || []) if (b.bot_name) seenBots.add(b.bot_name);
        }
      } catch (_) {}
    }
    cur = nextDate(cur);
  }

  if (generated.length > 0) {
    console.log(`Daily reports: generated ${generated.length} report(s) (${generated[0]}..${generated[generated.length - 1]}).`);
  }
  return { generated: generated.length, dates: generated };
}

/** Add one day to a 'YYYY-MM-DD' string (UTC-safe, no TZ drift). */
function nextDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

module.exports = {
  TZ,
  computeDailyReport,
  evaluateHighlights,
  generateMissingReports,
  nextDate
};
