// ============================================================
// Solar Simulator — /solar-simulator page and /api/simulate
// The bill engine is the Eternalgy Solar Calculator
// (calculator.atap.solar). It is read-only from here: we call its
// public calculation API server-side with logActivity=0 and pass the
// browser bill and energy figures only — never package prices,
// discounts or other sales fields.
// ============================================================
const https = require('https');

const CALC_URL = 'https://calculator.atap.solar/api/solar-calculation';

// Bill-month fuel surcharge (AFA), RM/kWh, as used by the calculator's planner.
const AFA_MONTHS = [
  { value: 0.0361, label: 'Oct 2026', sen: '+3.61' },
  { value: 0.0376, label: 'Sep 2026', sen: '+3.76' },
  { value: 0.0380, label: 'Aug 2026', sen: '+3.80' },
  { value: 0.0359, label: 'Jul 2026', sen: '+3.59' },
  { value: 0.0259, label: 'Jun 2026', sen: '+2.59' },
  { value: 0.0138, label: 'May 2026', sen: '+1.38' },
  { value: -0.0047, label: 'Apr 2026', sen: '−0.47' },
  { value: -0.0215, label: 'Mar 2026', sen: '−2.15' },
  { value: -0.0509, label: 'Feb 2026', sen: '−5.09' },
  { value: -0.0499, label: 'Jan 2026', sen: '−4.99' },
  { value: -0.0642, label: 'Dec 2025', sen: '−6.42' },
  { value: -0.0891, label: 'Nov 2025', sen: '−8.91' },
  { value: -0.0650, label: 'Oct 2025', sen: '−6.50' },
  { value: -0.0110, label: 'Sep 2025', sen: '−1.10' },
  { value: -0.0145, label: 'Aug 2025', sen: '−1.45' },
  { value: 0, label: 'Jul 2025', sen: '0.00' }
];

const cache = new Map();          // key -> { at, body }
const CACHE_MS = 10 * 60 * 1000;
const hits = new Map();           // ip -> [timestamps]
const LIMIT_PER_MIN = 20;

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > LIMIT_PER_MIN;
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000, headers: { Accept: 'application/json' } }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Calculator timed out')));
    req.on('error', reject);
  });
}

const n = (v) => Math.round(Number(v || 0) * 100) / 100;

// Only the figures a visitor needs. Package prices, discounts and payback are left out.
function publicResult(r) {
  const d = r.details || {};
  const sb = r.savingsBreakdown || {};
  const bb = r.billBreakdownComparison || {};
  return {
    systemSizeKwp: n(r.systemSizeKwp),
    panels: r.actualPanels,
    panelWatts: (r.config && r.config.panelType) || 650,
    usageKwh: Number(d.monthlyUsageKwh || 0),
    generationKwh: n(d.monthlySolarGeneration),
    usedOnSiteKwh: n(d.morningUsageKwh),
    exportedKwh: n(d.exportKwh),
    beyondCapKwh: n(Number(d.backupGenerationKwh || 0) + Number(d.donatedKwh || 0)),
    exportRate: Math.round(Number(d.effectiveExportRate || d.exportRate || 0) * 10000) / 10000,
    billBefore: n(bb.totals ? bb.totals.before : d.billBefore),
    billAfterAtNewUsage: n(bb.totals ? bb.totals.after : d.billAfter),
    exportCredit: n(sb.exportCredit),
    youPay: n(sb.payableAfterSolar),
    monthlySaving: n(r.monthlySavings),
    items: (bb.items || []).map(i => ({ key: i.key, label: i.label, before: n(i.before), after: n(i.after) }))
  };
}

module.exports = function registerSolarSimulator(app) {
  app.get('/api/simulate', async (req, res) => {
    const amount = parseFloat(req.query.amount);
    const afa = parseFloat(req.query.afa);
    const phase = req.query.phase === '1' ? 1 : 3;
    const inverter = req.query.inverter === 'hybrid' ? 'hybrid' : 'string';

    if (!(amount >= 50 && amount <= 5000)) {
      return res.status(400).json({ error: 'Enter a monthly bill between RM50 and RM5,000. For larger or commercial bills, request an assessment.' });
    }
    const month = AFA_MONTHS.find(m => Math.abs(m.value - afa) < 1e-6);
    if (!month) return res.status(400).json({ error: 'Choose the month on your bill.' });

    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (rateLimited(ip)) return res.status(429).json({ error: 'Too many simulations in a minute. Try again shortly.' });

    const key = [Math.round(amount * 100), month.value, phase, inverter].join('|');
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_MS) return res.json(cached.body);

    const params = new URLSearchParams({
      amount: String(amount), sunPeakHour: '3.4', morningUsage: '30', panelType: '650',
      smpPrice: '0.2703', afaRate: '0', historicalAfaRate: String(month.value),
      percentDiscount: '0', fixedDiscount: '0', systemPhase: String(phase),
      inverterType: inverter, batterySize: '0', logActivity: '0'
    });

    try {
      const { status, body } = await getJson(`${CALC_URL}?${params}`);
      if (status !== 200) return res.status(502).json({ error: 'The simulator could not calculate this bill. Try another amount.' });
      const out = { input: { amount, month: month.label, afaSen: month.sen, phase, inverter }, result: publicResult(body) };
      cache.set(key, { at: Date.now(), body: out });
      res.json(out);
    } catch (err) {
      console.error('Simulator error:', err.message);
      res.status(502).json({ error: 'The simulator is not reachable right now. Try again in a moment.' });
    }
  });

  app.get('/solar-simulator', (req, res) => {
    res.render('solar-simulator', {
      title: 'Solar Simulator: Your TNB Bill After Solar, Rebuilt from the Tariff | Eternalgy',
      meta_description: 'Enter your TNB bill and see your bill after solar, recalculated line by line from TNB\'s tariff: system size, energy used and exported under ATAP, and your monthly saving.',
      afaMonths: AFA_MONTHS,
      currentTab: 'simulator'
    });
  });
};
