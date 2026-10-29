/*
 * Eternalgy – Solar Ads Landing Page: single place for everything you may need to edit.
 * Loaded before main.js on every page. Leave a value as '' to disable that feature.
 */
window.EG_CONFIG = {
  // --- Contact -------------------------------------------------------------
  whatsapp: '601121000099',          // digits only, country code first (wa.me format)
  phoneDisplay: '+60 11-2100 0099',
  phoneTel: '+601121000099',

  // --- Lead delivery ---------------------------------------------------------
  // POST endpoint that receives each lead as JSON (see docs/README.md for a free
  // Google Sheets + email setup). If empty, or if the request fails, the form
  // falls back to opening WhatsApp with the lead details pre-filled, so a lead is
  // never silently lost.
  leadEndpoint: '',

  // --- Google Ads / Google tag ---------------------------------------------------
  gtagId: '',                        // e.g. 'AW-1234567890'
  conversions: {                     // full send_to values: 'AW-1234567890/AbCdEfGhIjKl'
    lead: '',                        // fires once on thank-you.html (primary conversion)
    whatsapp: '',                    // fires on every WhatsApp click (secondary conversion)
    call: ''                         // fires on every tel: click (secondary conversion)
  },

  // --- SuRIA Home rebate window (shown only until the deadline) ------------------
  rebate: {
    deadline: '2026-12-31',          // YYYY-MM-DD, end of day Malaysia time
    ratePerKwac: 600,
    cap: 3000
  },

  // --- Calculator assumptions (every value is disclosed on the page) -------------
  model: {
    yieldKwhPerKwp: 1250,            // Kuala Lumpur modelling study: ~1,248 kWh/kWp/yr
    valuePerKwh: 0.40,               // blended RM per kWh (self-use ~RM0.45+, exports lower)
    budget: { firstYear: 0.020, annual: 0.0055 },        // typical entry-level 25-yr warranty -> 84.8% at yr 25
    engineered: { firstYear: 0.010, annual: 0.0035 },    // Jinko Tiger Neo 3.0: 1% yr-1, 0.35%/yr
    inverterRmPerKwp: 450,           // ~RM3,600 for 8 kWp; typical string inverter swap RM3,000–5,000
    inverterSwaps: { budgetExtra: [8, 16], budgetSingle: [9], engineered: [13] }
  }
};
