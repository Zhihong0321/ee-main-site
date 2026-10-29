/* Eternalgy – Solar Ads Landing Page behaviour. Vanilla JS, no dependencies. */
(function () {
  'use strict';

  var CFG = window.EG_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var isLocal = /^(localhost|127\.|\[::1\])/.test(location.hostname) || location.protocol === 'file:';
  var nf = new Intl.NumberFormat('en-MY', { maximumFractionDigits: 0 });
  var rm = function (n) { return 'RM' + nf.format(Math.round(n)); };
  var svgNS = 'http://www.w3.org/2000/svg';
  // translations: a page may load a dictionary (window.EG_T, keyed by the English text) before this file
  var T = window.EG_T || {};
  var tr = function (s, v) { var r = T[s] || s; if (v) for (var k in v) r = r.split('{' + k + '}').join(v[k]); return r; };

  /* ------------------------------------------------------------------ */
  /* Google tag + event tracking                                         */
  /* ------------------------------------------------------------------ */
  function loadGtag(id) {
    if (!id) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
    window.gtag('js', new Date());
    window.gtag('config', id);
  }
  function track(name, params) {
    if (window.gtag) window.gtag('event', name, params || {});
    if (isLocal) console.debug('[track]', name, params || {});
  }
  function conversion(kind, extra) {
    var sendTo = CFG.conversions && CFG.conversions[kind];
    if (window.gtag && sendTo) window.gtag('event', 'conversion', Object.assign({ send_to: sendTo }, extra || {}));
    if (isLocal) console.debug('[conversion]', kind, sendTo || '(no label configured)');
  }
  loadGtag(CFG.gtagId);

  /* ------------------------------------------------------------------ */
  /* Attribution: capture gclid / UTM once and keep it for the session    */
  /* ------------------------------------------------------------------ */
  var ATTR_KEYS = ['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'matchtype', 'device', 'v'];
  function attribution() {
    var stored = {};
    try { stored = JSON.parse(sessionStorage.getItem('eg_attr') || '{}'); } catch (e) { /* private mode */ }
    var q = new URLSearchParams(location.search);
    var changed = false;
    ATTR_KEYS.forEach(function (k) {
      if (q.get(k)) { stored[k] = q.get(k); changed = true; }
    });
    if (!stored.landing) { stored.landing = location.pathname; stored.referrer = document.referrer || ''; changed = true; }
    if (changed) { try { sessionStorage.setItem('eg_attr', JSON.stringify(stored)); } catch (e) { /* ignore */ } }
    return stored;
  }
  var ATTR = attribution();
  if (ATTR.v === 'quote') $$('input[name="has_quote"]').forEach(function (input) { input.checked = true; });

  /* ------------------------------------------------------------------ */
  /* WhatsApp + phone links                                              */
  /* ------------------------------------------------------------------ */
  var calcState = { kwp: 8, gap: 3000 };
  function waMessage(ctx) {
    switch (ctx) {
      case 'calc':
        return tr('Hi Eternalgy, I’m comparing solar quotes for a {kwp} kWp home system. The upfront price difference is {gap}. Can you help me review the equipment, installation scope, warranties and savings assumptions?', { kwp: calcState.kwp, gap: rm(calcState.gap) });
      case 'review':
      case 'faq':
        return tr('Hi Eternalgy, I already have a solar quote and would like a free second opinion. I’ll send it here.');
      default:
        return tr('Hi Eternalgy, I’d like a free solar assessment for my home.');
    }
  }
  function waUrl(msg) { return 'https://wa.me/' + (CFG.whatsapp || '601121000099') + '?text=' + encodeURIComponent(msg); }
  $$('[data-wa]').forEach(function (a) {
    var ctx = a.getAttribute('data-wa');
    a.href = waUrl(waMessage(ctx));
    a.addEventListener('click', function () {
      if (ctx === 'calc') a.href = waUrl(waMessage('calc')); // refresh with latest slider values
      track('whatsapp_click', { location: ctx });
      conversion('whatsapp');
    });
  });
  $$('[data-call]').forEach(function (a) {
    a.addEventListener('click', function () { track('call_click'); conversion('call'); });
  });
  $$('[data-track]').forEach(function (a) {
    a.addEventListener('click', function () { track(a.getAttribute('data-track')); });
  });
  $$('[data-year]').forEach(function (s) { s.textContent = new Date().getFullYear(); });

  /* ------------------------------------------------------------------ */
  /* Reveal on scroll                                                    */
  /* ------------------------------------------------------------------ */
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    $$('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    $$('.reveal').forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ------------------------------------------------------------------ */
  /* SuRIA Home countdown (hidden automatically after the deadline)      */
  /* ------------------------------------------------------------------ */
  (function () {
    if (!CFG.rebate) return;
    var end = new Date(CFG.rebate.deadline + 'T23:59:59+08:00').getTime();
    var days = Math.ceil((end - Date.now()) / 86400000);
    if (days <= 0) { document.body.classList.add('rebate-ended'); return; }
    var d = $('[data-days]'), l = $('[data-days-label]');
    if (d) d.textContent = days;
    if (l) l.textContent = tr(days === 1 ? 'day left to commission' : 'days left to commission');
  })();
  var rebateActive = !document.body.classList.contains('rebate-ended');

  /* ------------------------------------------------------------------ */
  /* Sticky mobile CTA: show once the forms are out of view              */
  /* ------------------------------------------------------------------ */
  (function () {
    var bar = $('[data-sticky]');
    var forms = $$('.formcard');
    if (!bar || !forms.length || !('IntersectionObserver' in window)) return;
    var visible = new Set();
    var scrolled = false;
    function update() { bar.classList.toggle('is-on', scrolled && visible.size === 0); }
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); });
      update();
    }, { threshold: 0.1 });
    forms.forEach(function (f) { so.observe(f); });
    window.addEventListener('scroll', function () { var s = window.scrollY > 420; if (s !== scrolled) { scrolled = s; update(); } }, { passive: true });
  })();

  /* ------------------------------------------------------------------ */
  /* Lead form                                                           */
  /* ------------------------------------------------------------------ */
  function normPhone(raw) {
    var d = String(raw || '').replace(/[^\d]/g, '');
    if (d.indexOf('00') === 0) d = d.slice(2);
    if (d.charAt(0) === '0') d = '6' + d;
    else if (d.indexOf('60') !== 0) d = '60' + d;
    return d;
  }
  var phoneOk = function (d) { return /^601\d{8,9}$/.test(d); };

  function setInvalid(node, on) { if (node) node.classList.toggle('is-invalid', !!on); }
  function val(form, name) { var el = form.elements[name]; if (!el) return ''; if (el instanceof RadioNodeList) return el.value || ''; return (el.type === 'checkbox') ? (el.checked ? el.value : '') : el.value.trim(); }

  function initForm(form) {
    var step1 = $('[data-step="1"]', form), step2 = $('[data-step="2"]', form);
    var card = form.closest('.formcard');
    var label = card && $('[data-step-label]', card), bar = card && $('[data-progress]', card);
    var statusEl = $('[data-status]', form), submit = $('[data-submit]', form);
    var started = false;

    form.addEventListener('focusin', function () { if (!started) { started = true; track('form_start', { source: form.dataset.source }); } });

    if (step1) {
      $$('input[type=radio]', form).forEach(function (r) {
        r.addEventListener('change', function () {
          setInvalid(r.closest('.fieldset'), false);
          var bill = val(form, 'bill'), prop = val(form, 'property');
          var low = $('[data-hint="low-bill"]', form), condo = $('[data-hint="condo"]', form);
          if (low) low.classList.toggle('is-on', bill === 'Below RM300');
          if (condo) condo.classList.toggle('is-on', prop === 'Condo / apartment');
        });
      });
      $('[data-next]', form).addEventListener('click', function () {
        var okBill = !!val(form, 'bill'), okProp = !!val(form, 'property');
        setInvalid($('[data-group="bill"]', form), !okBill);
        setInvalid($('[data-group="property"]', form), !okProp);
        if (!okBill || !okProp) return;
        step1.hidden = true; step2.hidden = false;
        if (label) label.textContent = tr('Step 2 of 2');
        if (bar) bar.style.width = '100%';
        var first = $('input[name="name"]', form); if (first) first.focus({ preventScroll: true });
        track('form_step1_complete', { bill: val(form, 'bill'), property: val(form, 'property') });
      });
      $('[data-back]', form).addEventListener('click', function () {
        step2.hidden = true; step1.hidden = false;
        if (label) label.textContent = tr('Step 1 of 2');
        if (bar) bar.style.width = '50%';
      });
    }

    $$('input[type=text], input[type=tel], select', form).forEach(function (el) {
      el.addEventListener('input', function () { setInvalid(el.closest('.field'), false); });
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if ($('input[name="website"]', form).value) return; // honeypot
      var name = val(form, 'name'), phone = normPhone(val(form, 'phone')), state = val(form, 'state');
      var bill = val(form, 'bill'), consent = !!val(form, 'consent');
      var bad = false;
      var nameField = $('input[name="name"]', form).closest('.field');
      var phoneField = $('input[name="phone"]', form).closest('.field');
      var stateField = $('select[name="state"]', form).closest('.field');
      setInvalid(nameField, name.length < 2); bad = bad || name.length < 2;
      setInvalid(phoneField, !phoneOk(phone)); bad = bad || !phoneOk(phone);
      setInvalid(stateField, !state); bad = bad || !state;
      var billSel = form.elements.bill && form.elements.bill.tagName === 'SELECT' ? form.elements.bill : null;
      if (billSel) { setInvalid(billSel.closest('.field'), !bill); bad = bad || !bill; }
      var cErr = $('[data-consent-err]', form);
      if (cErr) cErr.style.display = consent ? 'none' : 'block';
      bad = bad || !consent;
      if (bad) { var firstBad = $('.is-invalid input, .is-invalid select', form); if (firstBad) firstBad.focus(); statusEl.textContent = ''; return; }

      var payload = Object.assign({
        timestamp: new Date().toISOString(),
        source: form.dataset.source || 'form',
        name: name,
        phone: '+' + phone,
        bill: bill,
        property: val(form, 'property') || 'Not specified',
        state: state,
        has_quote: val(form, 'has_quote') === 'yes' ? 'yes' : 'no',
        consent_pdpa: 'yes',
        page: location.origin + location.pathname,
        language: navigator.language || '',
        viewport: window.innerWidth + 'x' + window.innerHeight,
        user_agent: navigator.userAgent
      }, ATTR);

      var remember = function (delivery) {
        var msg = tr('Hi Eternalgy, I’m {name}. I’d like a free solar assessment.', { name: name }) + '\n' +
          tr('• Monthly TNB bill: ') + bill + '\n' +
          (payload.property !== 'Not specified' ? tr('• Property: ') + payload.property + '\n' : '') +
          tr('• Location: ') + state + '\n' +
          (payload.has_quote === 'yes' ? tr('• I already have a quote to compare.') + '\n' : '');
        try {
          sessionStorage.setItem('eg_lead', JSON.stringify({ first: name.split(/\s+/)[0], wa: waUrl(msg), delivery: delivery, source: payload.source, bill: bill }));
          sessionStorage.removeItem('eg_conv');
        } catch (e) { /* ignore */ }
      };
      var done = function (delivery) {
        remember(delivery);
        track('lead_submitted', { source: payload.source, delivery: delivery });
        location.href = 'thank-you.html';
      };

      submit.disabled = true; statusEl.textContent = '';
      submit.textContent = tr('Sending…');

      if (!CFG.leadEndpoint) { done('whatsapp'); return; }
      // no-cors: we can't read the response, but a network failure or timeout still rejects.
      // In that case never lose the lead - hand over to WhatsApp instead.
      var ctrl = 'AbortController' in window ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
      fetch(CFG.leadEndpoint, {
        method: 'POST', mode: 'no-cors', keepalive: true, signal: ctrl ? ctrl.signal : undefined,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).then(function () { clearTimeout(timer); done('endpoint'); })
        .catch(function () { clearTimeout(timer); done('whatsapp'); });
    });
  }
  $$('[data-lead-form]').forEach(initForm);

  /* ------------------------------------------------------------------ */
  /* 25-year model (pure function – also exposed as EG.runModel)         */
  /* ------------------------------------------------------------------ */
  function runModel(input, cfg) {
    var m = cfg.model, YEARS = 25;
    var kwp = input.kwp, gap = input.gap;
    var kwh = kwp * m.yieldKwhPerKwp, value = m.valuePerKwh;
    var out = function (p, t) { return 1 - p.firstYear - p.annual * (t - 1); };
    var swapCost = m.inverterRmPerKwp * kwp;
    var budgetSwaps = input.extraSwap ? m.inverterSwaps.budgetExtra : m.inverterSwaps.budgetSingle;
    var engSwaps = m.inverterSwaps.engineered;
    var kwac = kwp / (m.dcAcRatio || 1.15);
    var reb = cfg.rebate || { ratePerKwac: 600, cap: 3000 };
    var rebateAmt = input.unreg ? Math.min(reb.cap, reb.ratePerKwac * Math.min(kwac, 5)) : 0;

    var net = [-gap + rebateAmt], degr = 0, inv = 0;
    for (var t = 1; t <= YEARS; t++) {
      var d = kwh * (out(m.engineered, t) - out(m.budget, t)) * value;
      var s = (budgetSwaps.indexOf(t) > -1 ? swapCost : 0) - (engSwaps.indexOf(t) > -1 ? swapCost : 0);
      degr += d; inv += s;
      net.push(net[t - 1] + d + s);
    }
    var be = null;
    for (var i = YEARS; i >= 0; i--) { if (net[i] >= 0) be = i; else break; }
    return {
      net: net, final: net[YEARS], be: be,
      upfront: -gap, degr: degr, inv: inv, rebate: rebateAmt,
      outEng: out(m.engineered, YEARS), outBud: out(m.budget, YEARS),
      budgetSwaps: budgetSwaps, engSwaps: engSwaps, swapCost: swapCost
    };
  }
  window.EG = { runModel: runModel, track: track };

  /* ------------------------------------------------------------------ */
  /* Chart helpers                                                       */
  /* ------------------------------------------------------------------ */
  function niceStep(raw) {
    var p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  function fmtK(v) {
    if (v === 0) return 'RM0';
    var a = Math.abs(v), s = v < 0 ? '−' : '';
    return s + 'RM' + (a >= 1000 ? (Math.round(a / 100) / 10) + 'k' : Math.round(a));
  }
  function path(pts) { return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' L'); }
  function chartSize(el, ratio) {
    var w = Math.max(280, Math.round(el.clientWidth || 600));
    return { W: w, H: Math.round(w * (w < 480 ? ratio * 1.5 : ratio)) };
  }

  /* --- Calculator ---------------------------------------------------- */
  function initCalc() {
    var root = $('[data-calc]'); if (!root || !CFG.model) return;
    var kwpIn = $('#c-kwp'), gapIn = $('#c-gap'), swapIn = $('#c-swap'), unregIn = $('#c-unreg');
    var chartEl = $('[data-calc-chart]', root);
    var oNet = $('[data-out="net"]', root), oSentence = $('[data-out="sentence"]', root), oBe = $('[data-out="be"]', root), oBreak = $('[data-out="break"]', root);
    var used = false, last = null;

    function fill(input) { var p = (input.value - input.min) / (input.max - input.min) * 100; input.style.setProperty('--fill', p + '%'); }

    function renderChart(res) {
      var sz = chartSize(chartEl, 0.52), W = sz.W, H = sz.H, L = 54, R = 14, T = 16, B = 30, iw = W - L - R, ih = H - T - B;
      var lo = Math.min.apply(null, res.net.concat(0)), hi = Math.max.apply(null, res.net.concat(0));
      var pad = (hi - lo || 1) * 0.1; lo -= pad; hi += pad;
      var x = function (t) { return L + iw * t / 25; }, y = function (v) { return T + ih * (hi - v) / (hi - lo); };
      var step = niceStep((hi - lo) / 5), g = '';
      for (var v = Math.ceil(lo / step) * step; v <= hi + 1e-6; v += step) {
        g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/><text x="' + (L - 8) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + fmtK(Math.round(v)) + '</text>';
      }
      [0, 5, 10, 15, 20, 25].forEach(function (t) { g += '<text x="' + x(t).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + (t === 0 ? tr('Yr 0') : t) + '</text>'; });
      var pts = res.net.map(function (v, t) { return [x(t), y(v)]; }), line = path(pts);
      var zy = y(0), area = line + ' L' + x(25).toFixed(1) + ',' + zy.toFixed(1) + ' L' + x(0).toFixed(1) + ',' + zy.toFixed(1) + ' Z';
      var dots = '';
      res.budgetSwaps.forEach(function (t) { dots += '<circle class="dot-leak" cx="' + x(t).toFixed(1) + '" cy="' + y(res.net[t]).toFixed(1) + '" r="5"><title>' + tr('Year {n}: alternative example inverter replaced', { n: t }) + '</title></circle>'; });
      res.engSwaps.forEach(function (t) { dots += '<circle class="dot-good" cx="' + x(t).toFixed(1) + '" cy="' + y(res.net[t]).toFixed(1) + '" r="5"><title>' + tr('Year {n}: Jinko Tiger Neo 3.0 example inverter replaced', { n: t }) + '</title></circle>'; });
      var beMark = '';
      if (res.be !== null && res.be > 0) beMark = '<line x1="' + x(res.be).toFixed(1) + '" x2="' + x(res.be).toFixed(1) + '" y1="' + zy.toFixed(1) + '" y2="' + (T + ih) + '" stroke="#1b8a4b" stroke-width="1.4" stroke-dasharray="3 3"/><text class="lbl-good" x="' + x(res.be).toFixed(1) + '" y="' + (zy - 8).toFixed(1) + '" text-anchor="middle">' + tr('Yr {n}', { n: res.be }) + '</text>';
      chartEl.innerHTML = '<svg class="chart" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + tr('Net difference between the two example packages over 25 years') + '">' +
        '<defs><clipPath id="cp-pos"><rect x="' + L + '" y="' + T + '" width="' + iw + '" height="' + Math.max(0, zy - T).toFixed(1) + '"/></clipPath><clipPath id="cp-neg"><rect x="' + L + '" y="' + zy.toFixed(1) + '" width="' + iw + '" height="' + Math.max(0, T + ih - zy).toFixed(1) + '"/></clipPath></defs>' +
        g + '<path d="' + area + '" fill="rgba(27,138,75,.16)" clip-path="url(#cp-pos)"/><path d="' + area + '" fill="rgba(178,79,23,.16)" clip-path="url(#cp-neg)"/>' +
        '<line class="zero" x1="' + L + '" x2="' + (W - R) + '" y1="' + zy.toFixed(1) + '" y2="' + zy.toFixed(1) + '"/>' +
        '<path class="l-good" d="' + line + '" clip-path="url(#cp-pos)"/><path class="l-leak" d="' + line + '" clip-path="url(#cp-neg)"/>' +
        beMark + dots +
        '<line class="guide" x1="0" x2="0" y1="' + T + '" y2="' + (T + ih) + '" stroke="#0e1310" stroke-opacity=".35" stroke-width="1" style="display:none"/>' +
        '<rect class="hit" x="' + L + '" y="' + T + '" width="' + iw + '" height="' + ih + '" fill="transparent"/></svg>' +
        '<div class="tip" role="presentation"></div>' +
        '<p class="src" style="margin-top:8px"><span style="color:var(--leak)">●</span> ' + tr('Alternative example inverter replacement') + ' &nbsp; <span style="color:var(--accent-deep)">●</span> ' + tr('Jinko Tiger Neo 3.0 example inverter replacement') + ' &nbsp;·&nbsp; ' + tr('Vertical dashed marker = modeled crossover year, when present.') + '</p>';
      var svg = $('svg', chartEl), tip = $('.tip', chartEl), guide = $('.guide', svg), hit = $('.hit', svg);
      function move(e) {
        var r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (W / r.width);
        var t = Math.max(0, Math.min(25, Math.round((px - L) / iw * 25)));
        guide.style.display = ''; guide.setAttribute('x1', x(t)); guide.setAttribute('x2', x(t));
        tip.textContent = tr('Year {n}', { n: t }) + ' · ' + (res.net[t] < 0 ? '−' : '+') + rm(Math.abs(res.net[t]));
        tip.style.left = (x(t) * r.width / W) + 'px'; tip.style.top = (y(res.net[t]) * r.height / H) + 'px';
        tip.classList.add('is-on');
      }
      function leave() { guide.style.display = 'none'; tip.classList.remove('is-on'); }
      hit.addEventListener('pointermove', move); hit.addEventListener('pointerdown', move); hit.addEventListener('pointerleave', leave);
    }

    function update(fromUser) {
      var input = { kwp: parseFloat(kwpIn.value), gap: parseInt(gapIn.value, 10), extraSwap: swapIn.checked, unreg: !!unregIn && unregIn.checked && rebateActive };
      calcState = { kwp: input.kwp, gap: input.gap };
      $('#o-kwp .num').textContent = input.kwp; $('#o-gap .num').textContent = nf.format(input.gap);
      fill(kwpIn); fill(gapIn);
      var res = runModel(input, CFG); last = res;

      var good = res.final >= 0;
      oNet.className = 'out__big num ' + (good ? 'is-good' : 'is-bad');
      oNet.textContent = (good ? '+' : '−') + rm(Math.abs(res.final));
      if (res.final === 0) {
        oSentence.textContent = tr('The examples are even after 25 years under these assumptions.');
      } else if (good) {
        oSentence.textContent = tr('Under these assumptions, the higher-spec example leads by the amount shown after 25 years.');
      } else {
        oSentence.textContent = tr('Under these assumptions, the lower-upfront example leads by the amount shown after 25 years.');
      }
      oBe.textContent = res.be === null ? tr('Not in 25 yrs') : res.be === 0 ? tr('Day one') : tr('Year {n}', { n: res.be });
      var liveNet = $('[data-live="net"]', root), liveBe = $('[data-live="be"]', root);
      if (liveNet) { liveNet.textContent = oNet.textContent; liveNet.style.color = good ? '' : 'var(--leak-inv)'; }
      if (liveBe) liveBe.textContent = res.be === null ? tr('No payback') : res.be === 0 ? tr('Day one') : tr('Repaid yr {n}', { n: res.be });

      var rows = [
        [tr('Difference in upfront price'), res.upfront],
        [tr('Difference in example panel warranty terms'), res.degr],
        [tr('Difference in modeled inverter replacements'), res.inv]
      ];
      if (res.rebate) rows.push([tr('Rebate difference in this example*'), res.rebate]);
      oBreak.innerHTML = rows.map(function (r) {
        return '<li><span>' + r[0] + '</span><span class="v ' + (r[1] < 0 ? 'neg' : 'pos') + '">' + (r[1] < 0 ? '−' : '+') + rm(Math.abs(r[1])) + '</span></li>';
      }).join('') + '<li class="total"><span>' + tr('Net after 25 years') + '</span><span class="v ' + (good ? 'pos' : 'neg') + '">' + (good ? '+' : '−') + rm(Math.abs(res.final)) + '</span></li>';
      renderChart(res);
      if (fromUser && !used) { used = true; setTimeout(function () { track('calculator_used', { kwp: input.kwp, gap: input.gap }); }, 1500); }
    }

    // assumptions text from config so page and model never drift apart
    var m = CFG.model, set = function (k, v) { var n = $('[data-a="' + k + '"]', root); if (n) n.textContent = v; };
    set('yield', nf.format(m.yieldKwhPerKwp)); set('value', m.valuePerKwh.toFixed(2)); set('inv', m.inverterRmPerKwp);
    set('swapB', m.inverterSwaps.budgetExtra.join(' & ')); set('swapE', m.inverterSwaps.engineered.join(' & '));

    [kwpIn, gapIn, swapIn, unregIn].forEach(function (el) { if (el) el.addEventListener('input', function () { update(true); }); });
    update(false);
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (last) renderChart(last); }, 150); });
  }

  /* --- Timeline: two houses, drag through 25 years ---------------------- */
  function houseSVG(uid) {
    var rects = [];
    [[79, 46, 5, 26], [69, 66, 5, 30]].forEach(function (r) {
      for (var i = 0; i < r[2]; i++) rects.push([r[0] + i * (r[3] + 3), r[1], r[3], 16]);
    });
    var panels = '', shine = '';
    rects.forEach(function (r) {
      panels += '<rect class="h-panel" x="' + r[0] + '" y="' + r[1] + '" width="' + r[2] + '" height="' + r[3] + '" rx="1.5"/>';
      shine += '<rect x="' + r[0] + '" y="' + r[1] + '" width="' + r[2] + '" height="' + r[3] + '" rx="1.5"/>';
    });
    return '<svg class="house" viewBox="0 18 300 166" aria-hidden="true">' +
      '<g class="h-sun"><circle cx="34" cy="44" r="10"/><path d="M34 26v5M34 57v5M16 44h5M47 44h5M21 31l3.5 3.5M43.500 53.500L47 57M47 31l-3.5 3.5M24.500 53.500L21 57"/></g>' +
      '<defs><linearGradient id="sh-' + uid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset=".65" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' +
      '<path class="h-ground" d="M10 176H290"/>' +
      '<rect class="h-wall" x="44" y="92" width="212" height="84"/>' +
      '<path class="h-roof" d="M28 92L72 38H228L272 92Z"/>' + panels +
      '<g class="h-shine" fill="url(#sh-' + uid + ')">' + shine + '</g>' +
      '<rect class="h-door" x="62" y="124" width="26" height="52" rx="2"/>' +
      '<rect class="h-door" x="104" y="112" width="40" height="30" rx="2"/><path class="h-invl" d="M124 112v30M104 127h40"/>' +
      '<rect class="h-inv" x="206" y="112" width="34" height="46" rx="5"/><circle class="h-led" cx="223" cy="124" r="4"/><path class="h-invl" d="M213 138h20M213 146h13"/>' +
      '</svg>';
  }

  function initTimeline() {
    var root = $('[data-timeline]'); if (!root || !CFG.model) return;
    var m = CFG.model, KWP = 8, swapCost = m.inverterRmPerKwp * KWP;
    var swaps = { b: m.inverterSwaps.budgetExtra, e: m.inverterSwaps.engineered };
    var params = { b: m.budget, e: m.engineered };
    var slider = $('#t-year', root), yearEl = $('[data-tl="year"]', root), play = $('[data-tl="play"]', root), scale = $('[data-tl="scale"]', root);
    var tl = function (k) { return $('[data-tl="' + k + '"]', root); };
    var wrench = '<svg class="ic"><use href="#i-wrench"/></svg>';
    var interacted = false, timer = null;

    ['b', 'e'].forEach(function (k) { tl(k + '-house').innerHTML = houseSVG(k); });

    var marks = '';
    [0, 5, 10, 15, 20, 25].forEach(function (t) { marks += '<span class="tick" style="left:' + (t / 25 * 100) + '%">' + t + '</span>'; });
    ['b', 'e'].forEach(function (k) {
      swaps[k].forEach(function (t) { marks += '<span class="ev ev--' + k + '" style="left:' + (t / 25 * 100) + '%" title="' + tr('Year {n}: inverter replaced', { n: t }) + '"><i>' + wrench + '</i>' + t + '</span>'; });
    });
    scale.innerHTML = marks;

    function render(t) {
      slider.value = t;
      slider.style.setProperty('--fill', (t / 25 * 100) + '%');
      slider.setAttribute('aria-valuetext', tr('Year {n}', { n: t }));
      yearEl.textContent = t;
      ['b', 'e'].forEach(function (k) {
        var p = params[k], o = t === 0 ? 1 : 1 - p.firstYear - p.annual * (t - 1);
        var done = swaps[k].filter(function (y) { return y <= t; }).length, now = swaps[k].indexOf(t) > -1;
        var card = $('[data-tl-card="' + k + '"]', root), wr = '';
        card.style.setProperty('--out', o);
        card.classList.toggle('is-swap', now);
        tl(k + '-out').textContent = (o * 100).toFixed(1) + '%';
        tl(k + '-bar').style.setProperty('--w', Math.max(0, Math.min(100, (o - 0.8) / 0.2 * 100)) + '%');
        for (var i = 0; i < done; i++) wr += wrench;
        tl(k + '-wr').innerHTML = done ? wr + '<em>×' + done + '</em>' : '<em>' + tr('No replacements yet') + '</em>';
        tl(k + '-cost').textContent = rm(done * swapCost);
        $('span', tl(k + '-toast')).textContent = tr('Inverter replaced −{x}', { x: rm(swapCost) });
      });
    }

    function stop() { clearInterval(timer); timer = null; root.classList.remove('is-playing'); play.setAttribute('aria-label', tr('Play the 25-year timeline')); }
    function start() {
      if (+slider.value >= 25) render(0);
      root.classList.add('is-playing'); play.setAttribute('aria-label', tr('Pause the timeline'));
      timer = setInterval(function () { var t = +slider.value + 1; render(t); if (t >= 25) stop(); }, 340);
    }
    play.addEventListener('click', function () { interacted = true; if (timer) stop(); else start(); track('timeline_play'); });
    slider.addEventListener('input', function () { if (!interacted) track('timeline_used'); interacted = true; stop(); render(+slider.value); });
    render(0);

    // Play once, automatically, the first time the controls scroll into view.
    if ('IntersectionObserver' in window && !reduceMotion) {
      var ao = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { ao.disconnect(); if (!interacted) setTimeout(function () { if (!interacted) start(); }, 500); }
      }, { threshold: 0.9 });
      ao.observe($('.tl__bar', root));
    }
  }

  /* ------------------------------------------------------------------ */
  /* Thank-you page                                                      */
  /* ------------------------------------------------------------------ */
  function initThankYou() {
    var lead = null;
    try { lead = JSON.parse(sessionStorage.getItem('eg_lead') || 'null'); } catch (e) { /* ignore */ }
    var nameEl = $('[data-ty-name]'); if (nameEl && lead && lead.first) nameEl.textContent = ', ' + lead.first;
    var wa = $$('[data-ty-wa]');
    wa.forEach(function (a) {
      a.href = lead && lead.wa ? lead.wa : waUrl(waMessage('default'));
      a.addEventListener('click', function () { track('whatsapp_click', { location: 'thank_you' }); conversion('whatsapp'); });
    });
    var fallback = lead && lead.delivery === 'whatsapp';
    $$('[data-ty-fallback]').forEach(function (n) { n.hidden = !fallback; });
    $$('[data-ty-normal]').forEach(function (n) { n.hidden = !!fallback; });
    // Primary conversion: once per submitted lead, never on refresh or direct visits.
    var fired = false; try { fired = sessionStorage.getItem('eg_conv') === '1'; } catch (e) { /* ignore */ }
    if (lead && !fired) {
      conversion('lead', { value: 1.0, currency: 'MYR' });
      track('generate_lead', { source: lead.source, bill: lead.bill });
      try { sessionStorage.setItem('eg_conv', '1'); } catch (e) { /* ignore */ }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */
  initTimeline();
  initCalc();
  if (document.body.hasAttribute('data-page') && document.body.getAttribute('data-page') === 'thank-you') initThankYou();
})();
