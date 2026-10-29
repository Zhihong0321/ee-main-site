/* Eternalgy deck: chapter switching over one persistent 3D scene.
   Same mechanism as the reference infographic: the page never scrolls; go(i) cross-fades the text
   panel, moves the 3D camera to that chapter's preset and re-frames the house into the clear area.
   Needs: markup in deck.html, assets/css/deck.css, 3D-house-v2/dist/house.js (loaded after first paint). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // keep in step with the phone/tablet media query in deck.css
  var phoneMQ = matchMedia('(max-width: 1100px) and (min-height: 521px), (max-aspect-ratio: 5/6)');

  var pages = $$('.pg:not([hidden])'), panel = $('#panel'), chap = $('#chap'), houseEl = $('#house');
  var navPages = pages.filter(function (p) { return p.hasAttribute('data-nav'); }).sort(function (a, b) { return +a.dataset.nav - +b.dataset.nav; });
  var idx = {}, cur = -1, house = null, ui = null, touched = false, hovered = null;
  var track = function (n, p) { if (window.EG && window.EG.track) window.EG.track(n, p); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  // translations (deck-zh.html loads window.EG_T, keyed by the English text)
  var T = window.EG_T || {};
  var tr = function (s, v) { var r = T[s] || s; if (v) for (var k in v) r = r.split('{' + k + '}').join(v[k]); return r; };

  /* ---------------------------------------------------------------- rail */
  pages.forEach(function (p, i) { idx[p.id] = i; });
  navPages.forEach(function (p, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = '<i></i><span>' + pad(i + 1) + '</span><b>' + p.dataset.label + '</b>';
    b.setAttribute('aria-label', tr('Chapter {n}: {label}', { n: i + 1, label: p.dataset.label }));
    b.addEventListener('click', function () { go(pages.indexOf(p)); });
    chap.appendChild(b);
  });
  var railBtns = $$('#chap button');
  // Phones follow the buyer journey. Technical pages link back to the system overview.
  var mobileNext = { cover: 'marathon', marathon: 'cost', cost: 'calculator', calculator: 'registered', registered: 'inside', inside: 'coverage', coverage: 'process', process: 'faq', faq: 'assess' };
  pages.forEach(function (p) {
    var targetId = mobileNext[p.id];
    var n = targetId && pages[idx[targetId]];
    var isExploreDetail = p.dataset.navGroup === 'system' && p.id !== 'inside';
    var isAtapDetail = p.id === 'atap';
    if (!n && !isExploreDetail && !isAtapDetail) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn--line btn--block pgnext';
    if (n) {
      var targetNav = navPages.findIndex(function (q) { return q.dataset.navGroup === n.dataset.navGroup; });
      b.innerHTML = '<span>' + tr('Next') + ' · <b>' + pad(Math.max(targetNav + 1, 1)) + ' ' + navPages[Math.max(targetNav, 0)].dataset.label + '</b></span><svg class="ic ic-arrow"><use href="#i-arrow"/></svg>';
      b.addEventListener('click', function () { go(idx[targetId]); });
    } else {
      b.innerHTML = '<svg class="ic"><use href="#i-back"/></svg><span>' + tr(isAtapDetail ? 'Back to installation steps' : 'Back to system overview') + '</span>';
      b.addEventListener('click', function () { go(idx[isAtapDetail ? 'process' : 'inside']); });
    }
    p.appendChild(b);
  });

  /* ------------------------------------------------------------ 3D frame */
  // On phones the house follows the reading panel, so its pinned labels follow it too.
  function alignPhoneOverlays() {
    if (!phoneMQ.matches) return;
    var stage = $('#stage').getBoundingClientRect(), r = houseEl.getBoundingClientRect();
    var top = Math.max(0, r.top - stage.top) + 'px', height = r.height + 'px';
    ['#brands', '#xlabels', '#daytags', '#heattags', '#batttags'].forEach(function (sel) {
      var el = $(sel); if (el) { el.style.top = top; el.style.height = height; }
    });
    var wind = $('#windtag'); if (wind) wind.style.top = top;
  }
  function frame(instant) {
    if (!house || cur < 0) return;
    if (phoneMQ.matches) {
      document.body.dataset.side = '0';
      house.setFrame(null, { instant: !!instant });
      alignPhoneOverlays();
      return;
    }
    var W = innerWidth, page = pages[cur];
    var top = $('#top').getBoundingClientRect().bottom + 6;
    var L = 0, R = W, T = top, B;
    var main = $('.pg__main', page), side = $('.pg__side', page);
    document.body.dataset.side = side ? '1' : '0';
    document.body.style.setProperty('--sidew', (side ? side.getBoundingClientRect().width : 0) + 'px');
    B = $('#rail').getBoundingClientRect().top - 8;
    if (main) L = main.getBoundingClientRect().right + 8;
    // the house may tuck a little under a side panel's soft edge, but never get squeezed into a sliver
    if (side) R = side.getBoundingClientRect().left + side.getBoundingClientRect().width * 0.3;
    if (R - L < 420) R = Math.min(W, L + 420);
    house.setFrame({ L: L, T: T, W: Math.max(1, R - L), H: Math.max(1, B - T) }, { instant: !!instant });
  }
  // columns change height after first paint (calculator chart, FAQ answers, form step 2): keep their scroll fades right
  var ro = window.ResizeObserver ? new ResizeObserver(function () {
    if (cur >= 0) $$('.pg__main,.pg__side,.pg__foot', pages[cur]).forEach(markMore);
    if (phoneMQ.matches) requestAnimationFrame(alignPhoneOverlays);
  }) : null;
  function watch(page) {
    if (!ro) return;
    ro.disconnect();
    $$('.pg__main,.pg__side,.pg__foot', page).forEach(function (k) { ro.observe(k); });
  }
  // soft fade at the bottom edge of a column that has more to scroll
  function markMore(el) { el.classList.toggle('more', el.scrollHeight - el.clientHeight > 6 && el.scrollTop + el.clientHeight < el.scrollHeight - 6); }
  $$('.pg__main,.pg__side,.pg__foot').forEach(function (el) { el.addEventListener('scroll', function () { markMore(el); }, { passive: true }); });

  /* ------------------------------------------------------------- switch */
  function go(i, o) {
    o = o || {};
    i = Math.max(0, Math.min(pages.length - 1, i));
    if (i === cur) return;
    var prev = cur >= 0 ? pages[cur] : null, page = pages[i], dir = i > cur ? 1 : -1;
    cur = i;

    if (prev) {
      prev.classList.remove('on');
      prev.setAttribute('aria-hidden', 'true');
      clearTimeout(prev._t);
      // keep the old chapter in the layout while it fades, then drop it (also stops its hidden widgets)
      prev._t = setTimeout(function () { if (pages[cur] !== prev) prev.classList.add('off'); }, reduce ? 0 : 480);
    }
    clearTimeout(page._t);
    page.classList.remove('off');
    page.removeAttribute('aria-hidden');
    page.scrollTop = 0;
    $$('.pg__main,.pg__side,.pg__foot', page).forEach(function (e) { e.scrollTop = 0; });
    void page.offsetWidth; // reflow so the opacity transition runs
    page.classList.add('on');

    if (page.dataset.s !== 'anatomy') { xOff = false; xt.setAttribute('aria-pressed', 'true'); }
    document.body.dataset.ch = page.dataset.s;
    watch(page);
    $$('.pg__main,.pg__side,.pg__foot', page).forEach(markMore);
    railBtns.forEach(function (b, j) { if (navPages[j].dataset.navGroup === page.dataset.navGroup) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    $('#prev').setAttribute('aria-disabled', String(i === 0));
    $('#next').setAttribute('aria-disabled', String(i === pages.length - 1));
    var navIndex = navPages.findIndex(function (p) { return p.dataset.navGroup === page.dataset.navGroup; });
    var navPage = navPages[Math.max(navIndex, 0)];
    $('#announce').textContent = tr('Chapter {n} of {total}: {label}', { n: Math.max(navIndex + 1, 1), total: navPages.length, label: navPage.dataset.label });
    $('#resetView').classList.remove('on');
    if (!o.noHash && history.replaceState) history.replaceState(null, '', '#' + page.id);
    if (!o.first) track('chapter_view', { chapter: page.id, index: i });
    // Phones start at the section copy; the assessment goes straight to its form.
    if (phoneMQ.matches && !o.first) {
      if (page.dataset.s === 'assess') scrollTo({ top: panel.getBoundingClientRect().top + scrollY - $('#top').offsetHeight, behavior: reduce ? 'auto' : 'smooth' });
      else scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    }

    scene(page, o.first);
    dayEnter(page.dataset.day === '1');
    heatEnter(page.dataset.heat === '1');
    battEnter(page.dataset.batt === '1');
    // widgets that measure themselves (calculator chart) re-render once their chapter has a size
    setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 60);
    return dir;
  }

  // If someone operates a 3D control on a phone, bring the optional model into view.
  function showHouse(always) {
    if (!phoneMQ.matches) return;
    var r = houseEl.getBoundingClientRect(), top = $('#top').offsetHeight;
    if (always || r.top < top || r.bottom > innerHeight) scrollTo({ top: Math.max(0, r.top + scrollY - top - 8), behavior: reduce ? 'auto' : 'smooth' });
  }

  function scene(page, instant) {
    if (!house) return;
    if (ui && houseEl.classList.contains('has-active')) ui.select(null); // clear a part pin without flying home
    frame(instant); // first: the camera distance is fitted to the frame's aspect, so the frame must be set before flying
    house.flyTo(page.dataset.view || 'home', { zoom: phoneMQ.matches ? parseFloat(page.dataset.zoomPhone) || 1 : 1 });
    if (page.dataset.rotate === '1' && !touched) house.setAutoRotate(true); else house.setAutoRotate(false);
    house.setExplode(page.dataset.explode === '1' && !xOff);
    house.setWind(page.dataset.wind === '1', windSpd.value / windSpd.max);
    if (page.dataset.day === '1') paintDay(dayM);
    else if (page.dataset.batt === '1') paintBatt(battM);
    else {
      house.setDaylight(false);
      house.setPanelGlow('A', 0);
      house.setPanelGlow('B', 0);
      house.setFlow(1);
    }
    if (page.dataset.batt !== '1') house.setStorage(0, 0);
    if (page.dataset.heat === '1') paintHeat(heatM);
    else house.setHeat(false);
    syncParts();
  }

  /* ------------- chapter 01: two panel brands on one roof, driven by the timeline */
  var brands = { e: $('[data-brand="e"]'), b: $('[data-brand="b"]') };
  var cards = { e: $('[data-tl-card="e"]'), b: $('[data-tl-card="b"]') };
  var anchorOf = { e: 'panelsA', b: 'panelsB' }; // left group = Jinko, right group = typical entry-level
  function wear() {
    ['e', 'b'].forEach(function (k) {
      var o = parseFloat(cards[k].style.getPropertyValue('--out'));
      if (isNaN(o)) o = 1;
      $('.v', brands[k]).textContent = (o * 100).toFixed(1) + '%';
      if (house) house.setPanelWear(k === 'e' ? 'A' : 'B', 1 - o);
    });
  }
  if (window.MutationObserver) ['e', 'b'].forEach(function (k) { new MutationObserver(wear).observe(cards[k], { attributes: true, attributeFilter: ['style'] }); });
  var pt = { x: 0, y: 0, visible: false };
  function placeBrands() {
    if (document.body.dataset.ch !== 'marathon') return;
    ['e', 'b'].forEach(function (k) {
      house.project(house.anchors[anchorOf[k]], pt);
      brands[k].style.transform = 'translate(' + pt.x.toFixed(1) + 'px,' + pt.y.toFixed(1) + 'px)';
      brands[k].classList.toggle('on', pt.visible);
    });
  }

  /* ------------- chapter "Wind": slider sets the gust, one tag rides on the panels */
  var windSpd = $('#windspd'), windT = $('#windT'), windTag = $('#windtag'), windV = $('[data-windv]', windTag);
  var wpt = { x: 0, y: 0, visible: false };
  // Beaufort wind-force grade (风力等级): [lowest m/s, English, 中文]
  var BF = [[0, 'Calm', '无风'], [0.3, 'Light air', '软风'], [1.6, 'Light breeze', '轻风'], [3.4, 'Gentle breeze', '微风'], [5.5, 'Moderate breeze', '和风'], [8, 'Fresh breeze', '清风'],
    [10.8, 'Strong breeze', '强风'], [13.9, 'Near gale', '疾风'], [17.2, 'Gale', '大风'], [20.8, 'Strong gale', '烈风'], [24.5, 'Storm', '狂风'], [28.5, 'Violent storm', '暴风'], [32.7, 'Typhoon force', '台风']];
  function force(ms) { var f = 0; for (var i = 0; i < BF.length; i++) if (ms >= BF[i][0]) f = i; return f; }
  var wscale = $('[data-wscale]');
  [6, 8, 10, 12].forEach(function (f) {
    var t = document.createElement('span');
    t.textContent = 'F' + f; t.dataset.f = f;
    t.style.left = (BF[f][0] / windSpd.max * 100) + '%';
    wscale.appendChild(t);
  });
  function paintWind() {
    var v = +windSpd.value, f = force(v);
    windSpd.style.setProperty('--fill', (v / windSpd.max * 100) + '%');
    windT.textContent = v + ' m/s';
    windV.textContent = v + ' m/s';
    $('[data-g="f"]').textContent = 'F' + f;
    $('[data-g="en"]').textContent = BF[f][1];
    $('[data-g="zh"]').textContent = BF[f][2] + (f ? ' · ' + f + '级' : '');
    $$('span', wscale).forEach(function (t) { t.classList.toggle('on', f >= +t.dataset.f); });
    if (house) house.setWind(pages[cur].dataset.wind === '1', v / windSpd.max);
  }
  windSpd.addEventListener('input', paintWind);
  windSpd.addEventListener('change', function () { track('wind_speed', { ms: +windSpd.value }); });
  function placeWindTag() {
    if (document.body.dataset.ch !== 'wind') return;
    house.project(house.anchors.panelsB, wpt);
    windTag.style.transform = 'translate(' + wpt.x.toFixed(1) + 'px,' + wpt.y.toFixed(1) + 'px)';
    windTag.classList.toggle('on', wpt.visible);
  }
  paintWind();

  /* ------------- chapter "Heat": a sunny Malaysian day on the roof. Sun rays land on the glass, the panels heat to
     70-80°C, and each group loses power by its temperature coefficient: output = 100% - coef x (panel °C - 25).
     The day is illustrative (time in minutes since midnight); the coefficients are the proposal's. */
  var hhmm = function (m) { m = Math.floor(m); return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
  var HT = { min: 480, max: 1080, cE: 0.26, cB: 0.30, peak: 80 };
  var heatIn = $('#heatt'), heatTo = $('#heatT'), heatC = $('#heatC'), heatNote = $('#heatNote'), heatCtl = $('.heatctl');
  var heatPlay = $('[data-heat="play"]'), hTags = { e: $('[data-htag="e"]'), b: $('[data-htag="b"]') };
  var heatM = HT.min, heatPlaying = false, heatRaf = 0, heatLast = 0, heatHold = 0, heatOn = false, heatNoteKey = '';
  var sunAt = function (m) { return Math.max(0, Math.sin(Math.PI * (m - 426) / (1160 - 426))); }; // 0..1 sun strength, sunrise 07:06
  // panel temperature: air 27-33.5°C plus sun heating, which lags the sun by ~25 min (glass and roof store heat)
  function panelTemp(m) {
    var air = 27 + 6.5 * Math.max(0, Math.sin(Math.PI * (m - 420) / 840));
    return Math.min(HT.peak, air + 46.5 * Math.pow(sunAt(m - 25), 1.2));
  }
  var outOf = function (c, t) { return 100 - c * Math.max(0, t - 25); };
  (function () {
    var md = (window.EG_CONFIG || {}).model;
    if (!md) return;
    var yr = 8 * md.yieldKwhPerKwp * 0.0165 * md.valuePerKwh, life = 0, e = md.engineered;
    for (var t = 1; t <= 25; t++) life += yr * (1 - e.firstYear - e.annual * (t - 1));
    var rm = function (v, r) { return '≈RM' + (Math.round(v / r) * r).toLocaleString('en-MY'); };
    $('[data-hroi="yr"]').textContent = rm(yr, 10);
    $('[data-hroi="life"]').textContent = rm(life, 100);
    $('[data-hroi="basis"]').textContent = md.yieldKwhPerKwp.toLocaleString('en-MY') + ' kWh/kWp, RM' + md.valuePerKwh.toFixed(2) + '/kWh';
  })();
  function paintHeat(m) {
    heatM = m;
    var t = panelTemp(m), oE = outOf(HT.cE, t), oB = outOf(HT.cB, t), p = (m - HT.min) / (HT.max - HT.min) * 100;
    heatIn.value = Math.round(m);
    heatIn.style.setProperty('--fill', p + '%');
    heatTo.textContent = hhmm(m);
    heatC.textContent = Math.round(t) + '°C';
    heatCtl.style.setProperty('--t', ((t - 25) / 60).toFixed(3));
    heatCtl.classList.toggle('is-peak', t >= 70);
    var key = t >= 70 ? 'Peak heat · 70–80°C on the panels' : m < 720 ? (t < 45 ? 'Morning sun · the glass starts to warm' : 'Heat builds up · glass on top, hot roof below')
      : 'Late afternoon · still hot, slowly cooling';
    if (key !== heatNoteKey) { heatNoteKey = key; heatNote.textContent = tr(key); }
    [['e', oE], ['b', oB]].forEach(function (g) {
      var txt = g[1].toFixed(1) + '%';
      $('[data-hout="' + g[0] + '"]').textContent = txt;
      $('[data-hm="' + g[0] + '"]').style.setProperty('--w', ((g[1] - 75) / 25 * 100).toFixed(1) + '%');
      $('[data-hv]', hTags[g[0]]).textContent = txt;
    });
    $('[data-hgap]').textContent = '+' + (oE - oB).toFixed(1) + '%';
    if (!house || !heatOn) return;
    house.setDaylight(true, m / 60);
    house.setFlow(1);
    house.setHeat(true, 0.25 + 0.75 * sunAt(m), Math.max(0, Math.min(1, (t - 32) / 46)));
  }
  // minutes of the day per second of playback: linger while the panels are at their hottest
  function heatSpeed(m) { return panelTemp(m) >= 70 ? 18 : 50; }
  function heatTick(now) {
    heatRaf = requestAnimationFrame(heatTick);
    var dt = Math.min(0.05, Math.max(0, (now - heatLast) / 1000));
    heatLast = now;
    if (heatHold > 0) { heatHold -= dt; if (heatHold <= 0) paintHeat(HT.min); return; }
    var m = heatM + dt * heatSpeed(heatM);
    if (m >= HT.max) { m = HT.max; heatHold = 1.6; }
    paintHeat(m);
  }
  function heatRun(on) {
    heatPlaying = !!on && !reduce;
    heatCtl.classList.toggle('is-playing', heatPlaying);
    heatPlay.setAttribute('aria-label', tr(heatPlaying ? 'Pause the day' : 'Play a hot day'));
    cancelAnimationFrame(heatRaf);
    if (!heatPlaying) return;
    if (heatM >= HT.max) paintHeat(HT.min);
    heatLast = performance.now();
    heatHold = 0;
    heatRaf = requestAnimationFrame(heatTick);
  }
  // entering the chapter starts the day at 08:00; reduced motion parks it at the 13:30 peak
  function heatEnter(on) {
    if (on === heatOn) return;
    heatOn = on;
    if (!on) { heatRun(false); return; }
    paintHeat(reduce ? 810 : HT.min);
    heatRun(true);
  }
  heatPlay.addEventListener('click', function () { heatRun(!heatPlaying); showHouse(); track('heat_play', { play: heatPlaying }); });
  heatIn.addEventListener('input', function () { heatRun(false); paintHeat(+heatIn.value); });
  heatIn.addEventListener('change', function () { track('heat_time', { time: hhmm(heatM) }); });
  var hpt = { x: 0, y: 0, visible: false };
  function placeHeatTags() {
    if (document.body.dataset.ch !== 'heat') return;
    ['e', 'b'].forEach(function (k) {
      house.project(house.anchors[anchorOf[k]], hpt);
      hTags[k].style.transform = 'translate(' + hpt.x.toFixed(1) + 'px,' + hpt.y.toFixed(1) + 'px)';
      hTags[k].classList.toggle('on', hpt.visible);
    });
  }

  /* ------------- chapter "Low light": one day on the roof. Jinko starts at first light and stops at last light;
     the typical panel starts later and stops earlier. Times are minutes since midnight. Illustrative day, not a forecast. */
  var D = { min: 375, max: 1200, aOn: 412, bOn: 430, bOff: 1152, aOff: 1170, rise: 426, set: 1160 };
  var dayIn = $('#dayt'), dayT = $('#dayT'), dayNote = $('#dayNote'), dayCtl = $('.dayctl'), dayPlay = $('[data-day="play"]');
  var dayX = $('[data-dextra]'), daySun = $('[data-dsun]');
  var dTags = { e: $('[data-dtag="e"]'), b: $('[data-dtag="b"]') };
  var dayM = D.min, dayPlaying = false, dayRaf = 0, dayLast = 0, dayHold = 0, dayOn = false, dayNoteKey = '';
  var dpct = function (m) { return (m - D.min) / (D.max - D.min) * 100; };
  var sunH = function (m) { return Math.sin(Math.PI * (m - D.rise) / (D.set - D.rise)); }; // <0 = below the horizon
  var light = function (m) { return Math.max(0, Math.sin(Math.PI * (m - 405) / (1177 - 405))); }; // usable light, 06:45-19:37
  (function () {
    var span = function (el, a, b) { el.style.left = dpct(a) + '%'; el.style.width = (dpct(b) - dpct(a)) + '%'; };
    span($('[data-dbar="e"]'), D.aOn, D.aOff);
    span($('[data-dbar="b"]'), D.bOn, D.bOff);
    span($('[data-dxbar="am"]'), D.aOn, D.bOn);
    span($('[data-dxbar="pm"]'), D.bOff, D.aOff);
    $('.dayrow--e>span').textContent += ' · ' + hhmm(D.aOn) + '–' + hhmm(D.aOff);
    $('.dayrow--b>span').textContent += ' · ' + hhmm(D.bOn) + '–' + hhmm(D.bOff);
    $('[data-dxl="am"]').style.left = dpct((D.aOn + D.bOn) / 2) + '%';
    $('[data-dxl="pm"]').style.left = dpct((D.bOff + D.aOff) / 2) + '%';
    $$('[data-dxl],[data-dx]').forEach(function (el) { el.textContent = '+' + (D.bOn - D.aOn) + ' ' + tr('min'); });
    // the sun's path above the horizon (viewBox 825 x 100, horizon at y = 99)
    var d = 'M' + (D.rise - D.min) + ' 99';
    for (var m = D.rise + 5; m < D.set; m += 5) d += 'L' + (m - D.min) + ' ' + (99 - sunH(m) * 90).toFixed(1);
    $('[data-dcurve]').setAttribute('d', d + 'L' + (D.set - D.min) + ' 99Z');
    var sc = $('[data-dscale]');
    [7, 10, 13, 16, 19].forEach(function (h) {
      var t = document.createElement('span');
      t.textContent = pad(h) + ':00';
      t.style.left = dpct(h * 60) + '%';
      sc.appendChild(t);
    });
    // what +2.5% is worth on the calculator's 8 kWp home, with the same yield, RM/kWh and Jinko degradation
    var md = (window.EG_CONFIG || {}).model;
    if (!md) return;
    var yr = 8 * md.yieldKwhPerKwp * 0.025 * md.valuePerKwh, life = 0, e = md.engineered;
    for (var t = 1; t <= 25; t++) life += yr * (1 - e.firstYear - e.annual * (t - 1));
    var rm = function (v, r) { return '≈RM' + (Math.round(v / r) * r).toLocaleString('en-MY'); };
    $('[data-roi="yr"]').textContent = rm(yr, 10);
    $('[data-roi="life"]').textContent = rm(life, 100);
    $('[data-roi="basis"]').textContent = md.yieldKwhPerKwp.toLocaleString('en-MY') + ' kWh/kWp, RM' + md.valuePerKwh.toFixed(2) + '/kWh';
  })();
  function paintDay(m) {
    dayM = m;
    var p = dpct(m), onA = m >= D.aOn && m < D.aOff, onB = m >= D.bOn && m < D.bOff;
    dayIn.value = Math.round(m);
    dayIn.style.setProperty('--fill', p + '%');
    dayCtl.style.setProperty('--p', (p / 100).toFixed(4));
    dayT.textContent = hhmm(m);
    var key = m < D.aOn ? 'Before dawn · both panels idle' : m < D.bOn ? 'First light · only Jinko is generating'
      : m < D.bOff ? 'Daylight · both generating' : m < D.aOff ? 'Dusk · Jinko is still generating' : 'Night · both panels idle';
    if (key !== dayNoteKey) {
      dayNoteKey = key;
      dayNote.textContent = tr(key);
      dayCtl.dataset.phase = m < D.aOn || m >= D.aOff ? 'idle' : onA && !onB ? 'extra' : 'both';
    }
    var extra = Math.max(0, Math.min(m, D.bOn) - D.aOn) + Math.max(0, Math.min(m, D.aOff) - D.bOff);
    dayX.textContent = '+' + Math.floor(extra) + ' ' + tr('min');
    var s = sunH(m);
    daySun.style.left = p + '%';
    daySun.style.bottom = (Math.max(0, s) * 90) + '%';
    daySun.style.opacity = Math.max(0, Math.min(1, (s + 0.03) / 0.06)).toFixed(2);
    [['e', onA, D.aOn], ['b', onB, D.bOn]].forEach(function (g) {
      var el = dTags[g[0]], st = g[1] ? 'Generating' : m < g[2] ? 'Waiting' : 'Stopped';
      if (el.dataset.st !== st) { el.dataset.st = st; $('[data-dstate]', el).textContent = tr(st); }
    });
    dTags.e.classList.toggle('is-extra', onA && !onB);
    if (!house || !dayOn) return;
    var glow = function (on) { return on ? 0.22 + 0.4 * Math.sqrt(light(m)) : 0; };
    house.setDaylight(true, m / 60);
    house.setPanelGlow('A', glow(onA));
    house.setPanelGlow('B', glow(onB));
    house.setFlow(onA || onB ? 1 : 0);
  }
  // minutes of the day per second of playback: slow through the dawn and dusk windows, quick through midday
  function daySpeed(m) { return (m > D.aOn - 25 && m < D.bOn + 15) || (m > D.bOff - 15 && m < D.aOff + 25) ? 14 : 160; }
  function dayTick(now) {
    dayRaf = requestAnimationFrame(dayTick);
    var dt = Math.min(0.05, Math.max(0, (now - dayLast) / 1000));
    dayLast = now;
    if (dayHold > 0) { dayHold -= dt; if (dayHold <= 0) paintDay(D.min); return; }
    var m = dayM + dt * daySpeed(dayM);
    if (m >= D.max) { m = D.max; dayHold = 1.6; }
    paintDay(m);
  }
  function dayRun(on) {
    dayPlaying = !!on && !reduce;
    dayCtl.classList.toggle('is-playing', dayPlaying);
    dayPlay.setAttribute('aria-label', tr(dayPlaying ? 'Pause the day' : 'Play one day'));
    cancelAnimationFrame(dayRaf);
    if (!dayPlaying) return;
    if (dayM >= D.max) paintDay(D.min);
    dayLast = performance.now();
    dayHold = 0;
    dayRaf = requestAnimationFrame(dayTick);
  }
  // entering the chapter starts the day from before dawn; reduced motion parks it in the morning extra window
  function dayEnter(on) {
    if (on === dayOn) return;
    dayOn = on;
    if (!on) { dayRun(false); return; }
    paintDay(reduce ? D.aOn + 9 : D.min);
    dayRun(true);
  }
  dayPlay.addEventListener('click', function () { dayRun(!dayPlaying); showHouse(); track('lowlight_play', { play: dayPlaying }); });
  dayIn.addEventListener('input', function () { dayRun(false); paintDay(+dayIn.value); });
  dayIn.addEventListener('change', function () { track('lowlight_time', { time: hhmm(dayM) }); });
  var dpt = { x: 0, y: 0, visible: false };
  function placeDayTags() {
    if (document.body.dataset.ch !== 'lowlight') return;
    ['e', 'b'].forEach(function (k) {
      house.project(house.anchors[anchorOf[k]], dpt);
      dTags[k].style.transform = 'translate(' + dpt.x.toFixed(1) + 'px,' + dpt.y.toFixed(1) + 'px)';
      dTags[k].classList.toggle('on', dpt.visible);
    });
  }
  /* ------------- chapter "Battery": one sunny day and the night after it, 06:00 to 06:00. Solar feeds the home first,
     the surplus charges the battery (DC), then exports; after dark the battery feeds the home through the inverter
     until it reaches its reserve, then TNB takes over. Illustrative model, worked out once per minute up front. */
  var B = { min: 360, max: 1800, peak: 5.4, rise: 7.1, set: 19.33, cap: 10, reserve: 0.1, kw: 5 };
  // household use by hour (kW): air-con overnight, a morning bump, light daytime use, an evening peak
  var LOAD = [1.0, 1.0, 0.9, 0.9, 0.9, 0.9, 1.0, 1.4, 1.1, 0.7, 0.7, 0.7, 0.8, 0.8, 0.7, 0.7, 0.8, 1.0, 1.5, 2.1, 2.2, 2.0, 1.6, 1.1];
  var bSim = (function () {
    var n = B.max - B.min, out = [], soc = B.reserve * B.cap, tot = { pv: 0, in: 0, out: 0 };
    for (var i = 0; i <= n; i++) {
      var h = ((B.min + i) % 1440) / 60;
      var s = h > B.rise && h < B.set ? Math.sin(Math.PI * (h - B.rise) / (B.set - B.rise)) : 0;
      var pv = B.peak * s * s;
      var hp = h - 0.5, h0 = Math.floor(hp), f = hp - h0; // load: hourly values, eased between hour midpoints
      var load = LOAD[(h0 + 24) % 24] * (1 - f) + LOAD[(h0 + 25) % 24] * f;
      var self = Math.min(pv, load), surplus = pv - self, need = load - self;
      var chg = Math.min(surplus, B.kw, (B.cap - soc) * 60);
      var dis = Math.min(need, B.kw, Math.max(0, soc - B.reserve * B.cap) * 60);
      soc += (chg - dis) / 60;
      tot.pv += pv / 60; tot.in += chg / 60; tot.out += dis / 60;
      out.push({ pv: pv, load: load, self: self, chg: chg, dis: dis, exp: surplus - chg, imp: need - dis, soc: soc / B.cap });
    }
    out.tot = tot;
    return out;
  })();
  var battIn = $('#battt'), battT = $('#battT'), battNote = $('#battNote'), bCtl = $('.bctl'), battPlay = $('[data-batt="play"]');
  var fv = {}, fn = {}, fp = {}, bTags = { sun: $('[data-btag="sun"]'), batt: $('[data-btag="batt"]') };
  $$('[data-fv]').forEach(function (el) { fv[el.dataset.fv] = el; });
  $$('[data-fn]').forEach(function (el) { fn[el.dataset.fn] = el; });
  $$('[data-fp]').forEach(function (el) { fp[el.dataset.fp] = el; });
  var bSteps = $$('[data-bstep]'), socBar = $('[data-soc]');
  var battM = B.min, battPlaying = false, battRaf = 0, battLast = 0, battHold = 0, battOn = false, battNoteKey = '';
  var bpct = function (m) { return (m - B.min) / (B.max - B.min) * 100; };
  var kw = function (v) { return v.toFixed(1) + ' kW'; };
  (function () {
    // the strip above the slider: solar output (area) and the battery's charge level (line), viewBox 1440 x 100
    var pv = 'M0 99', soc = '';
    for (var i = 0; i < bSim.length; i += 5) {
      pv += 'L' + i + ' ' + (99 - bSim[i].pv / B.peak * 92).toFixed(1);
      soc += (i ? 'L' : 'M') + i + ' ' + (99 - bSim[i].soc * 92).toFixed(1);
    }
    $('[data-bpv]').setAttribute('d', pv + 'L1440 99Z');
    $('[data-bsoc]').setAttribute('d', soc);
    var sc = $('[data-bscale]');
    [6, 12, 18, 24, 30].forEach(function (h) {
      var t = document.createElement('span');
      t.textContent = pad(h % 24) + ':00';
      t.style.left = bpct(h * 60) + '%';
      sc.appendChild(t);
    });
    var k = function (v) { return '≈' + Math.round(v) + ' kWh'; };
    $('[data-broi="pv"]').textContent = k(bSim.tot.pv);
    $('[data-broi="in"]').textContent = k(bSim.tot.in);
    $('[data-broi="out"]').textContent = k(bSim.tot.out);
  })();
  function pipe(name, kwv, rev) {
    var el = fp[name], on = kwv > 0.05;
    el.classList.toggle('on', on);
    el.classList.toggle('rev', !!rev);
    var d = on ? (1.5 - Math.min(1, kwv / B.kw) * 1.1).toFixed(1) + 's' : '';
    if (el._d !== d) { el._d = d; el.style.setProperty('--dur', d || '1s'); }
  }
  function paintBatt(m) {
    battM = m;
    var s = bSim[Math.max(0, Math.min(bSim.length - 1, Math.round(m - B.min)))], p = bpct(m);
    var day = s.pv > 0.05, bkw = s.chg - s.dis, acOut = s.self + s.dis + s.exp;
    battIn.value = Math.round(m);
    battIn.style.setProperty('--fill', p + '%');
    bCtl.style.setProperty('--p', (p / 100).toFixed(4));
    battT.textContent = hhmm(m % 1440);
    var key = !day ? (s.dis > 0.05 ? 'Night · the battery powers your home' : 'Battery at reserve · TNB powers the house')
      : s.chg > 0.05 ? 'Extra solar is charging the battery' : s.exp > 0.05 ? 'Battery full · extra solar goes to TNB'
      : s.dis > 0.05 ? 'Sun fading · the battery helps out' : s.imp > 0.05 ? 'Low sun · solar first, TNB tops up' : 'Solar powers your home';
    if (key !== battNoteKey) {
      battNoteKey = key;
      battNote.textContent = tr(key);
      bCtl.dataset.phase = s.chg > 0.05 ? 'charge' : s.dis > 0.05 ? 'night' : day ? 'day' : 'grid';
    }
    var bst = s.chg > 0.05 ? 'Charging' : s.dis > 0.05 ? 'Discharging' : s.soc > 0.99 ? 'Full' : 'Idle';
    var soc = Math.round(s.soc * 100) + '%';
    fv.sun.textContent = kw(s.pv);
    fv.home.textContent = kw(s.load);
    fv.batt.textContent = soc;
    socBar.style.width = (s.soc * 100).toFixed(1) + '%';
    fv.grid.textContent = kw(s.exp > 0.05 ? s.exp : s.imp);
    if (fv.bst._k !== bst) { fv.bst._k = bst; fv.bst.textContent = tr(bst); fn.batt.dataset.st = bst; bTags.batt.dataset.st = bst; $('[data-bst]').textContent = tr(bst); }
    var gst = s.exp > 0.05 ? 'Exporting' : s.imp > 0.05 ? 'Buying' : 'Idle';
    if (fv.gst._k !== gst) { fv.gst._k = gst; fv.gst.textContent = tr(gst); }
    var inv = acOut > 0.05 ? 'DC → AC' : s.chg > 0.05 ? 'Charging' : 'Standby';
    if (fv.inv._k !== inv) { fv.inv._k = inv; fv.inv.textContent = tr(inv); }
    fn.sun.classList.toggle('on', day);
    fn.inv.classList.toggle('on', acOut > 0.05 || s.chg > 0.05);
    fn.home.classList.toggle('on', true);
    fn.batt.classList.toggle('on', s.chg > 0.05 || s.dis > 0.05);
    fn.grid.classList.toggle('on', s.exp > 0.05 || s.imp > 0.05);
    pipe('sun', s.pv);
    pipe('home', acOut - s.exp);
    pipe('batt', Math.abs(bkw), bkw < 0);
    pipe('grid', s.exp > 0.05 ? s.exp : s.imp, s.imp > 0.05);
    bSteps[0].classList.toggle('on', day && s.self > 0.05);
    bSteps[1].classList.toggle('on', s.chg > 0.05);
    bSteps[2].classList.toggle('on', !day && s.dis > 0.05);
    $('[data-bv]', bTags.sun).textContent = kw(s.pv);
    $('[data-bv]', bTags.batt).textContent = soc;
    if (!house || !battOn) return;
    var glow = day ? 0.22 + 0.4 * Math.sqrt(s.pv / B.peak) : 0;
    house.setDaylight(true, (m % 1440) / 60);
    house.setPanelGlow('A', glow);
    house.setPanelGlow('B', glow);
    house.setFlow(day ? 1 : 0);
    house.setStorage(bkw, acOut);
  }
  // minutes per second of playback: a whole day and night in ~22 s, slower around sunset when the battery takes over
  function battSpeed(m) { var h = (m % 1440) / 60; return h > 17.5 && h < 20 ? 30 : 75; }
  function battTick(now) {
    battRaf = requestAnimationFrame(battTick);
    var dt = Math.min(0.05, Math.max(0, (now - battLast) / 1000));
    battLast = now;
    if (battHold > 0) { battHold -= dt; if (battHold <= 0) paintBatt(B.min); return; }
    var m = battM + dt * battSpeed(battM);
    if (m >= B.max) { m = B.max; battHold = 1.6; }
    paintBatt(m);
  }
  function battRun(on) {
    battPlaying = !!on && !reduce;
    bCtl.classList.toggle('is-playing', battPlaying);
    battPlay.setAttribute('aria-label', tr(battPlaying ? 'Pause' : 'Play a day and night'));
    cancelAnimationFrame(battRaf);
    if (!battPlaying) return;
    if (battM >= B.max) paintBatt(B.min);
    battLast = performance.now();
    battHold = 0;
    battRaf = requestAnimationFrame(battTick);
  }
  // entering the chapter starts at 06:00; reduced motion parks it at 21:00, the battery running the house
  function battEnter(on) {
    if (on === battOn) return;
    battOn = on;
    if (!on) { battRun(false); return; }
    paintBatt(reduce ? 1260 : B.min);
    battRun(true);
  }
  battPlay.addEventListener('click', function () { battRun(!battPlaying); showHouse(); track('battery_play', { play: battPlaying }); });
  battIn.addEventListener('input', function () { battRun(false); paintBatt(+battIn.value); });
  battIn.addEventListener('change', function () { track('battery_time', { time: hhmm(battM % 1440) }); });
  var bpt = { x: 0, y: 0, visible: false };
  function placeBattTags() {
    if (document.body.dataset.ch !== 'battery') return;
    [['sun', 'panels'], ['batt', 'battery']].forEach(function (g) {
      house.project(house.anchors[g[1]], bpt);
      bTags[g[0]].style.transform = 'translate(' + bpt.x.toFixed(1) + 'px,' + bpt.y.toFixed(1) + 'px)';
      bTags[g[0]].classList.toggle('on', bpt.visible);
    });
  }

  paintDay(D.min);
  paintHeat(HT.min);
  paintBatt(B.min);

  /* ------------- chapter "Anatomy": layer labels follow the dismantled parts */
  var xOff = false; // the visitor chose "put it back together"
  var xl = $$('.xl'), xpt = { x: 0, y: 0, visible: false }, xv = null;
  xl.forEach(function (el) { el.insertAdjacentHTML('afterbegin', '<i class="xl__ln"></i>'); });
  var X_GAP = 44; // minimum vertical distance between two labels on the same side (px)
  function placeLabels() {
    if (document.body.dataset.ch !== 'anatomy') return;
    var done = house.exploded > 0.985 && !xOff, items = [];
    xl.forEach(function (el) {
      xv = house.layerPoint(el.dataset.layer, xv || undefined);
      if (!xv) return;
      house.project(xv, xpt);
      el.style.transform = 'translate(' + xpt.x.toFixed(1) + 'px,' + xpt.y.toFixed(1) + 'px)';
      el.classList.toggle('on', done && xpt.visible);
      items.push({ el: el, y: xpt.y, dir: el.classList.contains('xl--l') ? -1 : 1, len: parseFloat(el.dataset.xl) || 70, ey: xpt.y });
    });
    // dots that land on top of each other (phones) are nudged apart
    var placed = [];
    items.sort(function (a, b) { return a.y - b.y; }).forEach(function (i) {
      var m = i.el.style.transform.match(/translate\(([-\d.]+)px,([-\d.]+)px\)/);
      if (!m) return;
      var x = parseFloat(m[1]), y = parseFloat(m[2]);
      placed.forEach(function (p) { if (Math.abs(p.x - x) < 28 && Math.abs(p.y - y) < 28) x = p.x + 30; });
      placed.push({ x: x, y: y });
      i.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
    });
    [1, -1].forEach(function (dir) {
      var side = items.filter(function (i) { return i.dir === dir; }).sort(function (a, b) { return a.y - b.y; }), prev = -1e9;
      side.forEach(function (i) { i.ey = Math.max(i.y, prev + X_GAP); prev = i.ey; });
    });
    items.forEach(function (i) {
      var dx = i.dir * i.len, dy = i.ey - i.y, st = i.el.style;
      st.setProperty('--ex', dx + 'px');
      st.setProperty('--ey', dy + 'px');
      st.setProperty('--len', Math.hypot(dx, dy).toFixed(1) + 'px');
      st.setProperty('--ang', (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(2) + 'deg');
    });
  }
  var xt = $('#xtoggle');
  xt.addEventListener('click', function () {
    xOff = !xOff;
    xt.setAttribute('aria-pressed', String(!xOff));
    if (house) house.setExplode(!xOff);
    showHouse();
    track('anatomy_toggle', { exploded: !xOff });
  });

  /* ------------------------------------------------------------ 3D load */
  function onHouse() {
    house = houseEl.__house;
    ui = houseEl.__ui;
    if (!house) return;
    document.documentElement.classList.add('has-3d');
    // phones scroll: a vertical swipe on the house scrolls the page, a sideways drag still turns it
    var cv = $('canvas', houseEl);
    var touchMode = function () { if (cv) cv.style.touchAction = phoneMQ.matches ? 'pan-y' : 'none'; };
    touchMode();
    if (phoneMQ.addEventListener) phoneMQ.addEventListener('change', touchMode);
    localise3D();
    house.on('interact', function () { touched = true; $('#resetView').classList.add('on'); });
    house.on('frame', function () { syncParts(); placeBrands(); placeHeatTags(); placeDayTags(); placeBattTags(); placeWindTag(); placeLabels(); });
    wear();
    scene(pages[cur], true);
  }
  // the 3D bundle writes its own English labels: translate them, and give touch screens the touch wording
  function localise3D() {
    var hint = $('.h3d__hint span', houseEl);
    if (hint) hint.textContent = tr(matchMedia('(pointer: coarse)').matches ? 'Drag to rotate · pinch to zoom · tap a number' : 'Drag to rotate · scroll to zoom · tap a number');
    $$('.h3d-pin__label', houseEl).forEach(function (el) { el.textContent = tr(el.textContent); });
    $$('.h3d-pin__dot', houseEl).forEach(function (el) {
      var m = (el.getAttribute('aria-label') || '').match(/^(\d+)\. (.*)$/);
      if (m) el.setAttribute('aria-label', m[1] + '. ' + tr(m[2]));
    });
    var canvas = $('canvas', houseEl);
    if (canvas && canvas.getAttribute('aria-label')) canvas.setAttribute('aria-label', tr(canvas.getAttribute('aria-label')));
  }
  houseEl.addEventListener('house:ready', onHouse);
  function loadHouse() {
    var s = document.createElement('script');
    s.src = '3D-house-v2/dist/house.js';
    s.onload = function () { if (!house && houseEl.__house) onHouse(); };
    document.head.appendChild(s);
  }
  // after first paint, so the 3D bundle never delays the ad landing
  addEventListener('load', function () {
    if ('requestIdleCallback' in window) requestIdleCallback(loadHouse, { timeout: 1500 }); else setTimeout(loadHouse, 400);
  });

  /* --------------------------------------------- "Inside": parts + sun */
  function syncParts() {
    var v = house ? house.view : null;
    if (v === hovered) return;
    hovered = v;
    $$('.mxb').forEach(function (r) { var on = r.dataset.spot === v; r.classList.toggle('act', on); r.setAttribute('aria-pressed', String(on)); });
  }
  $$('.mxb').forEach(function (r) {
    function pick() {
      if (!ui || !house) return;
      var id = r.dataset.spot;
      ui.select(house.view === id ? null : id);
      showHouse();
      touched = true;
      $('#resetView').classList.add('on');
      syncParts();
    }
    r.addEventListener('click', pick);
    r.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); pick(); } });
  });
  var sun = $('#sun'), sunT = $('#sunT');
  function paintSun() {
    sun.style.setProperty('--fill', sun.value + '%');
    if (house) sunT.textContent = house.setSun(sun.value / 100);
  }
  sun.addEventListener('input', paintSun);
  paintSun();
  $('#resetView').addEventListener('click', function () {
    if (!house) return;
    if (ui && houseEl.classList.contains('has-active')) ui.select(null);
    house.flyTo(pages[cur].dataset.view || 'home');
    this.classList.remove('on');
  });

  /* ------------------------------------------------------------ inputs */
  $('#prev').addEventListener('click', function () { go(cur - 1); });
  $('#next').addEventListener('click', function () { go(cur + 1); });
  addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !(tag === 'BUTTON' || tag === 'SUMMARY' || tag === 'A' || (t && t.getAttribute('role') === 'button')))) { e.preventDefault(); go(cur + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(cur - 1); }
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(pages.length - 1);
  });
  // phones: swipe the chapter text sideways to change chapter (ignored over sliders and scrollers)
  var sx = 0, sy = 0, swipeOK = false;
  panel.addEventListener('touchstart', function (e) {
    var t = e.touches[0]; sx = t.clientX; sy = t.clientY;
    swipeOK = phoneMQ.matches && !e.target.closest('input,select,textarea,[data-noswipe],.chips,.tl__scale,.calc__chart,.tilemap');
  }, { passive: true });
  panel.addEventListener('touchend', function (e) {
    if (!swipeOK) return;
    var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) go(cur + (dx < 0 ? 1 : -1));
  }, { passive: true });
  // in-page links to a chapter id (#assess, #calculator, ...)
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (idx[id] === undefined) return;
    e.preventDefault();
    go(idx[id]);
  });
  addEventListener('hashchange', function () { var i = idx[location.hash.slice(1)]; if (i !== undefined) go(i, { noHash: true }); });

  var rt;
  addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { if (cur >= 0) frame(true); }, 120);
  });

  /* ------------------------------------------------------------ start */
  var start = idx[location.hash.slice(1)];
  go(start === undefined ? 0 : start, { first: true, noHash: start === undefined });
  // a #chapter link would make the browser jump past the house to that section; land at the top instead
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  addEventListener('load', function () { if (phoneMQ.matches && scrollY > 0) scrollTo(0, 0); });
})();
