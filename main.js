/* ============================================================================
   Ember · site v13 · behaviour
   1 the opening, scrubbed by scroll:
       hero      the former product section on paper: the ghost word, the app's
                 swarm around Ember, the headline and a short line in the corners
       bike      the paper goes, the camera is straight in on the down tube
       sticker   the sticker goes on first, centred on the tube
       click     then Ember comes in along the normal, turns to the tube's face
                 and clicks on, its front face centred on the tube
       data      dots out of the sensor; the app's day chart (Figma v11 · H1)
       model     the model's expected band over the bars; now runs warmer
       notice    the app's home screen: the swarm turns orange, one word, a push
   2 why (the figures), 3 the details (the team's section), 4 the carousel,
   5 the questions, 6 the waitlist (posts to the team's signup server when set)
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement; root.classList.add('js');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var narrow = matchMedia('(max-width: 760px), (max-aspect-ratio: 4/5)');   // phones, and tablets upright: the copy at the bottom
  var Swarm = window.EmberSwarm;
  var TAU = Math.PI * 2;
  // v51: a canvas only takes a new size when its size really changes. Setting the same size still clears it, and on a phone
  // the address bar sliding in and out fires resize again and again: every clear showed as a flicker
  function fit(c, w, h) { var a = Math.round(w), b = Math.round(h); if (c.width === a && c.height === b) return false; c.width = a; c.height = b; return true; }
  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  var seg = function (t, a, b) { return clamp((t - a) / (b - a), 0, 1); };
  var mix = function (a, b, t) { return a + (b - a) * t; };
  var lmix = function (a, b, t) { return Math.exp(mix(Math.log(a), Math.log(b), t)); };
  var smooth = function (t) { return t * t * (3 - 2 * t); };
  var inOut = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var outCubic = function (t) { return 1 - Math.pow(1 - t, 3); };
  var inQuad = function (t) { return t * t; };
  var fade = function (t, a, b, c, d) { return smooth(seg(t, a, b)) * (d === undefined ? 1 : 1 - smooth(seg(t, c, d))); };
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  /* ------------------------------------------------------------- geometry */
  // the bike (bike.webp, 1254 x 1254, the studio image): the flat face of the battery on the down tube,
  // measured row by row: Ember sits at MOUNT, its long axis along the tube, its width foreshortened by the 3/4 view
  var BIKE = { w: 825, h: 1905 };                   // bike-plate.webp: the team's studio photo (its blur: 412 x 952)
  // Ember in the opening is a sprite of its own render, turning about its long axis from facing you (0°) to the
  // tube's face (30°, face to the right): 16 frames of 450 x 900 px for 60 x 120 mm (3d/ember_scene.py mode=flip sign=1), pivoting on the
  // centre of its back face, which is the centre of every frame
  var SPR = { cx: 225, cy: 450, len: 787.5, mm: 7.5, frames: 16, beta: 30 };
  // v12: the down tube in the team's photo, measured row by row (y 580-840): centre x = 0.321 y - 6.9, 17.8° from
  // upright, about 129 px wide. The sticker lies on that centre line; Ember's back sits 9 px to the left of it, so
  // that its front face, 15 mm off the tube and turned 30° to the right, lands on the same centre line
  // v13: Ember on the battery's flat face as the team measured it (ember.js MOUNT 242.3, 650.0; the sticker 7.9 px
  // left and 1.6 px down of it); the tube's direction from their tu/tv (17.8° off upright)
  var MOUNT = { x: 234.4, y: 651.6, len: 128, rot: -0.31, sq: Math.cos(30 * Math.PI / 180) };   // the sticker
  var SEAT = { x: 233.3, y: 652.0 };                // where Ember's back lands: its turned front face then reads centred on the battery face (242.3, 650)
  var NORMAL = [16, -12];                           // one step off the surface along its normal, in bike px (the team's)
  // the team's shadow sprites (223 x 406) sit under their render frame (414 x 1145) through this matrix
  var SHSPR = [414 / 103, 0, 0, 1145 / 286, -60 * 414 / 103, -60 * 1145 / 286], SHG = { cx: 206.5, cy: 573 };
  var LIFT = [0.8, -0.6];                           // off the surface, towards the camera: up and to the right on screen
  var TUBE_PT = [262, 840];                         // the battery, lower on the tube
  var H1 = [25, 27, 30, 33, 30, 27, 25, 27, 35, 45, 55, 63, 70, 77, 80, 75, 65, 55, 45, 40, 50, 70, 95, 115];

  function apply(m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  function mul(A, B) { return [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]]; }
  function shift(m, dx, dy) { return [m[0], m[1], m[2], m[3], m[4] + dx, m[5] + dy]; }
  function css(m) { return 'matrix(' + m.map(function (v, i) { return v.toFixed(i < 4 ? 5 : 2); }).join(',') + ')'; }
  function pose(x, y, s, rot, sq, G) {   // image px -> screen: its centre at (x, y), scale s, turned rot (clockwise), width x sq
    sq = sq || 1; G = G || SPR;
    var a = Math.cos(rot) * s * sq, b = Math.sin(rot) * s * sq, c = -Math.sin(rot) * s, d = Math.cos(rot) * s;
    return [a, b, c, d, x - (a * G.cx + c * G.cy), y - (b * G.cx + d * G.cy)];
  }

  var SEQK = 0.84;                                    // v36: the bike's story ends at this share of its section; the app's states follow (v38: two, not three)

  var jobs = [], queued = false;
  // v25: where Ember's twelve lights are on the screen in the bike's story (written there, read by the hero's dots)
  var dock = { ok: false, c: [0, 0], pts: [], r: 4 };
  function ask() { if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; jobs.forEach(function (f) { f(); }); }); } }
  addEventListener('scroll', ask, { passive: true });
  addEventListener('resize', ask);
  function within(el) { var r = el.getBoundingClientRect(); return clamp(-r.top / Math.max(r.height - innerHeight, 1), 0, 1); }

  function glide(y) {
    if (reduce) { scrollTo(0, y); return; }
    var y0 = scrollY, d = y - y0, dur = clamp(Math.abs(d) / 1.4, 1000, 2400), t0 = performance.now(), stop = false;
    var cancel = function () { stop = true; };
    addEventListener('wheel', cancel, { once: true, passive: true }); addEventListener('touchstart', cancel, { once: true, passive: true });
    (function step(now) { if (stop) return; var k = clamp((now - t0) / dur, 0, 1); scrollTo(0, y0 + d * inOut(k)); if (k < 1) requestAnimationFrame(step); })(t0);
  }

  /* =================================================================== the day chart from the app, interactive
     Dag / Week / Maand and the arrows load another period: the bars sink, the
     new ones grow in. Illustrative data, seeded per period, so going back and
     forth shows the same days; now and then a peak warmer than normal (orange)
     or too hot (red), as in the app. */
  var GREEN = 'rgba(130, 185, 142, .38)', GREEN_ON = '#82b98e', ORANGE = '#e8a23a', RED = '#e24d42';
  var MODES = {
    dag:   { n: 24, w: 6,  axis: ['−24 u', '−18 u', '−12 u', '−6 u', 'Nu'], span: '1 dag', when: 'vandaag' },
    week:  { n: 28, w: 6, axis: ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'], span: '1 week', when: 'deze week' },   // four bars a day, as thin as day and month
    maand: { n: 30, w: 5,  axis: ['1', '8', '15', '22', '30'], span: '1 maand', when: 'deze maand' }
  };
  var ORDER = ['dag', 'week', 'maand'];
  // v24: Figma v11 · H2 · Home · aandacht: the same day as H1, the last four hours running up in orange, on a scale of 20° and 40°
  var H2 = H1.slice(0, 20).concat([50, 60, 70, 80]);
  function makeChart(card) {
    var box = $('.grafiek__bars', card), axis = $('[data-c="axis"]', card), title = $('[data-c="title"]', card), sub = $('[data-c="sub"]', card);
    var top = $('.grafiek__as--20', card), low = $('.grafiek__as--15', card);
    var tabs = $$('.ptab', card), steps = $$('.pknop', card);
    var shown = 'dag', bars = [], swap = null, t0 = -1;
    function rnd(seed) { return function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
    // a calm period: an evening charge now and then, no peaks (seeded, so it is the same every time)
    function calm(m, seed) {
      var M = MODES[m], r = rnd(seed), out = [], base = 26 + r() * 8, per = m === 'week' ? 4 : 1;
      for (var j = 0; j < M.n; j++) {
        var v = base + Math.sin(j / M.n * Math.PI * 2 + 1.3) * 8 + r() * 8;
        if (per > 1 && j % per === 3 && r() < 0.7) v += 34 + r() * 22;              // the evening's charge, most days
        if (per === 1 && r() < 0.28) v += 26 + r() * 30;
        out.push(Math.max(16, Math.min(104, v)));
      }
      return out;
    }
    var SETS = {
      dag:   function () { return { m: 'dag', vals: H1.slice(), cols: H1.map(function (_, j) { return j === 23 ? GREEN_ON : GREEN; }), sub: 'zonder incident · vandaag', warn: false }; },
      week:  function () { var v = calm('week', 5); return { m: 'week', vals: v, cols: v.map(function (_, j) { return j === v.length - 1 ? GREEN_ON : GREEN; }), sub: 'zonder incident · deze week', warn: false }; },
      maand: function () { var v = calm('maand', 17); return { m: 'maand', vals: v, cols: v.map(function (_, j) { return j === v.length - 1 ? GREEN_ON : GREEN; }), sub: 'zonder incident · deze maand', warn: false }; },
      warn:  function () { return { m: 'dag', vals: H2.slice(), cols: H2.map(function (_, j) { return j >= 20 ? ORANGE : GREEN; }), sub: 'warmer dan normaal · nu', warn: true }; },
      // v36: V11 H3, oververhit: +37° in two hours, the last hours in red
      heet:  function () { var v = H2.slice(0, 18).concat([62, 78, 92, 104, 112, 118]); return { m: 'dag', vals: v, cols: v.map(function (_, j) { return j >= 18 ? RED : GREEN; }), sub: 'oververhit · +37° in 2 uur', subc: '#ec6a5c', ax: ['80°', '40°'], warn: true }; }
    };
    function build(key) {
      var d = SETS[key](), M = MODES[d.m];
      box.innerHTML = ''; bars = [];
      d.vals.forEach(function (v, j) { var b = document.createElement('i'); b.style.setProperty('--h', v + 'px'); b.style.setProperty('--c', d.cols[j]); b.style.setProperty('--w', M.w + 'px'); box.appendChild(b); bars.push(b); });
      axis.innerHTML = M.axis.map(function (a, j) { return '<p' + (j === M.axis.length - 1 ? ' class="nu"' : '') + '>' + a + '</p>'; }).join('');
      title.textContent = M.span; sub.textContent = d.sub; sub.style.color = d.subc || (d.warn ? '#f0b65a' : '');
      // the temperatures beside the chart, as in Figma: 20° and 15° when all is normal (H1), 40° and 20° with attention (H2)
      top.textContent = d.ax ? d.ax[0] : d.warn ? '40°' : '20°'; low.textContent = d.ax ? d.ax[1] : d.warn ? '20°' : '15°';
      card.classList.toggle('is-warn', d.warn);
    }
    function mark(key) {
      var m = SETS[key]().m;
      tabs.forEach(function (t) { var on = t.getAttribute('data-mode') === m; t.classList.toggle('ptab--on', on); t.setAttribute('aria-pressed', String(on)); });
    }
    // show a period (or the day with attention): the bars sink, the new ones grow in
    function show(key) { if (key === shown) return; shown = key; mark(key); t0 = performance.now(); swap = key; }
    // v51: what you choose yourself holds (before, the scroll took the periods over again at once, which read as a glitch)
    var pick = null;
    tabs.forEach(function (t) { t.addEventListener('click', function () { pick = t.getAttribute('data-mode'); show(pick); }); });
    steps.forEach(function (b) { b.addEventListener('click', function () { var m = ORDER.indexOf(shown) < 0 ? 'dag' : shown; pick = ORDER[(ORDER.indexOf(m) + +b.getAttribute('data-step') + 3) % 3]; show(pick); }); });
    build('dag');
    return {
      show: show, pick: function () { return pick; },
      frame: function (p, now) {
        var r = 1, el = t0 < 0 ? 9 : (now - t0) / 1000;
        if (swap && el >= 0.22) { build(swap); swap = null; }
        bars.forEach(function (b, j) {
          var st = j * 0.0055 * 24 / bars.length, g = t0 >= 0 ? 1 : outCubic(seg(p, 0.47 + st, 0.5 + st));
          if (t0 >= 0) r = el < 0.22 ? 1 - smooth(el / 0.22) : outCubic(seg(el, 0.22 + j * 0.5 / bars.length, 0.62 + j * 0.5 / bars.length));
          b.style.setProperty('--g', (g * r).toFixed(3));
        });
      }
    };
  }

  /* =================================================================== the hero's dots: the app's swarm as particles with their own physics
     After the Archimedes site (dot-a-sim.ts): every dot keeps its place on the ring and carries an offset with
     Verlet integration; the pointer drags a quiet wake through them (pushed aside, a little along, a spring
     brings them back in about a second); when the headline comes in they splash apart and settle again.
     Drawn as soft round sprites, one per colour of the app's palette. */
  function makeDots(canvas, opt) {
    var ctx = canvas.getContext('2d'), N = opt.count, pal = opt.palette, dpr = 1;
    var r = (function (seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; })(opt.seed || 31);
    var gauss = function () { var u = 0; for (var i = 0; i < 4; i++) u += r(); return (u - 2) / 0.58; };
    var P = [];
    for (var k = 0; k < N; k++) P.push({ a: (k / N) * TAU + (r() - 0.5) * 0.05, u: clamp(gauss() * 0.62, -1.7, 1.7), s: 1.1 + r() * 1.2, o: 0.45 + r() * 0.55, c: k % 4,
      ph: r() * TAU, f: 0.6 + r() * 0.8, ox: 0, oy: 0, px: 0, py: 0, j: r() });
    // the sprites: a soft disc per colour, drawn at device pixels
    var SP = 48, sprites = pal.map(function (hex) {
      var c = document.createElement('canvas'); c.width = c.height = SP; var g = c.getContext('2d');
      var gr = g.createRadialGradient(SP / 2, SP / 2, 0, SP / 2, SP / 2, SP / 2);
      gr.addColorStop(0, hex); gr.addColorStop(0.55, hex); gr.addColorStop(1, hex + '00');
      g.fillStyle = gr; g.fillRect(0, 0, SP, SP); return c;
    });
    var mouse = { x: -1e4, y: -1e4, dx: 0, dy: 0, str: 0, t: 0 }, W = 0, H = 0, tm = 0, spin = 0;
    function size() { dpr = Math.min(2, devicePixelRatio || 1); W = canvas.clientWidth; H = canvas.clientHeight; fit(canvas, W * dpr, H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size(); addEventListener('resize', size);
    function pointer(x, y, now) {
      var dt = Math.max(0.004, (now - mouse.t) / 1000), vx = (x - mouse.x) / dt, vy = (y - mouse.y) / dt, sp = Math.hypot(vx, vy);
      if (mouse.x < -1000) { vx = vy = sp = 0; }
      mouse.x = x; mouse.y = y; mouse.t = now;
      if (sp > 0) { mouse.dx = vx / sp; mouse.dy = vy / sp; }
      mouse.str = Math.max(mouse.str, clamp(sp / 900, 0.5, 1));
    }
    var host = opt.host || canvas;
    host.addEventListener('pointermove', function (e) { var b = canvas.getBoundingClientRect(); pointer(e.clientX - b.left, e.clientY - b.top, performance.now()); }, { passive: true });
    host.addEventListener('pointerleave', function () { mouse.x = -1e4; mouse.y = -1e4; mouse.str = 0; });
    var burstAt = -1;
    return {
      burst: function () { burstAt = 0; },                                    // the splash: an impulse outward, each dot its own
      step: function (dt, cx, cy, R, alpha, loose, born, lights) {
        born = born == null ? 1 : born;
        tm += dt; spin += dt * 0.06;
        var SPRING = 11, DAMP = 4.2, keep = Math.exp(-DAMP * dt), push = R * 7, rad = Math.max(40, R * 0.22);
        mouse.str *= Math.exp(-dt * 6);                                      // the wake fades as soon as the pointer rests
        var doBurst = burstAt === 0; if (doBurst) burstAt = 1;
        ctx.clearRect(0, 0, W, H);
        if (alpha < 0.005) return;
        var sc = Math.pow(R / 121, 0.5);
        for (var i = 0; i < N; i++) {
          var p = P[i], ang = p.a + spin + Math.sin(tm * 0.21 + p.ph) * 0.004;
          var br = 1 + p.u * 0.09 + Math.sin(tm * p.f + p.ph) * 0.012;
          var dx = Math.cos(ang), dy = Math.sin(ang);
          var bx = cx + dx * R * br, by = cy + dy * R * br;
          // the wake of the pointer
          var sx = bx + p.ox, sy = by + p.oy, mx = sx - mouse.x, my = sy - mouse.y, dist = Math.hypot(mx, my);
          var f = dist < rad * 3 ? Math.exp(-(dist / rad) * (dist / rad) * 1.5) * mouse.str : 0;
          var ax = 0, ay = 0;
          if (f > 0.001) { var ux = mx / Math.max(dist, 1), uy = my / Math.max(dist, 1); ax = mix(ux, mouse.dx, 0.12) * f * push; ay = mix(uy, mouse.dy, 0.12) * f * push; }
          ax -= SPRING * p.ox; ay -= SPRING * p.oy;
          if (doBurst) { var v = R * (2.2 + p.j * 2.6), tdir = (p.j - 0.5) * 0.9; p.px = p.ox - (dx * Math.cos(tdir) - dy * Math.sin(tdir)) * v * dt; p.py = p.oy - (dy * Math.cos(tdir) + dx * Math.sin(tdir)) * v * dt; }
          var nx = p.ox + (p.ox - p.px) * keep + ax * dt * dt, ny = p.oy + (p.oy - p.py) * keep + ay * dt * dt;
          p.px = p.ox; p.py = p.oy; p.ox = nx; p.oy = ny;
          // loose: scattered outward as the page scrolls on
          var lx = dx * loose * R * (0.6 + p.u * 0.3), ly = dy * loose * R * (0.6 + p.u * 0.3);
          var x = bx + p.ox + lx, y = by + p.oy + ly, rr = p.s * sc * 1.15, d2 = rr * 2.4;
          // born: from the nearest of the twelve lights, each dot a little later than the one before it
          var bo = 1;
          if (born < 1 && lights) {
            var kq = clamp((born - p.j * 0.45) / 0.55, 0, 1), eo = 1 - Math.pow(1 - kq, 3), Lq = lights[Math.round(((ang % TAU + TAU) % TAU) / TAU * 12) % 12];
            x = mix(Lq[0], x, eo); y = mix(Lq[1], y, eo); bo = 0.2 + 0.8 * kq;
          }
          ctx.globalAlpha = p.o * alpha * bo * (1 - loose * 0.7) * (0.84 + 0.16 * Math.sin(tm * 1.6 * p.f + p.ph));
          ctx.drawImage(sprites[p.c], x - d2 / 2, y - d2 / 2, d2, d2);
        }
        ctx.globalAlpha = 1;
      }
    };
  }


  /* =================================================================== the partners: a quiet field of dots (stellar.org), twinkling slowly */
  (function () {
    var c = $('.partners__field'); if (!c) return;
    var ctx = c.getContext('2d'), N = narrow.matches ? 900 : 2200, D = [], W = 0, H = 0, on = false, last = 0, t = 0;
    var seed = 77, r = function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (var i = 0; i < N; i++) { var x = r(), y = r(); D.push([x, y, 0.4 + r() * 1.1, r() * TAU, 0.2 + r() * 0.6, r() < 0.14]); }
    function size() { var d = Math.min(2, devicePixelRatio || 1); W = c.clientWidth; H = c.clientHeight; var ch = fit(c, W * d, H * d); ctx.setTransform(d, 0, 0, d, 0, 0); if (ch) draw(); }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < N; i++) {
        var p = D[i], dens = 0.35 + 0.65 * Math.pow(Math.sin(p[0] * Math.PI * 0.9 + 0.3), 2);   // denser towards the middle, as theirs
        var a = p[4] * dens * (reduce ? 1 : 0.6 + 0.4 * Math.sin(t * (0.6 + p[4]) + p[3]));
        ctx.fillStyle = p[5] ? 'rgba(130,185,142,' + a.toFixed(3) + ')' : 'rgba(236,238,242,' + (a * 0.8).toFixed(3) + ')';
        ctx.fillRect(p[0] * W, p[1] * H, p[2], p[2]);
      }
    }
    function loop(now) { if (!on) return; t += Math.min(0.05, (now - last) / 1000); last = now; draw(); requestAnimationFrame(loop); }
    size(); addEventListener('resize', size);
    if ('IntersectionObserver' in window && !reduce) new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && !on) { on = true; last = performance.now(); requestAnimationFrame(loop); } else if (!e.isIntersecting) on = false; }); }).observe(c);
  })();

  /* =================================================================== 1 · the hero (v37, after the team's video of 14 Oct)
     Ember close up, its twelve lights coming on one by one. On the first scroll fine dots spray straight out of the
     lights, as sparks, into a cloud around Ember; the cloud settles into a thick ring (a torus, in 3D) round the button
     that turns slowly while the camera pulls back. Scrolling on, the ring tilts in 3D and travels to the statement,
     where it folds into a brain of dots: the model that learns what is normal. A dot over the white is dark (red, ink
     or grey, as in the reference), over the black it is light, wherever it is on its way. From the statement the dots
     stream down into Ember's lights on the bike. One fixed canvas carries them from the hero to the bike. */
  // the brain, drawn as a side view and given depth: the outline, the main sulci (dots on both banks, the channel
  // empty), a sparse fill in the gyri, the cerebellum with fine folia, and a faint echo of the far hemisphere.
  // x front (-1) to back (1), y top (-0.7) to bottom (0.5), z towards you (+)
  function makeBrain(n, r) {
    // v59: the brain as bands of dots along its gyri (3d/brain_points.py, after the references of 15 Oct): the edge,
    // the gyri as a maze, the cerebellum, the stem, no loose dots under it; the dots the brain does not need fade
    // out as it forms (the fifth value: 0), so the folds stay open; each dot has its shade in the data (the fourth value)
    var BD = window.EMBER_BRAIN;
    if (BD && BD.d) {
      var pool = n < 3000 ? BD.m : BD.d, res = [];
      function zb(x, y) { return 0.5 * Math.sqrt(Math.max(0, 1 - Math.pow(x / 1.02, 2) - Math.pow((y + 0.08) / 0.74, 2))); }
      function sh(pd, pg) { var u = r(); return u < pd ? 1 : u < pd + pg ? 0 : 2; }
      for (var bi = 0; bi < n; bi++) {
        var P = pool[bi];
        if (!P) { res.push([(r() * 2 - 1) * 0.85, r() * 1.0 - 0.6, 0, 2, 0]); continue; }
        var px = P[0], py = P[1], kd = P[2];
        var pz = kd === 2 ? 0.18 * Math.sqrt(Math.max(0, 1 - Math.pow((px - 0.62) / 0.34, 2) - Math.pow((py - 0.47) / 0.18, 2))) : kd === 3 ? 0.06 : kd === 4 ? (r() - 0.5) * 0.4 : zb(px, py) * 0.8;
        res.push([px, py, pz, P[3] != null ? P[3] : kd === 4 ? 2 : kd === 0 ? sh(0.46, 0.3) : kd === 2 ? sh(0.5, 0.25) : kd === 3 ? sh(0.3, 0.3) : sh(0.4, 0.38), 1]);
      }
      return res;
    }
    function cr(P0, closed, k) {                                   // Catmull-Rom through the points
      var P = closed ? [P0[P0.length - 1]].concat(P0, [P0[0], P0[1]]) : [P0[0]].concat(P0, [P0[P0.length - 1]]), out = [];
      for (var i = 1; i < P.length - 2; i++) for (var j = 0; j < k; j++) {
        var t = j / k, t2 = t * t, t3 = t2 * t, a = P[i - 1], b = P[i], c = P[i + 1], d = P[i + 2];
        out.push([0, 1].map(function (m) { return 0.5 * (2 * b[m] + (-a[m] + c[m]) * t + (2 * a[m] - 5 * b[m] + 4 * c[m] - d[m]) * t2 + (-a[m] + 3 * b[m] - 3 * c[m] + d[m]) * t3); }));
      }
      if (!closed) out.push(P0[P0.length - 1]);
      return out;
    }
    var OL = cr([[-0.86, 0.16], [-0.98, -0.06], [-0.93, -0.32], [-0.72, -0.55], [-0.38, -0.68], [0.02, -0.71], [0.40, -0.63], [0.70, -0.46], [0.92, -0.20], [0.99, 0.06],
                 [0.90, 0.24], [0.64, 0.30], [0.40, 0.36], [0.12, 0.50], [-0.20, 0.51], [-0.42, 0.42], [-0.52, 0.26], [-0.66, 0.21]], true, 20);
    OL.push(OL[0]);
    var SL = [[[-0.52, 0.23], [-0.22, 0.13], [0.12, 0.06], [0.36, -0.02], [0.50, -0.14]],        // the lateral fissure
              [[0.04, -0.70], [0.0, -0.46], [-0.07, -0.26], [-0.12, -0.06], [-0.17, 0.10]],     // central
              [[-0.18, -0.67], [-0.23, -0.43], [-0.30, -0.21], [-0.35, 0.0]],                   // precentral
              [[0.22, -0.66], [0.19, -0.43], [0.13, -0.23], [0.09, -0.05]],                     // postcentral
              [[-0.27, -0.52], [-0.50, -0.47], [-0.74, -0.30]], [[-0.40, -0.14], [-0.60, -0.10], [-0.84, 0.0]],   // frontal
              [[-0.40, 0.33], [-0.10, 0.28], [0.20, 0.20], [0.42, 0.10]], [[-0.26, 0.43], [0.04, 0.41], [0.30, 0.31]],   // temporal
              [[0.26, -0.36], [0.46, -0.39], [0.66, -0.26], [0.80, -0.06]], [[0.58, 0.12], [0.80, 0.05]],
              // v59: the smaller folds that make it read as a brain rather than a diagram
              [[-0.36, -0.33], [-0.52, -0.29], [-0.68, -0.17]], [[-0.56, -0.58], [-0.66, -0.47], [-0.62, -0.40]], [[-0.78, -0.16], [-0.90, -0.06]],   // frontal
              [[-0.07, -0.30], [-0.21, -0.27], [-0.28, -0.31]], [[0.12, -0.25], [0.25, -0.21], [0.30, -0.26]], [[-0.24, -0.44], [-0.38, -0.47]],     // branches off the central folds
              [[0.30, -0.56], [0.44, -0.54], [0.54, -0.44]], [[0.70, -0.42], [0.82, -0.30], [0.86, -0.20]], [[0.60, -0.04], [0.74, 0.0], [0.88, -0.06]],   // parietal, occipital
              [[0.74, 0.14], [0.88, 0.16]], [[-0.62, 0.30], [-0.46, 0.25]], [[-0.10, 0.46], [0.10, 0.45]]                                              // occipital pole, temporal tip, under the temporal lobe
             ].map(function (s, si) { return wind(cr(s, false, 18), si); });
    // every fold winds a little, as on a real brain (a slow wave across its length, its own phase)
    function wind(L, si) {
      var out = [], s = 0, ph = si * 2.39, A = 0.016 + (si % 3) * 0.004;
      for (var i = 0; i < L.length; i++) {
        if (i) s += Math.hypot(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]);
        var a = L[Math.max(0, i - 1)], b = L[Math.min(L.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], dl = Math.hypot(dx, dy) || 1;
        var w = A * Math.sin(s / 0.085 + ph);
        out.push([L[i][0] - dy / dl * w, L[i][1] + dx / dl * w]);
      }
      return out;
    }
    function inside(x, y) { var c = false; for (var i = 0, m = OL.length - 1; i < m; i++) { var a = OL[i], b = OL[i + 1]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
    function dsul(x, y) { var best = 9; SL.forEach(function (L) { L.forEach(function (q) { var d = Math.hypot(x - q[0], y - q[1]); if (d < best) best = d; }); }); return best; }
    function lens(L) { var s = [], T = 0; for (var i = 0; i < L.length - 1; i++) { var d = Math.hypot(L[i + 1][0] - L[i][0], L[i + 1][1] - L[i][1]); s.push(d); T += d; } return { s: s, T: T }; }
    var OLl = lens(OL), SLl = SL.map(lens), ST = SLl.reduce(function (a, b) { return a + b.T; }, 0);
    function along(L, ll) {
      var s = r() * ll.T;
      for (var i = 0; i < ll.s.length; i++) { var d = ll.s[i]; if (s <= d || i === ll.s.length - 1) { var f = clamp(s / d, 0, 1), a = L[i], b = L[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, -(b[1] - a[1]) / d, (b[0] - a[0]) / d]; } s -= d; }
    }
    function zof(x, y, side) { return side * 0.5 * Math.sqrt(Math.max(0, 1 - Math.pow(x / 1.02, 2) - Math.pow((y + 0.08) / 0.74, 2))); }
    var few = n < 3000;   // v59: a phone has fewer dots: more of them on the folds and the outline, fewer in the loose fill
    var out = [], nO = Math.round(n * (few ? 0.22 : 0.2)), nS = Math.round(n * (few ? 0.58 : 0.46)), nF = Math.round(n * (few ? 0.1 : 0.2)), nC = 0, x, y, g;   // v59: more on the folds' banks   // v55: no cerebellum (the extra bump under the brain); its dots go to the folds and the fill
    function shade(pd, pg) { var u = r(); return u < pd ? 1 : u < pd + pg ? 0 : 2; }   // v59
    while (out.length < nO) { g = along(OL, OLl); var k = r() * 0.8; x = g[0] * (1 - 0.03 * k); y = (g[1] + 0.08) * (1 - 0.03 * k) - 0.08; out.push([x, y, zof(x, y, 1) * r() * 0.35, shade(0.38, 0.34)]); }
    while (out.length < nO + nS) {
      var q = r() * ST, i = 0; while (q > SLl[i].T && i < SL.length - 1) { q -= SLl[i].T; i++; }
      g = along(SL[i], SLl[i]); var off = (r() < 0.5 ? -1 : 1) * (0.032 + Math.abs(r() + r() - 1) * 0.045), tj = (r() - 0.5) * 0.03;   // loose banks, not stitched rows
      x = g[0] + g[2] * off - g[3] * tj; y = g[1] + g[3] * off + g[2] * tj; if (inside(x, y)) out.push([x, y, zof(x, y, 1) + (r() - 0.5) * 0.06, shade(0.52, 0.3)]);
    }
    while (out.length < nO + nS + nF) { x = r() * 2 - 1; y = r() * 1.24 - 0.72; if (inside(x, y) && dsul(x, y) > 0.05) out.push([x, y, zof(x, y, 1), shade(0.14, 0.34)]); }
    while (out.length < nO + nS + nF + nC) {                     // the cerebellum: its rim and fine horizontal folia
      if (r() < 0.4) { var a = r() * TAU; x = 0.62 + 0.29 * Math.cos(a); y = 0.47 + 0.16 * Math.sin(a); }
      else { var yy = 0.31 + (1 + Math.floor(r() * 5)) * 0.32 / 6, w = 0.29 * Math.sqrt(Math.max(0, 1 - Math.pow((yy - 0.47) / 0.16, 2))); x = 0.62 + (r() * 2 - 1) * w; y = yy + 0.012 * Math.sin(x * 30); }
      out.push([x, y, 0.32 * Math.sqrt(Math.max(0, 1 - Math.pow((x - 0.62) / 0.3, 2) - Math.pow((y - 0.47) / 0.17, 2)))]);
    }
    while (out.length < n) { x = r() * 2 - 1; y = r() * 1.24 - 0.72; if (inside(x, y)) out.push([x, y, zof(x, y, -1), shade(0.08, 0.22)]); }   // the far hemisphere
    for (var j = out.length - 1; j > 0; j--) { var m = Math.floor(r() * (j + 1)), tmp = out[j]; out[j] = out[m]; out[m] = tmp; }   // every part takes atoms from all round the ring
    return out;
  }

  var heroSec = $('.hero');
  if (heroSec) (function () {
    var stage = $('.hero__stage', heroSec), word = $('.hero__word', heroSec), ember = $('.hero__ember', heroSec), lc = $('.hero__lights', heroSec), lctx = lc.getContext('2d');
    var copy = $('.hero__copy', heroSec), fx = $('.flow'), ctx = fx.getContext('2d'), quote = $('.quote'), anchor = $('.quote__cloud');
    var TRAVEL = 0.9;
    function mixc(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]; }
    function rgb(c) { return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; }
    function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    var smoother = function (x) { return x * x * x * (x * (x * 6 - 15) + 10); };
    var LED = 'rgb(255,248,236)';
    // the tones: on the black a few whites and greys (the video); on the white the app's green (v38: instead of the
    // reference's red), ink and grey
    var TONE = [[246, 246, 248], [208, 211, 216], [156, 160, 167]], INK = [[63, 138, 83], [40, 42, 46], [182, 184, 190]];
    // v39: more atoms, a little smaller, and the same ones at the same size from the ring into the brain
    var N = innerWidth < 760 ? 2800 : 6400, r = rng(20261014), BR = makeBrain(N, rng(1014)), sw = [];   // v46: more dots, the density of the circle
    // v45: the shape the dots fold into on the statement, to choose from: brein (the default), cirkel (the app's green ring),
    // blob (a cloud that keeps changing shape, the dots drifting over it) or bol (a sphere with signals running over it)
    var VORM = ((location.search.match(/[?&]vorm=(brein|cirkel|blob|bol)(?:&|$)/) || [])[1]) || 'brein';   // v51: the brain again (team feedback), with the sphere's fine dots   // v46: the sphere, chosen
    // per shape the tones on the white: the brain's green, ink and grey; the circle in the app's greens; the sphere grey, its signals green
    var INKV = { brein: INK, cirkel: [[63, 138, 83], [96, 164, 115], [150, 197, 160]], blob: INK, bol: [[120, 123, 130], [64, 66, 72], [170, 173, 180]] };
    var GREENP = [63, 138, 83];
    var BDS = window.EMBER_BRAIN && VORM === 'brein' ? ((window.EMBER_BRAIN.s || { m: 0.029, d: 0.0175 })[N < 3000 ? 'm' : 'd']) : 0;   // v59: the spacing of the dots in the brain (3d/brain_points.py)
    var BRK = Math.sqrt((innerWidth < 760 ? 2400 : 4400) / N) * (innerWidth < 760 ? 0.86 : 1);   // v55: the v44 brain's ink at today's number of dots; on a phone a little finer, so the folds stay open
    function n3(x, y, z, t) { return Math.sin(1.7 * x + 1.1 * t) * Math.sin(2.1 * y - 0.8 * t) * Math.sin(1.9 * z + 0.6 * t) + 0.5 * Math.sin(3.1 * x + 2.3 * y + 1.3 * t) * Math.sin(2.7 * z - 0.9 * t); }
    // the signals on the sphere: a few origins, each a front that runs out over the surface every few seconds
    // v46: eight origins, each with its own period, so that several fronts run over the sphere at once and cross
    var SIG = (function () { var rs = rng(46), out = []; for (var k = 0; k < 8; k++) { var v = [rs() * 2 - 1, rs() * 2 - 1, rs() * 2 - 1], l = Math.hypot(v[0], v[1], v[2]) || 1; out.push({ o: [v[0] / l, v[1] / l, v[2] / l], per: 4.2 + rs() * 4.5, off: rs() * 9 }); } return out; })();
    // and orbits: seven great circles at their own tilts; part of the dots flows along them, so lines cross over the sphere
    var ORB = (function () { var rs = rng(4646), out = []; for (var k = 0; k < 7; k++) {
      var n = [rs() * 2 - 1, rs() * 2 - 1, rs() * 2 - 1], l = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / l, n[1] / l, n[2] / l];
      var a = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], e1 = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]], l1 = Math.hypot(e1[0], e1[1], e1[2]); e1 = [e1[0] / l1, e1[1] / l1, e1[2] / l1];
      var e2 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]];
      out.push({ e1: e1, e2: e2, sp: (0.08 + rs() * 0.14) * (rs() < 0.5 ? -1 : 1), r: 1.0 + (rs() - 0.5) * 0.12 }); } return out; })();
    for (var i = 0; i < N; i++) {
      var tr = Math.min(0.26, Math.abs(r() + r() + r() - 1.5) * 0.12);
      sw.push({ a: r() * TAU, tb: r() * TAU, tr: tr, u: r(), jit: (r() - 0.5) * (r() < 0.8 ? 0.22 : 0.8), sd: 0.3 + r() * 0.9, size: 0.55 + r() * 0.8, sz2: 0.6 + r() * 0.75,
        ox: 0, oy: 0, qx: 0, qy: 0, tone: r() < 0.55 ? 0 : r() < 0.7 ? 1 : 2, ink: r() < 0.36 ? 0 : r() < 0.53 ? 1 : 2, f1: 0.3 + r() * 0.5, p1: r() * TAU, pace: 0.75 + r() * 0.5, ph: r() * TAU, br: BR[i] });
      // a place on a sphere (a Fibonacci spiral: evenly spread), for the blob and the sphere; a place in a ring, for the circle
      var fy = 1 - 2 * (i + 0.5) / N, fr = Math.sqrt(1 - fy * fy), fa = i * 2.399963;
      var jx = (r() - 0.5) * 0.09, jy = (r() - 0.5) * 0.09, jz = (r() - 0.5) * 0.09, sx0 = Math.cos(fa) * fr + jx, sy0 = fy + jy, sz0 = Math.sin(fa) * fr + jz, sl = Math.hypot(sx0, sy0, sz0) / (0.96 + r() * 0.08);   // a little scatter: a cloud, not a mesh
      sw[i].sp = [sx0 / sl, sy0 / sl, sz0 / sl]; sw[i].cr = (r() + r() + r() - 1.5) * 0.12; sw[i].cz = (r() - 0.5) * 0.3;
      // v47: every dot on its own circle round the centre (a great circle through its place, at a tilt of its own), so all of
      // them keep circling and no line of dots stands out
      var q2 = [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1], e = sw[i].sp, dq = q2[0] * e[0] + q2[1] * e[1] + q2[2] * e[2];
      q2 = [q2[0] - dq * e[0], q2[1] - dq * e[1], q2[2] - dq * e[2]]; var lq = Math.hypot(q2[0], q2[1], q2[2]) || 1;
      sw[i].e2 = [q2[0] / lq, q2[1] / lq, q2[2] / lq]; sw[i].osp = (0.05 + r() * 0.09) * (r() < 0.5 ? -1 : 1);
      sw[i].orb = -1; sw[i].ow = (r() + r() - 1) * 0.035;
    }

    var W = 0, H = 0, DPR = 1, L = {};
    function layout() {
      W = stage.clientWidth; H = stage.clientHeight; DPR = Math.min(2, devicePixelRatio || 1);
      fit(lc, W * DPR, H * DPR);
      fit(fx, (fx.clientWidth || innerWidth) * DPR, (fx.clientHeight || innerHeight) * DPR);   // v51: the canvas's own size (100svh), not the window's, which moves with the address bar
      var nar = narrow.matches;
      // Ember close up (its top a third down, the lower half below the edge, as asked); the whole product at the end
      // v21: on a phone Ember is smaller and higher, so that it ends above the headline instead of under it
      L.L0 = nar ? Math.min(H * 0.6, W * 1.35) : H * 1.1; L.y0 = (nar ? 0.15 : 0.3) * H + L.L0 * 0.5;
      L.L1 = nar ? Math.min(H * 0.5, W * 0.7) : Math.min(H * 0.64, W * 0.42); L.y1 = (nar ? 0.42 : 0.52) * H;
      // v37: the ring stands round the button (the video); on a phone round the whole product (v21)
      L.SR = nar ? Math.min(W * 0.42, H * 0.3) : Math.min(W * 0.26, H * 0.29);
    }
    var GO = 0, MQ = 0, DV = 0, seqEl = $('.seq');
    var P = 0, Pt = 0, formT = reduce ? 1 : 0, turn = 0, introT = reduce ? 9 : 0, lastT = 0, lastY = scrollY, vAny = 0, t0 = performance.now();
    var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    // v38: you can move through the dots: they part round the pointer (more the faster it moves) and spring back
    var pm = { x: -1e4, y: -1e4, dx: 0, dy: 0, str: 0, t: 0, on: false };
    addEventListener('pointermove', function (e) {
      var now = performance.now(), dtp = Math.max(0.008, (now - pm.t) / 1000), vx = (e.clientX - pm.x) / dtp, vy = (e.clientY - pm.y) / dtp, sp = Math.hypot(vx, vy);
      if (!pm.on) sp = 0;
      if (sp > 0) { pm.dx = vx / sp; pm.dy = vy / sp; }
      pm.x = e.clientX; pm.y = e.clientY; pm.t = now; pm.on = true; pm.str = Math.max(pm.str, clamp(sp / 1200, 0.4, 1));
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () { pm.on = false; pm.x = pm.y = -1e4; });
    quote.addEventListener('pointermove', function (e) { mouse.tx = clamp(e.clientX / innerWidth - 0.5, -0.5, 0.5); mouse.ty = clamp(e.clientY / innerHeight - 0.5, -0.5, 0.5); }, { passive: true });
    function progress() { var r0 = heroSec.getBoundingClientRect(); return clamp(-r0.top / (stage.clientHeight || innerHeight), 0, TRAVEL); }

    function frame(now) {
      var dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
      Pt = progress(); var dd = Pt - P; P = Math.abs(dd) < 0.0005 ? Pt : P + dd * (1 - Math.exp(-dt * 13));
      if (introT < 9) { introT += dt; if (introT > 2.2) introT = 9; }
      var sy = scrollY, v = dt > 0 ? (sy - lastY) / dt / innerHeight : 0; lastY = sy;
      vAny += (Math.abs(v) - vAny) * Math.min(1, dt * 6);
      var on = P >= 0.03;
      if (!reduce) formT = clamp(formT + (on ? dt / 4.2 : -dt / 1.6), 0, 1);   // v52: slower, calmer
      if (!reduce) turn += dt * (0.16 + Math.min(vAny, 3) * 0.45);
      var nar = narrow.matches, p = reduce ? TRAVEL : P, formK = smoother(formT), t = (now - t0) / 1000;

      /* ---- the camera pulls back; Ember steps back a little as the atoms come out, and stays ---- */
      var z = inOut(seg(p, 0.04, 1.25));
      var len = lmix(L.L0, L.L1, z), cy = mix(L.y0, L.y1, z);
      var away = reduce ? 1 : Math.max(smoother(clamp((formT - 0.2) / 0.8, 0, 1)), smooth(seg(p, 0.3, 1.0)));
      var back = 1 - 0.2 * away;
      len *= back; cy += len * 0.5 * (1 - back) * 0.4;
      var sc = len / SPR.len, EM = pose(W * 0.5, cy, sc, 0);
      ember.style.transform = css(EM); ember.style.opacity = (1 - 0.12 * away).toFixed(3);
      word.style.setProperty('--ws', (1.06 - 0.12 * z - 0.03 * formK).toFixed(4));
      word.style.opacity = ((1 - 0.3 * formK) * (1 - (reduce ? 0 : smooth(seg(p, TRAVEL - 0.62, TRAVEL - 0.35))))).toFixed(3);
      var heroOp = reduce ? 1 : Math.min(1 - smooth(seg(p, 0.12, 0.42)), 1 - smooth(clamp(formT / 0.5, 0, 1)));
      copy.style.opacity = heroOp.toFixed(3); copy.style.transform = 'translate3d(0,' + (-(1 - heroOp) * 18).toFixed(1) + 'px,0)'; copy.style.visibility = heroOp < 0.01 ? 'hidden' : 'visible';

      /* ---- the twelve lights: on at arrival, lighting up as you scroll (v57: without a glow round them) ---- */
      lctx.setTransform(DPR, 0, 0, DPR, 0, 0); lctx.clearRect(0, 0, W, H);
      var pts = [], lr = 1.0 * SPR.mm * sc, flare = reduce ? 0 : smooth(clamp(formT / 0.25, 0, 1)) * (1 - smooth(seg(formT, 0.45, 0.95)));
      for (var k = 0; k < 12; k++) {
        var la = (90 - 30 * k) * Math.PI / 180, L2 = apply(EM, SPR.cx + 10.6 * Math.cos(la) * SPR.mm, SPR.cy - (22.4 + 10.6 * Math.sin(la)) * SPR.mm);
        pts.push(L2);
        var o = introT >= 9 ? 1 : smooth(seg(introT, 0.35 + k * 0.085, 0.53 + k * 0.085));
        if (o < 0.01) continue;
        // v57: no glow round the lights any more (it ran together between them as a haze); the lights themselves come on
        // v57: dimmed at rest; as you start to scroll they light up one after the other, round like a clock (the top one
        // first), bright and a touch larger; crisp, no glow
        var lit = reduce ? 1 : smooth(clamp((formT - k * 0.018) / 0.07, 0, 1));
        lctx.globalAlpha = o * (0.3 + 0.7 * lit); lctx.fillStyle = 'rgb(255,' + Math.round(246 + 9 * lit) + ',' + Math.round(232 + 23 * lit) + ')';
        lctx.beginPath(); lctx.arc(L2[0], L2[1], lr * (0.82 + 0.22 * lit), 0, TAU); lctx.fill(); lctx.globalAlpha = 1;
      }

      /* ---- the atoms (the fixed layer: stage coordinates plus where the stage is now) ---- */
      var IW = innerWidth, IH = innerHeight;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, IW, IH);
      var form = reduce ? 1 : formK;
      // the dots leave the brain with the statement and dive into Ember in the section under it, into its lights
      var seqR = seqEl.getBoundingClientRect(), dEnd = 0.85 * IH - 0.12 * SEQK * (seqR.height - 0.15 * IH);
      var dvT = reduce || !dock.ok ? 0 : clamp((IH - seqR.top) / Math.max(IH - dEnd, 1), 0, 1);
      DV += (dvT - DV) * (1 - Math.exp(-dt * 6)); if (Math.abs(dvT - DV) < 0.002) DV = dvT;
      if (form > 0.001 && DV < 1) {
        var sr = stage.getBoundingClientRect(), ox = sr.left, oy = sr.top, ar = anchor.getBoundingClientRect(), qr = quote.getBoundingClientRect();
        var B = apply(EM, SPR.cx, SPR.cy - 22.4 * SPR.mm), lights = { c: [ox + B[0], oy + B[1]], r: lr, pts: pts.map(function (q) { return [ox + q[0], oy + q[1]]; }) };
        var SC = [ar.left + ar.width / 2, ar.top + ar.height / 2];
        var goT = reduce ? 0 : seg(p, 0.5, TRAVEL), mT = clamp(1 - qr.top / IH, 0, 1), kS = 1 - Math.exp(-dt * 5);
        GO += (goT - GO) * kS; MQ += (mT - MQ) * kS;
        var go = smoother(GO), m = smoother(MQ), sMorph = clamp(smoother(seg(GO, 0.4, 1)) * 0.3 + smoother(seg(MQ, 0.05, 0.75)) * 0.7, 0, 1);
        // the ring keeps its place on the screen while the hero scrolls away, until the brain's place comes up under it
        var C0 = nar ? [ox + W / 2, Math.max(oy, 0) + L.y1] : [lights.c[0], Math.max(oy, 0) + (lights.c[1] - oy)];
        var sink = C0[1] + IH * (0.12 * go + 0.1 * m), kM = IH * 0.035;
        var Cy = Math.min(sink, SC[1]) - kM * Math.log(1 + Math.exp(-Math.abs(sink - SC[1]) / kM));
        var Cc = [mix(C0[0], SC[0], mix(0.45 * go, 1, m)), Cy];
        var R = L.SR * mix(1, 0.86, go), pull = 1 - form;
        // the ring's own turn in 3D: a slight tilt round the button, tumbling as it travels (the video)
        var rxT = 0.2 + 1.05 * go + 0.25 * m, ryT = 0.55 * go + 0.2 * Math.sin(t * 0.3) * go, crx = Math.cos(rxT), srx = Math.sin(rxT), cry = Math.cos(ryT), sry = Math.sin(ryT), F = 3.2;
        // the brain: as wide as most of its box, turning slowly between an oblique view from the front and the side
        mouse.x += (mouse.tx - mouse.x) * (1 - Math.exp(-dt * 3)); mouse.y += (mouse.ty - mouse.y) * (1 - Math.exp(-dt * 3));
        var SB = Math.min(ar.width * 0.44, ar.height * 0.66), ryB = BDS ? -0.06 + 0.07 * Math.sin(t * 0.21) + mouse.x * 0.2 : -0.38 + 0.3 * Math.sin(t * 0.21) + mouse.x * 0.6, rxB = BDS ? 0.03 + mouse.y * 0.1 : 0.1 + mouse.y * 0.3;   // v59: the drawn brain stays side on, as on the reference
        var cyB = Math.cos(ryB), syB = Math.sin(ryB), cxB = Math.cos(rxB), sxB = Math.sin(rxB), kB = mix(R / Math.max(SB, 1), 1, m);
        var dsc = Math.sqrt(Math.max(R, 60) / 240), batch = {};
        // v46: the signal fronts once a frame (where each is, as a cosine, and how strong); per dot only the ones near it count
        var SIGF = VORM !== 'bol' ? [] : SIG.map(function (Sg) { var cyc = ((t + Sg.off) % Sg.per) / Sg.per, front = cyc * Math.PI; return { o: Sg.o, f: front, cf: Math.cos(front), amp: 1 - cyc * 0.75 }; });
        pm.str = pm.on ? Math.max(0.4, pm.str * Math.exp(-dt * 3)) : 0;            // a gentle hollow while it rests, a wake when it moves
        var PR = nar ? 70 : 110, PR2 = PR * PR, PUSH = PR * 60, keep = Math.exp(-4.2 * dt), dt2 = dt * dt;
        for (var i2 = 0; i2 < sw.length; i2++) {
          var q0 = sw[i2];
          // the ring: a torus round the button, breathing a little
          var A = q0.a + turn * q0.pace, rr = (1 + q0.tr * Math.cos(q0.tb)) * (1 + (reduce ? 0 : Math.sin(t * q0.f1 + q0.p1) * 0.018)), X = rr * Math.cos(A), Y = rr * Math.sin(A), Zr = q0.tr * Math.sin(q0.tb) * 1.3;
          var x1 = X * cry + Zr * sry, z1 = -X * sry + Zr * cry, y1 = Y * crx - z1 * srx, z2 = Y * srx + z1 * crx, pz = F / (F + z2), near = clamp(0.5 - z2 * 0.35, 0, 1);
          var x = Cc[0] + x1 * R * pz, y = Cc[1] + y1 * R * pz;
          var op = (0.55 + 0.45 * near) * (q0.tone === 2 ? 0.8 : 1), rad = q0.size * (0.75 + 0.55 * near) * dsc;
          // v52: the dots come out of the lights and go straight to their place on the ring along a calm arc, turning a
          // little on the way (TWIST, clockwise); they never fly past the ring, so it does not grow and pull back (v51 sprayed)
          if (pull > 0) {
            var TWIST = 0.3, kk = Math.round(((((q0.a - TWIST + Math.PI / 2) % TAU) + TAU) % TAU) / TAU * 12) % 12, Lp = lights.pts[kk];
            var qq = clamp((form - q0.u * 0.45) / 0.55, 0, 1), e = smoother(qq);
            var a0 = Math.atan2(Lp[1] - Cc[1], Lp[0] - Cc[0]), r0 = Math.hypot(Lp[0] - Cc[0], Lp[1] - Cc[1]);
            var ar = Math.atan2(y - Cc[1], x - Cc[0]), rr = Math.hypot(x - Cc[0], y - Cc[1]);
            ar += TAU * Math.round((a0 + TWIST - ar) / TAU);
            var a3 = mix(a0, ar, e), r3 = mix(r0, rr, e) + Math.sin(Math.PI * e) * q0.jit * R * 0.2;
            x = Cc[0] + Math.cos(a3) * r3; y = Cc[1] + Math.sin(a3) * r3;
            op *= smooth(clamp(qq * 4, 0, 1)); rad *= mix(0.6, 1, qq);
            // v57: a dot shows only once it is a few millimetres off its light: hundreds of soft dots stacked on each light
            // read as a glow round it at the first scroll (the lights are about 1 mm, on a ring of 10,6 mm)
            var lmm = r0 / 10.6, dl = Math.hypot(x - Lp[0], y - Lp[1]); op *= smooth(clamp((dl - 1.6 * lmm) / (3.5 * lmm), 0, 1));
          }
          // the brain
          var w = smoother(clamp((sMorph - q0.u * 0.45) / 0.55, 0, 1)), sig = 0;
          if (w > 0) {
            var b3 = q0.br, dy0 = BDS ? -0.04 : 0.1;   // v59: the drawn brain reaches lower (cerebellum, stem)
            // v59: the dots of the brain keep moving a little, each round its own place (about a third of their spacing, every 4 to 6 s)
            if (BDS && VORM === 'brein' && !reduce) { var wa = BDS * 0.38, wt = t * (0.7 + q0.f1); b3 = [b3[0] + Math.sin(wt + q0.p1) * wa, b3[1] + Math.cos(wt * 0.86 + q0.ph) * wa, b3[2]]; }
            if (VORM === 'cirkel') {                 // the app's ring: the dots flow round it and breathe in and out
              var ca = q0.a + t * 0.12 * q0.pace, cr = 0.66 * (1 + q0.cr + Math.sin(t * q0.f1 * 2 + q0.p1) * 0.025);
              b3 = [Math.cos(ca) * cr, Math.sin(ca) * cr, q0.cz]; dy0 = 0;
            } else if (VORM === 'blob' || VORM === 'bol') {
              // the sphere turns slowly; the blob's surface rises and falls with a slow noise, its dots drift over it
              var u3 = q0.sp, ow = 0;
              if (VORM === 'bol') {                      // v47: each dot along its own circle
                var th = t * q0.osp, co = Math.cos(th), so = Math.sin(th), e2v = q0.e2;
                u3 = [u3[0] * co + e2v[0] * so, u3[1] * co + e2v[1] * so, u3[2] * co + e2v[2] * so]; ow = q0.ow;
              }
              var dr = VORM === 'blob' ? t * 0.05 * q0.pace : t * 0.035, cd = Math.cos(dr), sd2 = Math.sin(dr);
              var ux = u3[0] * cd - u3[2] * sd2, uz = u3[0] * sd2 + u3[2] * cd, uy = u3[1];
              var rr2 = VORM === 'blob' ? 0.6 * (1 + 0.17 * n3(ux * 1.05, uy * 1.05, uz * 1.05, t * 0.38))
                : 0.6 * (1 + 0.06 * n3(ux * 1.3, uy * 1.3, uz * 1.3, t * 0.3) + q0.cr * 0.35 + ow);   // v46: not a perfect sphere
              b3 = [ux * rr2, uy * rr2, uz * rr2]; dy0 = 0;
              if (VORM === 'bol') {                  // signals: fronts that run out from a few origins, one after the other
                for (var sg = 0; sg < SIGF.length; sg++) {
                  var Sf = SIGF[sg], dd2 = ux * Sf.o[0] + uy * Sf.o[1] + uz * Sf.o[2];
                  if (Math.abs(dd2 - Sf.cf) > 0.32) continue;                 // far from this front: nothing to light
                  var ang = Math.acos(clamp(dd2, -1, 1)), gk = (ang - Sf.f) / 0.13;
                  if (gk * gk < 9) sig = Math.max(sig, Math.exp(-gk * gk) * Sf.amp);
                }
              }
            }
            var bz = -b3[2], ryV = VORM === 'cirkel' ? mouse.x * 0.5 : ryB, cyV = Math.cos(ryV), syV = Math.sin(ryV);
            var bx1 = b3[0] * cyV + bz * syV, bz1 = -b3[0] * syV + bz * cyV, by1 = b3[1] * cxB - bz1 * sxB, bz2 = b3[1] * sxB + bz1 * cxB, bpz = F / (F + bz2), bn = clamp(0.55 - bz2 * 0.9, 0, 1);
            x = mix(x, SC[0] + bx1 * SB * kB * bpz, w); y = mix(y, SC[1] + (by1 + dy0) * SB * kB * bpz, w);
            // v45: smaller dots in the shape (the user: the brain's dots smaller still); v46: the sphere's as fine as the circle's, a signal lights them, it hardly grows them
            // v55: the brain as in v44 (it read better as a brain): fuller dots, darker at the front, so the folds and the cerebellum show
            var BRV = VORM === 'brein', bvis = BRV && q0.br[4] != null ? q0.br[4] : 1;   // v59: unused dots fade out in the brain
            rad = mix(rad, (BRV && BDS ? BDS * (N < 3000 ? 0.3 : 0.33) * (0.92 + 0.16 * bn) * SB * kB : q0.size * (BRV ? (0.65 + 0.95 * bn) * BRK : VORM === 'bol' ? (0.34 + 0.38 * bn) * (1 + sig * 0.25) : 0.48 + 0.72 * bn) * Math.sqrt(SB / 240)) * bpz, w);   // v59: even dots, a third of their spacing
            op = mix(op, Math.min(1, (BRV ? (BDS ? 0.72 + 0.28 * bn : 0.36 + 0.64 * bn) : VORM === 'bol' ? 0.46 + 0.44 * bn : 0.34 + 0.62 * bn) + sig * 0.6) * bvis, w);
          }
          // back into Ember's lights on the bike, each to the light on its side, along a swirl, one after the other
          if (DV > 0) {
            var dvA = smoother(clamp((DV - q0.u * 0.45) / 0.55, 0, 1));
            if (dvA > 0) {
              var th0 = Math.atan2(y - SC[1], x - SC[0]), r0 = Math.hypot(x - SC[0], y - SC[1]);
              var kd = Math.round(((((th0 + Math.PI / 2) % TAU) + TAU) % TAU) / TAU * 12) % 12, Dp = dock.pts[kd] || dock.c;
              var dj = dock.r * 1.4 * Math.sqrt(q0.u), tx = Dp[0] + Math.cos(q0.ph * 3.1) * dj, ty = Dp[1] + Math.sin(q0.ph * 3.1) * dj;
              var th1 = Math.atan2(ty - dock.c[1], tx - dock.c[0]), r1 = Math.hypot(tx - dock.c[0], ty - dock.c[1]); th1 += TAU * Math.round((th0 - th1) / TAU);
              var phD = mix(th0, th1, dvA) + (1 - dvA) * dvA * 1.6, rhD = mix(r0, r1, dvA);
              x = mix(SC[0], dock.c[0], dvA) + Math.cos(phD) * rhD; y = mix(SC[1], dock.c[1], dvA) + Math.sin(phD) * rhD;
              rad *= mix(1, 0.6, dvA); op *= 1 - smooth(seg(dvA, 0.78, 1));
            }
          }
          // v38: the pointer parts them (pushed away from it, a little along its way); a spring brings each back in about a second
          var ax = -11 * q0.ox, ay = -11 * q0.oy;
          if (pm.str > 0) {
            var mx = x + q0.ox - pm.x, my = y + q0.oy - pm.y, md2 = mx * mx + my * my;
            if (md2 < PR2) { var md = Math.sqrt(md2) || 1, fp = Math.pow(1 - md / PR, 2) * pm.str * PUSH; ax += (mx / md * 0.85 + pm.dx * 0.15) * fp; ay += (my / md * 0.85 + pm.dy * 0.15) * fp; }
          }
          var nox = q0.ox + (q0.ox - q0.qx) * keep + ax * dt2, noy = q0.oy + (q0.oy - q0.qy) * keep + ay * dt2;
          q0.qx = q0.ox; q0.qy = q0.oy; q0.ox = nox; q0.oy = noy;
          x += q0.ox; y += q0.oy;
          // dark over the white of the statement, light over the black above and below it, wherever the dot is
          var onW = smooth(clamp((y - qr.top + 8) / 16, 0, 1)) * (1 - smooth(clamp((y - seqR.top + 8) / 16, 0, 1)));
          var inkC = INKV[VORM][VORM === 'brein' && q0.br[3] != null ? q0.br[3] : q0.ink]; if (sig > 0.05) inkC = mixc(inkC, GREENP, Math.round(Math.min(1, sig * 2) * 5) / 5);   // v59: the brain's own shading
          var c3 = onW <= 0 ? TONE[q0.tone] : onW >= 1 ? inkC : mixc(TONE[q0.tone], inkC, Math.round(onW * 6) / 6);
          var key = rgb(c3) + '|' + Math.min(20, Math.round(clamp(op, 0, 1) * 20));
          (batch[key] || (batch[key] = [])).push(x, y, Math.max(rad, 0.35));
        }
        for (var key in batch) {
          var arr = batch[key], ix = key.indexOf('|');
          ctx.fillStyle = key.slice(0, ix); ctx.globalAlpha = +key.slice(ix + 1) / 20; ctx.beginPath();
          for (var n2 = 0; n2 < arr.length; n2 += 3) { ctx.moveTo(arr[n2] + arr[n2 + 2], arr[n2 + 1]); ctx.arc(arr[n2], arr[n2 + 1], arr[n2 + 2], 0, TAU); }
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    // runs while the hero, the statement or the bike's story is on screen
    var seen = new Set(), running = false;
    function loop(now) { if (!running) return; frame(now); requestAnimationFrame(loop); }
    function check() { if (seen.size && !running) { running = true; lastT = performance.now(); lastY = scrollY; requestAnimationFrame(loop); } else if (!seen.size) { running = false; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, fx.width, fx.height); } }
    layout(); addEventListener('resize', layout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    if ('IntersectionObserver' in window) [heroSec, quote, seqEl].forEach(function (el) { new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target); }); check(); }, { rootMargin: '80px' }).observe(el); });
    else { seen.add(heroSec); check(); }
  })();

  /* =================================================================== 2 · how it works: the opening, scrubbed by scroll */
  var seq = $('.seq');
  if (seq) (function () {
    var stage = $('.seq__stage', seq), bike = $('.bike:not(.bike--blur)', seq), blur = $('.bike--blur', seq), plate = $('.plate', seq), ember = $('.ember', seq), shade = $('.seq__shade', seq);
    var shSoft = $('.shadow--soft', seq), shTight = $('.shadow--tight', seq);
    var beats = {};
    ['bike', 'sticker', 'click', 'data', 'notice', 'heet'].forEach(function (k) { beats[k] = $('.beat--' + k, seq); });
    var tags = {}; $$('.tags [data-t]', seq).forEach(function (n) { (tags[n.getAttribute('data-t')] = tags[n.getAttribute('data-t')] || {})[n.tagName.toLowerCase()] = n; });
    var pchart = makeChart($('.vandaag--in', seq));
    var phone = $('.phone', seq), pscroll = $('.ios__scroll', phone), pscreen = $('.ios', phone), push = $('.push', phone), appState = $('[data-a="state"]', phone), appCard = $('[data-a="kaart"]', phone), appLayers = $$('.ios__laag', phone), appTrend = $('[data-a="trend"]', phone);
    var W = 0, H = 0, t0 = performance.now(), phoneK = 0.8, warned = null, cardH0 = 300, bh = { data: 200, model: 200, notice: 160 }, lastNow = t0;
    var pushT = $('.push__t', phone), pushX = $('.push__x', phone);
    var APP = {
      normaal:    { word: 'Normaal', layer: 'normaal', trend: 'Stabiel', mel: 'Geen nieuwe' },
      aandacht:   { word: 'Aandacht', layer: 'warn', trend: '+6° in 1 uur', mel: 'Warmer dan normaal · nu', push: ['Warmer dan normaal', 'Je accu wordt sneller warm dan normaal. Laadt hij? Haal de lader eruit.'] },
      oververhit: { word: 'Oververhit', layer: 'heet', trend: '+37° in 2 uur', mel: 'Oververhit · nu', push: ['E-bike raakt oververhit', 'Haal de stekker eruit. Raak de accu niet aan.'] }
    };

    var paint = document.createElement('canvas'); paint.className = 'seq__dots'; paint.setAttribute('aria-hidden', 'true'); stage.appendChild(paint);
    var pctx = paint.getContext('2d');

    var hero = { x: 0, y: 0, s: 1, R: 100 };
    // the app's swarm on the phone, drawn at the pixels the scaled phone really covers
    var pswarm = Swarm ? new Swarm($('.ios__held canvas', phone), { state: 'normaal', seed: 384, zoom: function () { return phoneK; },
      layout: function (w, h) { return { x: w / 2, y: h / 2, R: Math.min(w, h) * 0.4 }; } }) : null;
    function run(sw, on) { if (!sw) return; if (on && !sw.run) sw.start(); else if (!on && sw.run) sw.stop(); }

    var sizedW = -1, sizedH = -1;
    function size(force) {
      // v54: only when the stage really changes size (on a phone the bar sliding in and out fires resize all the time)
      if (force !== true && stage.clientWidth === sizedW && stage.clientHeight === sizedH) return;
      sizedW = stage.clientWidth; sizedH = stage.clientHeight;
      W = stage.clientWidth; H = stage.clientHeight;
      var d = Math.min(2, devicePixelRatio || 1);
      fit(paint, W * d, H * d); pctx.setTransform(d, 0, 0, d, 0, 0);
      ['data', 'notice', 'heet'].forEach(function (k) { bh[k] = beats[k].offsetHeight || bh[k]; });
      layoutPhone(); if (pswarm) pswarm.resize();
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { size(true); });
    // the phone: 390 x 844 design px (plus its caption), scaled to the room it has
    var phoneBox = { x: 0, y: 0 };
    // v23: the panel ends 24 under a whole card instead of cutting the chart in half: under the chart, on a phone under the
    // state card (the chart would make it too small there). Measured in the panel's own pixels, whatever its scale now
    var pios = $('.ios', phone), ppanel = $('.iphone--panel', phone), pheld = $('.ios__held', phone), pchartEl = $('.vandaag--in', phone), lastKc = -1;
    function panelHeight(nar) {
      // v54: measured without the fold's shift: on a phone the card and the chart may stand moved up (translate) when this runs,
      // and the bar sliding back in on the way up runs it; the shifted card gave a wrong height, or the full (desktop) one
      var keepC = appCard.style.transform, keepT = pchartEl.style.getPropertyValue('transform'), keepP = pchartEl.style.getPropertyPriority('transform');
      appCard.style.transform = ''; pchartEl.style.removeProperty('transform');
      var last = $(nar ? '.ios__kaart' : '.vandaag', phone), r = pios.getBoundingClientRect(), k = r.height / (pios.offsetHeight || 1) || 1;
      var h = Math.round((last.getBoundingClientRect().bottom - r.top) / k + 24);
      appCard.style.transform = keepC; if (keepT) pchartEl.style.setProperty('transform', keepT, keepP);
      return h > 200 ? h : 760;
    }
    function layoutPhone() {
      var nar = narrow.matches, PW = 390, PHt = panelHeight(nar);
      ppanel.style.height = pios.style.height = PHt + 'px';
      ppanel.classList.toggle('is-short', nar);                    // what comes after the last card is hidden, so no edge of it peeks in
      if (nar) {
        var room = H - 28 - Math.max(bh.notice, bh.data, bh.heet || 0) - 16 - TOP;   // between the bar and the copy at the bottom
        phoneK = clamp(Math.min(room / PHt, (W - 48) / PW, 0.9), 0.3, 0.9);
        phoneBox = { x: (W - PW * phoneK) / 2, y: TOP + Math.max(0, (room - PHt * phoneK) / 2) };
      } else {
        // v18: the same margin above, below and to the right; it stands in the middle top to bottom
        var g = TOP; phoneK = clamp(Math.min((H - 2 * g) / PHt * 0.86, W * 0.27 / PW), 0.3, 0.92);
        g = (H - PHt * phoneK) / 2; phoneBox = { x: W - g - W * 0.06 - PW * phoneK, y: g };   // v37: further from the edge
      }
    }
    var TOP = 84;                                                  // under the bar

    function frame(now) {
      var t = now / 1000, nar = narrow.matches, intro = reduce ? 9 : (now - t0) / 1000, dt = Math.min(0.05, (now - lastNow) / 1000); lastNow = now;
      // v16: the story starts while the section is still sliding in (its top at 85% of the screen), not once it is pinned
      var rq = seq.getBoundingClientRect(), raw = reduce ? 0 : clamp((innerHeight * 0.85 - rq.top) / (rq.height - innerHeight + innerHeight * 0.85), 0, 1);
      // v36: the story as it was runs through the first SEQK of the section; then the app goes through its states (q)
      var p = clamp(raw / SEQK, 0, 1), q = seg(raw, SEQK, 1);
      var state = p <= 0.66 ? 'normaal' : q < 0.3 ? 'aandacht' : 'oververhit';   // v38: Normaal, Aandacht, Oververhit (no Geen verbinding)

      /* ---- the bike comes out of the dark (its blur first, a slow focus pull), the camera on the down tube ---- */
      var pap = 0;
      // two camera stops, as on the team's site: established (the bike), then pushed in while Ember lands
      // established: the photo fills the width (its black matches the stage), Ember on the tube right of the middle
      var gE = (nar ? W * 1.3 : W * 0.82) / BIKE.w, mE = nar ? [W * 0.52, H * 0.36] : [W * 0.58, H * 0.44];
      var gZ = (nar ? H * 0.2 : H * 0.26) / MOUNT.len, mZ = nar ? [W * 0.46, H * 0.3] : [W * 0.56, H * 0.5];
      var z = inOut(seg(p, 0.13, 0.36));                                          // pushes in while Ember lands, as theirs
      var g = lmix(gE, gZ, z), M = [mix(mE[0], mZ[0], z), mix(mE[1], mZ[1], z)];
      if (!nar) { var zs = inOut(seg(p, 0.43, 0.52)); M[0] -= W * 0.07 * zs; M[1] -= H * 0.03 * zs; }   // v36: room for the phone; v37: half as far, nearer the middle
      var CAM = [g, 0, 0, g, M[0] - MOUNT.x * g, M[1] - MOUNT.y * g];
      bike.style.transform = css(CAM);
      blur.style.transform = css([g * BIKE.w / 412, 0, 0, g * BIKE.h / 952, CAM[4], CAM[5]]);
      var lit = smooth(seg(p, 0.03, 0.12)), focus = smooth(seg(p, 0.06, 0.19)), dim = smooth(seg(p, 0.43, 0.5)), dim2 = smooth(seg(p, 0.45, 0.52));
      var bo = mix(1, 0.45, dim) * mix(1, nar ? 0.3 : 0.75, dim2);
      blur.style.opacity = (lit * (1 - focus) * bo).toFixed(3);
      bike.style.opacity = (lit * focus * bo).toFixed(3);
      shade.style.opacity = smooth(seg(p, 0.05, 0.1)).toFixed(3);

      /* ---- the sticker: on the tube first, on its centre line ---- */
      var eLen = MOUNT.len * g, mount = apply(CAM, MOUNT.x, MOUNT.y), seat = apply(CAM, SEAT.x, SEAT.y);
      var pl = smooth(seg(p, 0.19, 0.25)), ph = (1 - pl) * 1.6;              // comes in along the normal
      var PM = pose(mount[0] + NORMAL[0] * g * ph, mount[1] + NORMAL[1] * g * ph, eLen / SPR.len * (1 + 0.32 * ph), MOUNT.rot, MOUNT.sq);
      plate.style.transform = css(PM);
      plate.style.opacity = (smooth(seg(p, 0.185, 0.21)) * (1 - smooth(seg(p, 0.325, 0.335))) * mix(1, 0.6, dim)).toFixed(3);   // gone under Ember, as theirs

      /* ---- Ember: from the paper hero to beside the tube; then onto the sticker ---- */
      var eIn = smooth(seg(p, 0.0, 0.07));
      var WAIT = nar ? 1.6 : 2.4, h = p < 0.27 ? WAIT : WAIT * (1 - inQuad(seg(p, 0.27, 0.335)));   // waits off the surface while the sticker goes on; the magnet pulls (accelerating)
      var on = [seat[0] + NORMAL[0] * g * h, seat[1] + NORMAL[1] * g * h];
      var onS = eLen / SPR.len * (1 + 0.32 * h);
      var float = reduce ? 0 : Math.sin(t * 1.1) * 5 * (1 - seg(p, 0, 0.04));
      // the start of the story: Ember upright in the middle, as it stood at the end of the hero
      var heroLen = nar ? Math.min(H * 0.4, W * 0.62) : Math.min(H * 0.52, W * 0.34);               // v18: from the middle
      hero.x = W * 0.5; hero.y = (nar ? H * 0.42 : H * 0.48) + float; hero.s = heroLen / SPR.len;
      var tt = inOut(seg(p, 0, 0.23)), u = 1 - tt;
      var c1 = [mix(hero.x, on[0], 0.7), mix(hero.y, on[1], 0.2) - H * 0.05];
      var ex = u * u * hero.x + 2 * u * tt * c1[0] + tt * tt * on[0], ey = u * u * hero.y + 2 * u * tt * c1[1] + tt * tt * on[1];
      // on the way it turns in 3D (the render's own frames) to the tube's face, and in the picture plane to the tube's line
      var turn = smooth(seg(tt, 0.3, 1)), fr = Math.round(turn * (SPR.frames - 1)), beta = fr / (SPR.frames - 1) * SPR.beta * Math.PI / 180;
      var EM = pose(ex, ey, lmix(hero.s, onS, tt) * mix(0.94, 1, eIn), mix(0, MOUNT.rot, turn));        // no in-plane wobble: calmer, as theirs
      ember.style.transform = css(EM);
      ember.style.backgroundPosition = (-(fr % 8) * 450) + 'px ' + (-Math.floor(fr / 8) * 900) + 'px';
      var coverO = 1;                                                 // set below, once the card is placed
      ember.style.opacity = (eIn * mix(1, nar ? 0.25 : 1, dim2)).toFixed(3);
      var land = 1 - h / WAIT, near = smooth(seg(p, 0.23, 0.27));
      ember.style.filter = 'brightness(' + mix(1.08, 1.0, pap).toFixed(3) + ')' + (pap > 0.01 ? ' drop-shadow(0 ' + (6 * pap).toFixed(0) + 'px 12px rgba(0,0,0,' + (0.1 * pap).toFixed(3) + '))' : '');   // v55: lighter, it darkened the frame
      // the shadow lies on the tube under the mounted pose (the team's two sprites): soft and shifted while it hovers, tight once it is on
      var SM = pose(seat[0] + 9 * g, seat[1] - 2 * g, eLen / 1131, MOUNT.rot, 1, SHG), hh = h / WAIT;     // their frame: the body is 1131 px long
      var sm = mul(SM, SHSPR);
      shSoft.style.transform = css(shift(sm, g * (2 + 9 * hh), g * (2.2 + 7 * hh))); shTight.style.transform = css(shift(sm, g * 1.4, g * 1.7));
      // v55: the shadow on the frame much lighter (it read as a dark patch on the tube): a hint of contact, no more
      shSoft.style.opacity = (near * 0.22 * (1 - 0.75 * land) * mix(1, 0.5, dim2)).toFixed(3);
      shTight.style.opacity = (near * 0.24 * Math.pow(land, 2.2) * mix(1, 0.5, dim2)).toFixed(3);


      /* ---- the lights: off on paper (as in the render), resting on the way, awake on the click; orange with the notice ---- */
      var warn = state !== 'normaal';
      pctx.clearRect(0, 0, W, H);
      var LC = { normaal: pap > 0.5 ? '130,185,142' : '255,253,248', aandacht: '240,182,90', oververhit: '236,106,92' };
      var sc = Math.hypot(EM[0], EM[1]), cb = Math.cos(beta), sb = Math.sin(beta), lc = LC[state];
      // v36: overheated, the lights pulse; without a connection they go out, as Ember's own ring would
      var lk = state === 'oververhit' ? 0.7 + 0.3 * Math.sin(t * 7) : 1;
      // v25: where Ember's lights are on the screen now, for the dots that dive back in from the quote
      var sR = stage.getBoundingClientRect(), bc0 = apply(EM, SPR.cx + 15 * sb * SPR.mm, SPR.cy - 22.4 * SPR.mm);
      dock.c = [sR.left + bc0[0], sR.top + bc0[1]]; dock.r = 0.85 * SPR.mm * sc; dock.ok = true;
      for (var di = 0; di < 12; di++) {
        var dla = (90 - 30 * di) * Math.PI / 180, dlx = 10.6 * Math.cos(dla), dlz = 22.4 + 10.6 * Math.sin(dla), dP = apply(EM, SPR.cx + (dlx * cb + 15 * sb) * SPR.mm, SPR.cy - dlz * SPR.mm);
        dock.pts[di] = [sR.left + dP[0], sR.top + dP[1]];
      }
      for (var j = 0; j < 12; j++) {
        var o = p < 0.31 ? mix(1, 0.25, smooth(seg(p, 0.02, 0.08))) : 0.25 + 0.75 * smooth(seg(p, 0.33 + j * 0.003, 0.36 + j * 0.003));
        o *= mix(1, nar ? 0.25 : 1, dim2) * lk;
        if (o < 0.01) continue;
        var la = (90 - 30 * j) * Math.PI / 180, lx = 10.6 * Math.cos(la), lz = 22.4 + 10.6 * Math.sin(la);
        var L2 = apply(EM, SPR.cx + (lx * cb + 15 * sb) * SPR.mm, SPR.cy - lz * SPR.mm), r0 = 0.85 * SPR.mm * sc;
        // v57: no glow round the lights, only the lights themselves
        pctx.fillStyle = 'rgba(' + lc + ',' + o.toFixed(3) + ')';
        pctx.beginPath(); pctx.ellipse(L2[0], L2[1], Math.max(0.6, r0 * cb), Math.max(0.6, r0), 0, 0, TAU); pctx.fill();
      }

      /* ---- the click: dots spring off Ember as it lands (scrubbed by the scroll, so it plays back too) ---- */
      var kb = seg(p, 0.333, 0.39);
      if (kb > 0 && kb < 1) {
        var bc = apply(EM, SPR.cx + 7.5 * sb * SPR.mm, SPR.cy), bl = eLen * 0.5, e1 = outCubic(kb), fadeB = 1 - smooth(seg(kb, 0.35, 1));
        for (var q3 = 0; q3 < 64; q3++) {
          var h1 = Math.sin(q3 * 12.9898) * 43758.5453, rnd1 = h1 - Math.floor(h1), h2 = Math.sin(q3 * 78.233) * 12543.21, rnd2 = h2 - Math.floor(h2);
          var an = q3 / 64 * TAU + rnd1 * 0.3, dist = bl * (0.55 + 0.9 * rnd2) * e1 + bl * 0.35;
          var bx = bc[0] + Math.cos(an) * dist * 0.75, by = bc[1] + Math.sin(an) * dist;
          pctx.fillStyle = 'rgba(' + (q3 % 5 === 0 ? '130,185,142' : '236,238,242') + ',' + (fadeB * (0.4 + 0.6 * rnd2)).toFixed(3) + ')';
          pctx.beginPath(); pctx.arc(bx, by, 1.2 + rnd1 * 1.4, 0, TAU); pctx.fill();
        }
      }

      /* ---- copy ---- */
      // v23: the first line stays until the sticker comes (it left after a third of a screen)
      setBeat(beats.bike, fade(p, 0.05, 0.08, 0.19, 0.215), 1);
      setBeat(beats.sticker, fade(p, 0.215, 0.24, 0.285, 0.31), 1);
      setBeat(beats.click, fade(p, 0.31, 0.35, 0.41, 0.44), 1);
      setBeat(beats.data, fade(p, 0.47, 0.51, 0.6, 0.64), 1);
      setBeat(beats.notice, fade(p, 0.65, 0.69) * (1 - smooth(seg(q, 0.18, 0.28))), 1);
      setBeat(beats.heet, fade(q, 0.3, 0.4), 1);

      /* ---- tags ---- */
      var to = fade(p, 0.35, 0.38, 0.41, 0.44);
      tag('a', apply(EM, SPR.cx, SPR.cy - SPR.len * 0.38), nar ? 64 : 80, nar ? -54 : -36, to, 1);
      tag('b', apply(EM, SPR.cx - 118, SPR.cy + SPR.len * 0.3), nar ? -24 : -80, 44, to * smooth(seg(p, 0.36, 0.39)), -1);
      tag('c', apply(CAM, TUBE_PT[0], TUBE_PT[1]), nar ? 30 : 70, 36, to * smooth(seg(p, 0.37, 0.4)), 1);

      var cover = 0, ci = 0;
      /* ---- the notice: the phone with the app's home; now warmer than normal ---- */
      // the phone comes straight after the click; its screen scrolls through the design, then back up as it turns to attention
      var pin = smooth(seg(p, 0.45, 0.51));

      phone.style.opacity = pin.toFixed(3);
      phone.style.visibility = pin < 0.005 ? 'hidden' : 'visible';
      phone.style.transform = 'translate(' + phoneBox.x.toFixed(1) + 'px,' + (phoneBox.y + (1 - pin) * 48).toFixed(1) + 'px) scale(' + phoneK.toFixed(4) + ')';
      run(pswarm, pin > 0.005);
      pchart.frame(pin > 0.3 ? 1 : 0, now);
      // v24: the chart goes through the periods while you scroll (Dag, Week, Maand, back to Dag) and turns to the day with
      // attention (Figma v11 H2, with its temperatures) together with the swarm
      pchart.show(state === 'aandacht' ? 'warn' : state === 'oververhit' ? 'heet' : pchart.pick() || (p < 0.535 ? 'dag' : p < 0.57 ? 'week' : p < 0.605 ? 'maand' : 'dag'));
      // on a phone the panel holds the swarm and the card; for the chart the swarm folds away and the chart comes up into
      // its place, so nothing is cut: while the periods run, and again after the notice for the day with attention
      var kc = nar ? Math.max(smooth(seg(p, 0.505, 0.53)) * (1 - smooth(seg(p, 0.635, 0.66))), smooth(seg(p, 0.76, 0.79))) : 0;
      if (kc !== lastKc) {
        lastKc = kc;
        // v51: one thing after the other, and moved, not laid out again: the swarm fades first, then the card and the chart
        // slide up into its place, then the chart shows (before, all three at once over each other, with a new layout each step)
        var fo = smooth(clamp(kc / 0.45, 0, 1)), mv = smooth(clamp((kc - 0.3) / 0.7, 0, 1)), co = smooth(clamp((kc - 0.55) / 0.45, 0, 1));
        var tr = nar && mv > 0.001 ? 'translate3d(0,' + (-308 * mv).toFixed(1) + 'px,0)' : '';
        pheld.style.opacity = (1 - fo).toFixed(3); pheld.style.marginBottom = '';
        appCard.style.transform = tr; if (tr) pchartEl.style.setProperty('transform', tr, 'important'); else pchartEl.style.removeProperty('transform');   // its rule holds transform with !important
        if (nar) pchartEl.style.setProperty('opacity', co.toFixed(3), 'important'); else pchartEl.style.removeProperty('opacity');
      }
      if (state !== warned) {
        warned = state;
        var ST = APP[state];
        if (pswarm) pswarm.set(state);
        appState.textContent = ST.word; appState.classList.toggle('is-warn', state === 'aandacht'); appState.classList.toggle('is-danger', state === 'oververhit');
        // v22: the texts sit in the card, one over the other, and cross-fade: the card keeps its height, so nothing under it jumps
        appCard.setAttribute('data-s', state);
        appLayers.forEach(function (l) { l.setAttribute('aria-hidden', String(!l.classList.contains('ios__laag--' + ST.layer))); });
        appTrend.textContent = ST.trend;
        var mel = $('[data-a="melding"]', phone), str = $('.ios__streep', phone);
        if (mel) mel.textContent = ST.mel;
        if (str) str.classList.toggle('is-warn', state === 'aandacht' || state === 'oververhit');
        // the push: the app's own words per state (V11 H0, N00); none without a connection
        if (ST.push) { pushT.textContent = ST.push[0]; pushX.textContent = ST.push[1]; }
        push.classList.toggle('is-danger', state === 'oververhit');
      }
      var pu = smooth(seg(p, 0.68, 0.72)) * (nar ? 1 - smooth(seg(p, 0.75, 0.77)) : 1);   // on a phone it slides away for the chart
      // v36: it goes up as the state turns, and comes back with the alarm; without a connection there is none
      pu = Math.max(pu * (1 - smooth(seg(q, 0.18, 0.26))), fade(q, 0.32, 0.38) * (nar ? 1 - smooth(seg(q, 0.62, 0.7)) : 1));
      push.style.opacity = pu.toFixed(3); push.style.transform = 'translateY(' + (-130 * (1 - pu)).toFixed(1) + '%)';

      /* ---- the line of measurements: from Ember's lights to the chart, then to the phone ---- */
      var rc = apply(EM, SPR.cx + 15 * sb * SPR.mm, SPR.cy - 22.4 * SPR.mm);
      var la2 = nar ? 0 : pin;
      if (la2 > 0.01) {
        var s0 = rc, end, lead, toPhone = true, cy = 0, cx = 0, ch = 0;
        if (nar) { end = [W / 2, cy - 10]; lead = [s0, [s0[0], end[1]], end]; }
        else if (toPhone) { end = [phoneBox.x - 18, phoneBox.y + 300 * phoneK]; var kx2 = s0[0] + (end[0] - s0[0]) * 0.5; lead = [s0, [kx2, s0[1]], [kx2, end[1]], end]; }
        else { end = [cx - 10, cy + ch * 0.62]; var kx = s0[0] + (end[0] - s0[0]) * 0.5; lead = [s0, [kx, s0[1]], [kx, end[1]], end]; }
        var segs = [], L = 0; for (var q = 1; q < lead.length; q++) { var dd = Math.hypot(lead[q][0] - lead[q - 1][0], lead[q][1] - lead[q - 1][1]); segs.push(dd); L += dd; }
        var LN = { normaal: ['150,197,160', '214,235,219'], aandacht: ['232,162,58', '255,214,160'], oververhit: ['226,77,66', '255,180,169'] }[state];
        var drawn = L * outCubic(seg(p, 0.46, 0.52)), col = LN[0];
        for (var sd2 = 0; sd2 < drawn; sd2 += 8) dot(lead, segs, sd2, 1.6, 'rgba(' + col + ',' + (0.8 * la2).toFixed(3) + ')');
        if (drawn >= L - 1) for (var m = 0; m < 3; m++) dot(lead, segs, (t * (state === 'oververhit' ? 180 : 110) + m * L / 3) % L, 2.6, 'rgba(' + LN[1] + ',' + (0.95 * la2).toFixed(3) + ')');
      }
    }
    function dot(P2, segs, s, r, col) {
      for (var q = 0; q < segs.length; q++) {
        if (s <= segs[q] || q === segs.length - 1) { var f = segs[q] ? clamp(s / segs[q], 0, 1) : 0, a = P2[q], b = P2[q + 1];
          pctx.fillStyle = col; pctx.beginPath(); pctx.arc(mix(a[0], b[0], f), mix(a[1], b[1], f), r, 0, TAU); pctx.fill(); return; }
        s -= segs[q];
      }
    }
    function setBeat(b, o, dir) { b.style.opacity = o.toFixed(3); b.style.visibility = o < 0.01 ? 'hidden' : 'visible'; b.style.translate = '0 ' + ((1 - o) * 28 * dir).toFixed(1) + 'px'; }
    function tag(id, at, dx, dy, o, side) {
      var T = tags[id]; if (!T) return;
      var ex = at[0] + dx, ey = at[1] + dy, hx = ex + side * 16;
      T.path.setAttribute('d', 'M' + at[0].toFixed(1) + ' ' + at[1].toFixed(1) + 'L' + ex.toFixed(1) + ' ' + ey.toFixed(1) + 'L' + hx.toFixed(1) + ' ' + ey.toFixed(1));
      T.circle.setAttribute('cx', at[0].toFixed(1)); T.circle.setAttribute('cy', at[1].toFixed(1));
      T.path.style.opacity = T.circle.style.opacity = T.p.style.opacity = o.toFixed(3);
      var w = T.p.offsetWidth || 140, lx = side > 0 ? hx + 8 : hx - 8 - w;
      T.p.style.transform = 'translate(' + clamp(lx, 8, W - w - 8).toFixed(1) + 'px,' + (ey - 9).toFixed(1) + 'px)';
    }

    size(); addEventListener('resize', size);
    var running = false;
    function loop(now) { if (!running) return; frame(now); requestAnimationFrame(loop); }
    if ('IntersectionObserver' in window && !reduce) {
      new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting && !running) { running = true; lastNow = performance.now(); requestAnimationFrame(loop); } else if (!en.isIntersecting) { running = false; run(pswarm, false); } }); }).observe(seq);
    } else { frame(performance.now()); jobs.push(function () { frame(performance.now()); }); }
  })();

  /* =================================================================== in-page links glide; the target gets the focus */
  $$('a[href^="#"]').forEach(function (a) {
    var id = a.getAttribute('href').slice(1); if (!id) return;
    a.addEventListener('click', function (e) {
      var el = document.getElementById(id); if (!el) return;
      e.preventDefault();
      // v21: the close-up's card is 24 from its top, so it lands under the bar, not behind it
      var off = el.classList.contains('look') ? document.getElementById('bar').offsetHeight : 0;
      glide(el.getBoundingClientRect().top + scrollY - off);
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
      if (history.replaceState) history.replaceState(null, '', '#' + id);
    });
  });

  /* =================================================================== the bar: count, current link, contrast over light parts */
  var bar = $('#bar'), countEl = $('[data-count]');
  var chapters = ['top', 'wat', 'werkt', 'dichtbij', 'cijfers', 'partners', 'vragen'].map(function (id) { return document.getElementById(id); });
  var links = {}; $$('.bar__nav a').forEach(function (a) { links[a.getAttribute('data-ch')] = a; });
  // v24: light or dark by the colour really under it (a fixed list of light sections went wrong once the partners turned black)
  function lightAt(x, y) {
    var els = document.elementsFromPoint(x, y);
    for (var i = 0; i < els.length; i++) {
      if (els[i].closest('.bar, .count--corner, .flow, .skip')) continue;
      for (var e = els[i]; e && e !== document.documentElement; e = e.parentElement) {
        var m = getComputedStyle(e).backgroundColor.match(/[\d.]+/g);
        if (m && (m.length < 4 || +m[3] > 0.5)) return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255 > 0.6;
      }
      return false;
    }
    return false;
  }
  jobs.push(function () {
    var cur = 0;
    chapters.forEach(function (c, j) { if (c && c.getBoundingClientRect().top <= innerHeight * 0.4) cur = j; });
    var txt = '0' + (cur + 1);
    if (countEl.textContent !== txt) countEl.textContent = txt;
    Object.keys(links).forEach(function (k) { links[k].setAttribute('aria-current', String(chapters[cur] && chapters[cur].id === k)); });
    bar.classList.toggle('is-light', lightAt(innerWidth / 2, 38));
    bar.classList.toggle('is-scrolled', scrollY > 8);              // v46: on a phone the bar gets glass once the page moves
    // the counter, bottom right: light or dark by what lies under it, so it always reads
    var cc = countEl.parentElement, cr = cc.getBoundingClientRect();
    cc.classList.toggle('is-light', lightAt(cr.left + cr.width / 2, cr.top + cr.height / 2));
  });

  /* =================================================================== the waitlist: the swarm at rest around Ember */
  var join = $('.join');
  if (join && Swarm) (function () {
    var js = new Swarm($('.join__product canvas', join), { state: 'rust', extra: narrow.matches ? 200 : 360, sizeExp: 0.5, seed: 7,
      layout: function (w, h) { return { x: w / 2, y: h / 2, R: w * 0.38 }; } });
    js.watch(join);
  })();

  /* the form: posts to the team's signup server (server/server.mjs: POST {api}/signup, the same fields as their
     dialog) when data-api is set; until then it says plainly that nothing was saved. Only the address is sent. */
  var form = $('.join__form');
  if (form) (function () {
    var input = $('input', form), btn = $('button', form), msg = $('.join__msg', form);
    // the consent text under the button is the team's, word for word: their server records it under this version
    var api = (form.getAttribute('data-api') || '').replace(/\/$/, ''), CONSENT = 'signup-2026-10-02';
    var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, busy = false, rid = null, ridFor = '';
    function uid() { return window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }
    function zone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; } }
    function say(text, kind) { msg.textContent = text; msg.className = 'join__msg' + (kind ? ' is-' + kind : ''); }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var v = input.value.trim();
      if (!EMAIL.test(v)) { input.setAttribute('aria-invalid', 'true'); say('Vul een geldig e-mailadres in, zoals naam@voorbeeld.nl.', 'err'); input.focus(); return; }
      input.removeAttribute('aria-invalid');
      if (!api) { say('Inschrijven is op deze versie van de site nog niet gekoppeld, dus er is niets opgeslagen.', 'err'); return; }
      if (!rid || ridFor !== v.toLowerCase()) { rid = uid(); ridFor = v.toLowerCase(); }   // the same request when sent again
      busy = true; btn.disabled = true; say('Bezig met versturen…');
      var ctl = 'AbortController' in window ? new AbortController() : null, timer = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
      fetch(api + '/signup', {
        method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, credentials: 'omit', signal: ctl ? ctl.signal : undefined,
        body: JSON.stringify({ email: v, source: 'ember-site', page: location.pathname, requestId: rid, consentVersion: CONSENT, lang: 'nl', tz: zone(), locale: navigator.language || '' })
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.ok) throw new Error(j.error || ('http_' + r.status)); return j; }); })
        .then(function (j) {
          say(j.doubleOptIn ? 'Bijna klaar: we hebben je een e-mail gestuurd. Bevestig daarin je adres.' : 'Je staat op de lijst. We houden je op de hoogte.', 'ok');
          form.reset(); rid = null;
        })
        .catch(function () { say('Dat is niet gelukt, dus je bent nog niet ingeschreven. Controleer je verbinding en probeer het nog een keer.', 'err'); })
        .then(function () { clearTimeout(timer); busy = false; btn.disabled = false; });
    });
  })();

  /* the turntable: 36 frames from Blender (3d/ember_scene.py mode=turn, w=420) in one sheet.
     Drag (mouse or finger) to turn it, with a little momentum; left alone it turns slowly by itself.
     goTo(deg) eases to an angle the short way round; the lights are drawn by the caller. */
  function makeTurn(el, o) {
    o = o || {};
    var c = $('canvas', el) || el, ctx = c.getContext('2d'), img = new Image(), F = 36, COLS = 6, FW = o.FW || 420, FH = o.FH || 1260;
    var ang = 0, vel = 0, down = null, lastF = -1, on = false, raf = 0, last = 0, idle = 0, target = null, spinOn = false, onDrag = o.onDrag, onAngle = o.onAngle;
    img.decoding = 'async'; img.src = o.src || 'assets/img/ember-turn.webp?v=55';
    function size() { var d = Math.min(2, devicePixelRatio || 1); if (fit(c, c.clientWidth * d, c.clientHeight * d)) { lastF = -1; paint(); } }
    function paint() {
      if (!img.complete || !c.width) return;
      var f = Math.round((((ang % 360) + 360) % 360) / 360 * F) % F;
      if (f === lastF) return; lastF = f;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, (f % COLS) * FW, Math.floor(f / COLS) * FH, FW, FH, 0, 0, c.width, c.height);
      if (onAngle) onAngle(ang);
    }
    function tick(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!down) {
        if (target != null) {                                              // easing to an asked angle
          var d = target - ang; ang += d * (1 - Math.exp(-dt * 6)); vel = 0;
          if (Math.abs(d) < 0.15) { ang = target; target = null; }
        } else {
          ang += vel * dt; vel *= Math.exp(-dt * 2.5); idle += dt;
          if (spinOn && idle > 1.2 && !reduce) ang += dt * 14 * smooth(seg(idle, 1.2, 2.6));
        }
      }
      paint();
      if (on) raf = requestAnimationFrame(tick); else raf = 0;
    }
    var host = o.host || el;
    var locked = o.locked || function () { return false; };
    host.addEventListener('pointerdown', function (e) { if ((e.button && e.button !== 0) || locked()) return; down = { x: e.clientX, a: ang, t: performance.now(), px: e.clientX }; target = null; vel = 0; host.setPointerCapture(e.pointerId); if (onDrag) onDrag(); });
    host.addEventListener('pointermove', function (e) {
      if (!down) return;
      var now = performance.now(), dx = e.clientX - down.px, dt = Math.max(0.008, (now - down.t) / 1000);
      ang = down.a + (e.clientX - down.x) * 0.8; vel = dx * 0.8 / dt; down.t = now; down.px = e.clientX; idle = 0; paint();
    });
    function up() { down = null; idle = 0; }
    host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
    host.tabIndex = 0;
    host.addEventListener('keydown', function (e) { if (locked()) return; if (e.key === 'ArrowLeft') { ang -= 10; target = null; idle = 0; paint(); } if (e.key === 'ArrowRight') { ang += 10; target = null; idle = 0; paint(); } });
    img.onload = function () { lastF = -1; paint(); };
    addEventListener('resize', size); requestAnimationFrame(size);
    return {
      el: el, angle: function () { return ang; },
      set: function (deg) { ang = deg; target = null; vel = 0; idle = 0; paint(); },
      goTo: function (deg) { var a = ((ang % 360) + 360) % 360, d = ((deg - a) % 360 + 540) % 360 - 180; target = ang + d; idle = 0; },
      spin: function (v) { spinOn = v; idle = 0; },
      active: function (v) { on = v; if (v) { size(); idle = 0; if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } } }
    };
  }

  /* =================================================================== 4 · up close: the team's menu on the left; on the right one 3D model turning
     into the next. Each step turns the same render (36 frames from Blender) to its side and moves in: the back with its
     two infrared windows, the back with the sticker, the front with its lights going through the four colours, the side
     with its measures; the last step shows what is in the box, at true size (our own render). Dragging turns it freely. */
  var look = $('.look');
  if (look) (function () {
    var grid = $('.look__grid', look), stage = $('.look__stage', look), cam = $('.look__cam', look), prod = $('.look__prod', look), lightsC = $('.look__lights', look), lctx = lightsC.getContext('2d');
    var items = $$('.xf__item', look), pills = items.map(function (it) { return $('.xf__pill', it); });
    var dims = $('.look__dims', look);
    var notes = $$('.note[data-v]', look), ir = $('.look__ir', look), cur = -1, feat = 'all', lightT = 0, lastL = 0, lraf = 0;
    var RING = [['Wit', 'Rust'], ['Groen', 'Normaal'], ['Oranje', 'Aandacht'], ['Rood', 'Oververhit']], ringShown = -1, ringWord = $('[data-ring="word"]', look), ringState = $('[data-ring="state"]', look);
    // v46: measuring: our render of Ember in profile on the battery housing (mode=measure, 2304 x 1536): Ember's centre, the
    // infrared windows and the air slot on its back edge, its outline on the left (it leans with the tube), the tube's right edge low down
    var photo = $('.look__photo', look), phoneV = $('.look__phoneview', look);
    var PH = { w: 1800, h: 1800, cx: 723.8, ir: [818.4, 593.0], air: [725.2, 1261.4], top: [705.7, 387.6], bot: [571.9, 1355.4], house: [1262, 1440] };
    // v46: the notes' lines drawn as the app's line of measurements in the story (Ember to the phone): a row of dots every 8 px
    // that draws itself out, then three larger dots running along it, from the product to the note, in the app's green
    // (on white the two greens swap: the row light, the running dots dark)
    var LEADS = { measure: {}, magnet: {} }, LNOW = 0;
    function setLead(set, id, pts) {
      var P = [pts[0]], a = pts[0], b = pts[pts.length - 1];
      if (pts.length === 2 && Math.abs(a[1] - b[1]) > 2 && Math.abs(a[0] - b[0]) > 2) { var kx = a[0] + (b[0] - a[0]) * 0.5; P.push([kx, a[1]], [kx, b[1]]); }   // the app's kink
      for (var i = 1; i < pts.length; i++) P.push(pts[i]);
      var segs = [], L = 0; for (var q = 1; q < P.length; q++) { var d = Math.hypot(P[q][0] - P[q - 1][0], P[q][1] - P[q - 1][1]); segs.push(d); L += d; }
      var old = LEADS[set][id]; LEADS[set][id] = { P: P, segs: segs, L: L, t0: old ? old.t0 : -1, on: old ? old.on : false, o: old ? old.o : 0 };
    }
    function leadOn(set, id, on) { var l = LEADS[set][id]; if (!l) return; if (on && !l.on) l.t0 = LNOW; l.on = on; }
    function sizeLines(cv) { var W = stage.clientWidth, H = stage.clientHeight, d = Math.min(2, devicePixelRatio || 1); if (cv.width !== Math.round(W * d) || cv.height !== Math.round(H * d)) { cv.width = Math.round(W * d); cv.height = Math.round(H * d); } return d; }
    function drawLines(cv, set, dt) {
      var c = cv.getContext('2d'), d = sizeLines(cv); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); c.setTransform(d, 0, 0, d, 0, 0);
      Object.keys(LEADS[set]).forEach(function (id) {
        var l = LEADS[set][id]; l.o = reduce ? (l.on ? 1 : 0) : clamp(l.o + (l.on ? 1 : -1) * dt / 0.35, 0, 1); if (l.o <= 0) return;
        var drawn = reduce ? l.L : l.L * outCubic(seg(LNOW - l.t0, 0.15, 0.75));
        function at(s) { for (var q = 0; q < l.segs.length; q++) { if (s <= l.segs[q] || q === l.segs.length - 1) { var f = l.segs[q] ? clamp(s / l.segs[q], 0, 1) : 0; return [mix(l.P[q][0], l.P[q + 1][0], f), mix(l.P[q][1], l.P[q + 1][1], f)]; } s -= l.segs[q]; } return l.P[0]; }
        c.fillStyle = 'rgba(150,197,160,' + (0.95 * l.o).toFixed(3) + ')';
        for (var s = 0; s < drawn; s += 8) { var p = at(s); c.beginPath(); c.arc(p[0], p[1], 1.6, 0, TAU); c.fill(); }
        if (drawn >= l.L - 1 && !reduce) {
          var nRun = Math.max(1, Math.round(l.L / 100)), v = Math.min(110, l.L / 2.4);
          for (var m = 0; m < nRun; m++) {
            var sR = (LNOW * v + m * l.L / nRun) % l.L, fe = Math.sin(Math.PI * sR / l.L), p2 = at(sR);   // it swells in and out along the way
            c.fillStyle = 'rgba(63,138,83,' + (0.95 * l.o * (0.35 + 0.65 * fe)).toFixed(3) + ')'; c.beginPath(); c.arc(p2[0], p2[1], 1.6 + 1.0 * fe, 0, TAU); c.fill();
          }
        }
      });
    }
    var mLines = $('.look__magnet .look__lines', look), pLines = photo && $('.look__lines', photo), praf = 0, pLast = 0;
    function photoLoop(now) {
      var dt = Math.min(0.05, (now - pLast) / 1000); pLast = now; LNOW += dt;
      drawLines(pLines, 'measure', dt);
      if (feat === 'measure') praf = requestAnimationFrame(photoLoop); else { praf = 0; LEADS.measure.ir.on = LEADS.measure.air.on = false; LEADS.measure.ir.o = LEADS.measure.air.o = 0; }
    }
    function edgeX(y) { return PH.top[0] + (y - PH.top[1]) * (PH.bot[0] - PH.top[0]) / (PH.bot[1] - PH.top[1]); }
    function layoutPhoto() {
      if (!photo) return;
      var W = stage.clientWidth, H = stage.clientHeight, nar = narrow.matches;
      var k = H * (nar ? 0.86 : 1) / PH.h, L = W * (nar ? 0.6 : 0.6) - PH.cx * k, T = (H - PH.h * k) / 2;   // the tube runs the stage's height, its ends fade
      var X = function (v) { return L + v * k; }, Y = function (v) { return T + v * k; };
      var img = $('img', photo); img.style.width = (PH.w * k).toFixed(1) + 'px'; img.style.left = L.toFixed(1) + 'px'; img.style.top = T.toFixed(1) + 'px';
      var mk = $$('.look__mark', photo);
      mk[0].style.left = X(PH.ir[0]).toFixed(1) + 'px'; mk[0].style.top = Y(PH.ir[1]).toFixed(1) + 'px';
      mk[1].style.left = X(PH.air[0]).toFixed(1) + 'px'; mk[1].style.top = Y(PH.air[1]).toFixed(1) + 'px';
      var lx = X(edgeX(PH.air[1])) - (nar ? 34 : 80), room = Math.max(100, Math.min(nar ? 150 : 210, lx - (nar ? 14 : 24)));   // v47: narrow notes (three lines, two lines)
      function put(el, x, y, ax, ay) { el.style.maxWidth = room + 'px'; el.style.left = (x - ax * Math.min(el.offsetWidth, room)).toFixed(1) + 'px'; el.style.top = (y - ay * el.offsetHeight).toFixed(1) + 'px'; }
      // v47: the title row a small step off the point: the line runs out level, takes the app's small kink, and ends at the title
      var KN = nar ? 12 : 18, irY = Y(PH.ir[1]) - KN, airY = Y(PH.air[1]) + KN;
      putT($('.look__pn--ir', photo), lx, irY); putT($('.look__pn--air', photo), lx, airY);
      function putT(el, x, ty) { el.style.maxWidth = room + 'px'; var b = $('b', el); el.style.left = (x - Math.min(el.offsetWidth, room)).toFixed(1) + 'px'; el.style.top = (ty - b.offsetHeight / 2).toFixed(1) + 'px'; }
      setLead('measure', 'ir', [[X(PH.ir[0]) - 10, Y(PH.ir[1])], [lx + 12, irY]]);
      setLead('measure', 'air', [[X(PH.air[0]) - 8, Y(PH.air[1])], [lx + 12, airY]]);
    }
    // v46: the magnetic mount, as in the scroll story: the housing with the sticker (one picture), Ember's 14 frames from off
    // the housing to on it (mode=magnet, cropped to where it moves, in one sheet), played as a short loop: it waits off the
    // surface, the magnet pulls it in (faster and faster), it clicks on and its lights wake, dots spring off; then it lifts off
    var MG = {w: 1100, h: 1375, frames: 14, cols: 7, crop: [290, 382, 438, 622], so: {crop: [480, 442, 202, 490], centre: [579.2, 686.5], n20: [-56.6, 2.0]}, lights: [[556.0, 541.2], [573.6, 551.7], [584.8, 572.3], [586.4, 597.2], [578.0, 619.8], [562.1, 633.9], [542.8, 635.7], [525.5, 624.9], [514.6, 604.5], [513.0, 579.9], [521.1, 557.6], [536.8, 543.4]], ember: [535.8, 688.0], half: [62, 236], mm: 4.51, dot: 4.5, left: [482, 700], sticker: [622.6, 834.3], house: [815, 834], foot: [560, 960]};   // from magnet.json (image px)
    var mag = $('.look__magnet', look), mimg = mag && $('img', mag), mcv = mag && $('canvas', mag), mctx = mcv && mcv.getContext('2d');
    var msheet = new Image(), mReady = false, mraf = 0, mT = 0, mLast = 0, mK = 1, mDots = [], mClick = -1, mD = 1;
    // v51: the loop as the scroll story tells it: the tube bare, the sticker going on, Ember there off the surface, the magnet
    // pulling it in, the click; it lifts off again, and the sticker comes off before it starts over (seconds)
    var MP = { bare: 0.5, stick: 1.35, appear: 1.95, wait: 2.6, pull: 3.35, hold: 5.6, lift: 6.5, gone: 6.9, peel: 7.4 }, MPER = 7.4;
    var ssheet = new Image(), sReady = false;
    msheet.onload = function () { mReady = true; if (feat === 'magnet') drawMagnet(); };
    ssheet.onload = function () { sReady = true; if (feat === 'magnet') drawMagnet(); };
    function layoutMagnet() {
      if (!mag) return;
      var W = stage.clientWidth, H = stage.clientHeight, nar = narrow.matches;
      mK = H / MG.h; var L = W * (nar ? 0.5 : 0.52) - MG.ember[0] * mK, w = MG.w * mK, h = MG.h * mK;
      [mimg, mcv].forEach(function (el) { el.style.width = w.toFixed(1) + 'px'; el.style.height = h.toFixed(1) + 'px'; el.style.left = L.toFixed(1) + 'px'; el.style.top = '0px'; });
      mD = Math.min(2, devicePixelRatio || 1); mcv.width = Math.round(w * mD); mcv.height = Math.round(h * mD);
      var X = function (v) { return L + v * mK; }, Y = function (v) { return v * mK; };
      var sp = $('.look__pn--sticker', mag), on = $('.look__pn--on', mag), room = nar ? 120 : 220;
      // the sticker's note on the right of the housing, Ember's on its left
      var sx = Math.min(X(MG.house[0]) + 36, W - Math.min(sp.offsetWidth, room) - 24), sy = Y(MG.sticker[1]) - sp.offsetHeight / 2, sLead;
      if (nar) {                                  // on a phone the tube fills the width: the note goes under the sticker, its line down
        sx = Math.min(X(MG.sticker[0]) - 10, W - Math.min(sp.offsetWidth, room) - 12); sy = Y(MG.foot[1]) + 30;
        sLead = [[X(MG.sticker[0]), Y(MG.sticker[1]) + 10], [X(MG.sticker[0]), sy - 8]];
      } else { sy = Y(MG.sticker[1]) + 18 - $('b', sp).offsetHeight / 2; sLead = [[X(MG.sticker[0]) + 8, Y(MG.sticker[1])], [sx - 12, Y(MG.sticker[1]) + 18]]; }
      sp.style.maxWidth = room + 'px'; sp.style.left = sx.toFixed(1) + 'px'; sp.style.top = sy.toFixed(1) + 'px';
      var ox = X(MG.left[0]) - (nar ? 76 : 100);
      on.style.maxWidth = room + 'px'; on.style.left = (ox - Math.min(on.offsetWidth, room)).toFixed(1) + 'px'; on.style.top = (Y(MG.left[1]) - on.offsetHeight / 2).toFixed(1) + 'px';
      setLead('magnet', 'sticker', sLead);
      setLead('magnet', 'on', [[X(MG.left[0]) - 8, Y(MG.left[1])], [ox + 12, Y(MG.left[1]) - (nar ? 12 : 18)]]);
      on.style.top = (Y(MG.left[1]) - (nar ? 12 : 18) - $('b', on).offsetHeight / 2).toFixed(1) + 'px';
      if (!msheet.src) { msheet.src = 'assets/img/magnet-frames.webp?v=53'; ssheet.src = 'assets/img/magnet-sticker.webp?v=53'; }
      drawMagnet(); if (reduce) drawLines(mLines, 'magnet', 0);
    }
    function frameAt(t) {
      if (reduce) return MG.frames - 1;
      var n = MG.frames - 1;
      if (t < MP.wait) return 0;
      if (t < MP.pull) return n * inQuad(seg(t, MP.wait, MP.pull));
      if (t < MP.hold) return n;
      return n * (1 - inOut(seg(t, MP.hold, MP.lift)));
    }
    function emberAt(t) { return reduce ? 1 : smooth(seg(t, MP.stick, MP.appear)) * (1 - smooth(seg(t, MP.lift, MP.gone))); }
    // the sticker as in the scroll story: it comes in along the normal, a little larger, and lands on the surface;
    // [how far it has come (1: on the tube), how much of it shows]
    function stickerAt(t) {
      if (reduce) return [1, 1];
      if (t < MP.bare) return [0, 0];
      if (t < MP.stick) { var e = seg(t, MP.bare, MP.stick); return [smooth(e), smooth(seg(e, 0, 0.3))]; }
      if (t < MP.gone) return [1, 1];
      var e2 = seg(t, MP.gone, MP.peel); return [1 - inOut(e2), 1 - smooth(seg(e2, 0.5, 1))];
    }
    function drawMagnet() {
      if (!mctx) return;
      var t = reduce ? MP.pull + 1 : mT % MPER, f = frameAt(t), on = f >= MG.frames - 1.001;
      mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.clearRect(0, 0, mcv.width, mcv.height);
      mctx.setTransform(mD * mK, 0, 0, mD * mK, 0, 0);
      function sheet(img, cr, cols, nf, fi, alpha) {        // a frame from a sheet (cross-faded between two), laid where it was cut out
        var i0 = Math.floor(fi), fr = fi - i0, i1 = Math.min(nf - 1, i0 + 1), src = function (i) { return [(i % cols) * cr[2], Math.floor(i / cols) * cr[3]]; };
        var a = src(i0); mctx.globalAlpha = alpha; mctx.drawImage(img, a[0], a[1], cr[2], cr[3], cr[0], cr[1], cr[2], cr[3]);
        if (fr > 0.02 && i1 !== i0) { var b = src(i1); mctx.globalAlpha = alpha * fr; mctx.drawImage(img, b[0], b[1], cr[2], cr[3], cr[0], cr[1], cr[2], cr[3]); }
        mctx.globalAlpha = 1;
      }
      var st = stickerAt(t), eo = emberAt(t);
      if (sReady && st[1] > 0.01) {
        var so = MG.so, ph = 1 - st[0], sk = 1 + 0.3 * ph;            // the story's sticker: 1.6 steps off its surface, a third larger
        mctx.save(); mctx.globalAlpha = st[1];
        mctx.translate(so.centre[0] + so.n20[0] * 1.1 * ph, so.centre[1] + so.n20[1] * 1.1 * ph); mctx.scale(sk, sk); mctx.translate(-so.centre[0], -so.centre[1]);
        mctx.drawImage(ssheet, so.crop[0], so.crop[1]); mctx.restore();
      }
      if (mReady && eo > 0.01) sheet(msheet, MG.crop, MG.cols, MG.frames, f, eo);
      // the lights: a flash as it lands, then a soft white while it is on, out as it lifts
      var since = t - MP.pull, glow = reduce ? 0.6 : on && eo > 0.5 ? (since < 0 ? 0 : since < 0.25 ? since / 0.25 : mix(1, 0.55, smooth(seg(since, 0.25, 1.2)))) : 0;
      if (!reduce && t > MP.hold) glow = 0.55 * (1 - smooth(seg(t, MP.hold, MP.hold + 0.3)));
      if (glow > 0.01) {
        var r = MG.dot * 4.2;
        MG.lights.forEach(function (p) {
          // v57: no glow round the lights, only the lights themselves
          mctx.fillStyle = 'rgba(255,252,246,' + Math.min(1, glow * 1.2).toFixed(3) + ')'; mctx.beginPath(); mctx.ellipse(p[0], p[1], MG.dot * 0.8, MG.dot, 0, 0, TAU); mctx.fill();
        });
      }
      // the click: dots spring off its outline and fade
      mDots.forEach(function (d) {
        var age = mT - d.t0; if (age < 0 || age > d.life) return;
        var e = 1 - Math.exp(-age * 3.2), x = d.x + d.vx * e, y = d.y + d.vy * e, o = 1 - age / d.life;
        mctx.globalAlpha = o * o * 0.85; mctx.fillStyle = d.c; mctx.beginPath(); mctx.arc(x, y, d.r, 0, TAU); mctx.fill();
      });
      mctx.globalAlpha = 1;
      var lifted = !reduce && t > MP.stick + 0.1 && t < MP.pull - 0.2;     // v51: the sticker's note once it lies on the tube, until Ember comes
      $('.look__pn--sticker', mag).classList.toggle('is-on', lifted); leadOn('magnet', 'sticker', lifted);
      var landed = reduce || (t > MP.pull + 0.35 && t < MP.hold);
      $('.look__pn--on', mag).classList.toggle('is-on', landed); leadOn('magnet', 'on', landed);
    }
    function spring() {
      mDots = []; var r = Math.random, cx = MG.ember[0], cy = MG.ember[1], rx = MG.half[0], ry = MG.half[1];
      for (var k = 0; k < 34; k++) {
        var a = r() * TAU, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry, sp = (16 + r() * 38) * MG.mm / 4;
        mDots.push({ t0: mT, life: 0.7 + r() * 0.6, x: x, y: y, vx: Math.cos(a) * sp * 1.6, vy: Math.sin(a) * sp, r: (0.8 + r() * 1.1) * MG.mm / 5, c: r() < 0.3 ? '#3f8a53' : '#86868b' });
      }
    }
    function magLoop(now) {
      var dt = Math.min(0.05, (now - mLast) / 1000); mLast = now;
      var before = mT % MPER; mT += dt; var after = mT % MPER; LNOW += dt;
      if (before < MP.pull && after >= MP.pull) spring();
      drawMagnet(); drawLines(mLines, 'magnet', dt);
      if (feat === 'magnet' && !reduce) mraf = requestAnimationFrame(magLoop); else mraf = 0;
    }
    // v51: the lights on the hardware close up: the ring fills from the top light down both sides to the bottom one, holds,
    // fades, and fills again in the next of the app's colours (white, green, orange, red)
    var RG = {w: 2400, h: 3840, ppm: 40.0, ring: [1200.0, 1344.0], dot: 40.0, lights: [[1200.0, 920.0], [1412.0, 976.8], [1567.2, 1132.0], [1624.0, 1344.0], [1567.2, 1556.0], [1412.0, 1711.2], [1200.0, 1768.0], [988.0, 1711.2], [832.8, 1556.0], [776.0, 1344.0], [832.8, 1132.0], [988.0, 976.8]]};   // from ring.json (image px)
    var ringF = $('.look__ring', look), rimg = ringF && $('img', ringF), rcv = ringF && $('canvas', ringF), rctx = rcv && rcv.getContext('2d'), rK = 1, rD = 1, rraf = 0, rT = 0, rLast = 0;
    var RCOL = [[255, 248, 236], [120, 200, 140], [247, 176, 82], [240, 96, 84]];
    function layoutRing() {
      if (!ringF) return;
      var W = stage.clientWidth, H = stage.clientHeight, nar = narrow.matches;
      rK = Math.min(W * (nar ? 0.56 : 0.5), H * 0.5) / (35 * RG.ppm);                   // Ember's 35 mm as wide as about half the stage
      var w = RG.w * rK, h = RG.h * rK, L = W / 2 - RG.ring[0] * rK, T = H * (nar ? 0.44 : 0.46) - RG.ring[1] * rK;
      [rimg, rcv].forEach(function (el) { el.style.width = w.toFixed(1) + 'px'; el.style.height = h.toFixed(1) + 'px'; el.style.left = L.toFixed(1) + 'px'; el.style.top = T.toFixed(1) + 'px'; });
      rD = Math.min(2, devicePixelRatio || 1); fit(rcv, w * rD, h * rD); drawRing();
    }
    function drawRing() {
      if (!rctx) return;
      rctx.setTransform(1, 0, 0, 1, 0, 0); rctx.clearRect(0, 0, rcv.width, rcv.height); rctx.setTransform(rD * rK, 0, 0, rD * rK, 0, 0);
      var PER = 3.4, cyc = Math.floor(rT / PER), t = rT - cyc * PER, col = RCOL[reduce ? 1 : cyc % 4];
      for (var j = 0; j < 12; j++) {
        var on, t0 = 0.15 + j * 0.15;                            // v52: round like a clock: the top light first, then clockwise
        if (reduce) on = 1;
        else on = smooth(seg(t, t0, t0 + 0.14)) * (1 - smooth(seg(t, 2.75, 3.15)));
        var head = reduce ? 0 : Math.exp(-Math.pow((t - t0 - 0.1) / 0.1, 2));   // the one lighting up now, a little brighter
        if (on < 0.01) continue;
        var p = RG.lights[j], a = on * (0.75 + 0.25 * head);   // v57: no glow round the lights
        rctx.fillStyle = 'rgba(' + col.map(function (v) { return Math.round(mix(v, 255, 0.35 * head)); }) + ',' + Math.min(1, a * 1.1).toFixed(3) + ')';
        rctx.beginPath(); rctx.arc(p[0], p[1], RG.dot * 1.02, 0, TAU); rctx.fill();
      }
    }
    function ringLoop(now) { rT += Math.min(0.05, (now - rLast) / 1000); rLast = now; drawRing(); if (feat === 'lights' && !reduce) rraf = requestAnimationFrame(ringLoop); else rraf = 0; }
    if (ir) prod.appendChild(ir);                       // the sensor marks turn and zoom with the product
    var FEAT = {
      measure: { deg: 180, zoom: 1, fx: 0.5, fy: 0.5 },            // v45: the photo on the battery housing shows instead
      app:     { deg: 0, zoom: 0.5, fx: 0.5, fy: 0.5 },             // v45: Ember steps aside for the phone; zoom set in view()
      magnet:  { deg: 0, zoom: 1, fx: 0.5, fy: 0.5 },               // v46: the click on the housing shows instead
      lights:  { deg: 0, zoom: 2.0, fx: 0.5, fy: 0.315 },
      size:    { deg: 90, zoom: 0.9, fx: 0.5, fy: 0.5 },             // v47: a step smaller, the 1,5 cm measure clear of the stage's foot
      box:     { deg: 0, zoom: 0.55, fx: 0.5, fy: 0.5 },
      all:     { deg: null, zoom: 1, fx: 0.5, fy: 0.5 }
    };
    var slider = $('.look__slider input', look);
    // v23: turning (drag, keys, slider) is the zero state, with nothing chosen; once a part is chosen it holds that view
    var turn = makeTurn(prod, { FW: 420, FH: 1260, host: prod, locked: function () { return cur >= 0; }, onAngle: function (a) { drawLights(a); if (slider && document.activeElement !== slider) slider.value = String(Math.round(((a % 360) + 360) % 360)); } });
    if (slider) slider.addEventListener('input', function () { if (cur >= 0) return; turn.spin(false); turn.set(+slider.value); });
    function drawLights(ang) {
      ang = ((ang % 360) + 360) % 360;
      if (ir) ir.classList.toggle('is-on', feat === 'measure' && Math.abs(ang - 180) < 12);
      var w = lightsC.clientWidth, h = lightsC.clientHeight, d = Math.min(2, devicePixelRatio || 1);
      if (lightsC.width !== Math.round(w * d)) { lightsC.width = Math.round(w * d); lightsC.height = Math.round(h * d); }
      lctx.setTransform(d * w / 420, 0, 0, d * h / 1260, 0, 0); lctx.clearRect(0, 0, 420, 1260);
      var rad = ang * Math.PI / 180, cb = Math.cos(rad), sb = Math.sin(rad);
      if (cb < 0.15 || feat !== 'lights' || (ringF && !onPhone())) return;   // v51: the lights show on the close up now
      var COL = [[255, 248, 236], [169, 221, 181], [247, 196, 112], [244, 135, 123]], ph = (lightT * 0.35) % 4, k0 = Math.floor(ph), k1 = (k0 + 1) % 4, e = smooth(clamp((ph - k0 - 0.6) / 0.4, 0, 1));
      var col = [0, 1, 2].map(function (i) { return Math.round(mix(COL[k0][i], COL[k1][i], e)); }).join(',');
      var shown = e < 0.5 ? k0 : k1;                                          // v45: the note names the colour and its state in the app
      if (shown !== ringShown && ringWord) { ringShown = shown; ringWord.textContent = RING[shown][0]; ringState.textContent = 'In de app: ' + RING[shown][1]; }
      for (var j = 0; j < 12; j++) {
        var la = (90 - 30 * j) * Math.PI / 180, lx = 10.6 * Math.cos(la), lz = 22.4 + 10.6 * Math.sin(la);
        var x = 210 + (lx * cb + 7.5 * sb) * 10.5, y = 630 - lz * 10.5, r0 = 9 * Math.min(1, cb + 0.2);
        // v57: no glow round the lights
        lctx.fillStyle = 'rgba(' + col + ',1)'; lctx.beginPath(); lctx.ellipse(x, y, Math.max(1, r0 * cb), r0, 0, 0, TAU); lctx.fill();
      }
    }
    function lightLoop(now) { lightT += Math.min(0.05, (now - lastL) / 1000); lastL = now; drawLights(turn.angle()); if (feat === 'lights') lraf = requestAnimationFrame(lightLoop); else lraf = 0; }
    function view(f) {
      feat = f; var F = FEAT[f];
      if (f === 'lights' && onPhone()) F = { deg: 0, zoom: 1, fx: 0.5, fy: 0.5 };   // v55: on a phone the whole Ember, not the close up of its top
      if (f === 'size' && onPhone()) F = { deg: 90, zoom: 1.1, fx: 0.5, fy: 0.5 };    // v57: on a phone a step larger, so the measures read
      stage.setAttribute('data-f', f);
      notes.forEach(function (n) { n.classList.toggle('is-on', n.getAttribute('data-v') === f); });
      if (F.deg != null) turn.goTo(F.deg);
      turn.spin(false);                                  // v18: it only turns when you drag it or choose a step
      var sw = stage.clientWidth, sh = stage.clientHeight, pw = prod.clientWidth, ph = prod.clientHeight, nar = narrow.matches;
      // v48: the camera's frame leaves room for the slider under it again; the views still centre on the whole stage
      var ct = cam.offsetTop, ch = cam.clientHeight || sh;
      var P = [sw / 2 + (F.fx - 0.5) * pw, ct + F.fy * ch], C = [sw / 2, ct + ch / 2], T = f === 'all' ? C : [sw / 2, sh / 2];
      if (f === 'app' && ph) {
        // the render's frame is 120 mm high: the app's screen at the same scale, as high as the stage allows. v56: only the
        // screen, no device round it, in the app's own format (390 x 844, the design frame: a 6,1-inch display, 64,6 x 139,8 mm)
        var PHW = 64.6, PHH = 139.8;
        var mm = Math.min(sh * 0.8 / PHH, sw * (nar ? 0.5 : 0.36) / PHW), z = mm * 120 / ph, gap = 14 * mm, ew = 35 * mm, pwp = PHW * mm;   // v51: the two closer together
        var x0 = sw / 2 - (ew + gap + pwp) / 2;
        F.zoom = z; T = [x0 + ew / 2, sh / 2 + (PHH / 2 - 53.1) * mm];   // v46: Ember's foot (53,1 mm under its centre) level with the screen's
        phoneV.style.setProperty('--mm', mm.toFixed(3) + 'px'); phoneV.style.left = (x0 + ew + gap).toFixed(1) + 'px'; phoneV.style.top = (sh / 2 - PHH * mm / 2).toFixed(1) + 'px';
      }
      if (f === 'measure') { layoutPhoto(); leadOn('measure', 'ir', true); leadOn('measure', 'air', true); LEADS.measure.ir.t0 = LEADS.measure.air.t0 = LNOW + 0.45; if (!praf) { pLast = performance.now(); praf = requestAnimationFrame(photoLoop); } }
      if (f === 'magnet') { layoutMagnet(); Object.keys(LEADS.magnet).forEach(function (k) { LEADS.magnet[k].on = false; LEADS.magnet[k].o = 0; }); if (!mraf && !reduce) { mT = 0; mDots = []; mLast = performance.now(); mraf = requestAnimationFrame(magLoop); } }
      var tx = T[0] - C[0] - F.zoom * (P[0] - C[0]), ty = T[1] - C[1] - F.zoom * (P[1] - C[1]);
      cam.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + F.zoom + ')';
      // v57: on a phone the measures 15 px on the screen, whatever Ember's size (they are text in its drawing and shrank with it, to about 6 px)
      if (dims) { var dk = (prod.clientHeight / 1260) * F.zoom; dims.style.setProperty('--dim-fs', onPhone() && dk > 0 ? (15 / dk).toFixed(1) + 'px' : ''); }
      notes.forEach(function (n) { if (n.getAttribute('data-v') !== f || f !== 'lights') return; if (!nar) { n.style.left = Math.min(T[0] + pw * F.zoom * 0.5 + 28 + n.offsetWidth / 2, sw - n.offsetWidth / 2 - 24) + 'px'; n.style.top = T[1] + 'px'; } else { n.style.left = ''; n.style.top = ''; } });   // v45: kept inside the stage
      if (f === 'lights' && onPhone()) { if (!lraf) { lastL = performance.now(); lraf = requestAnimationFrame(lightLoop); } }   // v55: the lights on the whole product, in the app's colours one after the other
      else if (f === 'lights') { layoutRing(); if (!rraf && !reduce) { rT = 0; rLast = performance.now(); rraf = requestAnimationFrame(ringLoop); } }   // v51: the close up, not the turntable
      drawLights(turn.angle());
    }
    function open(i, focus) {
      var was = cur; cur = i;
      if (i < 0 && was >= 0) turn.goTo(0);              // v23: closing a part brings it back to the zero state, the front
      items.forEach(function (it, k) { var on = k === i; it.classList.toggle('is-open', on); pills[k].setAttribute('aria-expanded', String(on)); });
      grid.classList.toggle('is-open', i >= 0);
      view(i >= 0 ? items[i].getAttribute('data-f') : 'all');
      if (typeof railSync === 'function') railSync(i);     // v55: first show the part, then it can take the focus
      if (focus != null && pills[focus]) pills[focus].focus({ preventScroll: true });
    }
    // v55: on a phone one part at a time, in the middle between an arrow on each side; one tap on an arrow goes to the
    // previous or next part and opens it; tapping the part itself opens or closes it. Its text shows under the row
    function onPhone() { return (onPhone.mq || (onPhone.mq = matchMedia('(max-width: 860px)'))).matches; }
    var prevB = $('.look__arrow--prev', look), nextB = $('.look__arrow--next', look), desc = $('.look__desc', look), vis = 0;
    function railSync(i) {
      if (i >= 0) vis = i;
      items.forEach(function (it, k) { it.classList.toggle('is-vis', k === vis); });
      if (prevB) { prevB.disabled = vis <= 0; nextB.disabled = cur >= 0 && vis >= items.length - 1; }
      if (desc) desc.innerHTML = i >= 0 ? $('.xf__more > div', items[i]).innerHTML : '';
    }
    if (prevB) prevB.addEventListener('click', function () { if (vis > 0) open(vis - 1); });
    // the first tap opens the part that shows, if none is open yet (on a phone the pill has no plus), then on to the next
    if (nextB) nextB.addEventListener('click', function () { if (cur < 0) open(vis); else if (vis < items.length - 1) open(vis + 1); });
    pills.forEach(function (b, k) { b.addEventListener('click', function () { open(cur === k ? -1 : k); }); });
    look.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && cur >= 0) { var was = cur; open(-1); pills[was].focus(); e.preventDefault(); return; }
      if (/^Arrow(Down|Up|Left|Right)$/.test(e.key) && document.activeElement && document.activeElement.classList.contains('xf__pill')) {   // v55: left and right too, for the row on a phone
        var k = pills.indexOf(document.activeElement), n = clamp(k + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1), 0, items.length - 1);
        if ((cur >= 0 && n !== cur) || getComputedStyle(items[n]).display === 'none') open(n, n); else pills[n].focus(); e.preventDefault();   // v55: on a phone the other parts are hidden, so go there
      }
    });
    var lookW = -1, lookH = -1;                          // v54: only on a real change of the stage's size (not the phone's bar sliding)
    addEventListener('resize', function () { if (stage.clientWidth === lookW && stage.clientHeight === lookH) return; lookW = stage.clientWidth; lookH = stage.clientHeight; view(feat); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { es.forEach(function (e) { turn.active(e.isIntersecting); }); }, { rootMargin: '10%' }).observe(look); else turn.active(true);
    open(-1);
  })();

  /* v41: the figures: the 45 dots come in one by one (the red one last), the bars grow one after the other */
  $$('.cijf__array i').forEach(function (d, k) { d.style.transitionDelay = (reduce ? 0 : k === 0 ? 1.5 : 0.15 + k * 0.022).toFixed(3) + 's'; });
  $$('.cijf__bar i').forEach(function (b, k) { b.style.setProperty('--v', b.getAttribute('data-v')); b.style.transitionDelay = (reduce ? 0 : 0.1 + k * 0.08).toFixed(2) + 's'; });

  /* v41: the four steps: one pill open at a time and its screen on the stage; it moves on by itself while the section is in
     view (every 4.5 s), until you choose a step */
  var startSec = $('.start');
  if (startSec) (function () {
    var items = $$('.xf__item', startSec), imgs = $$('.start__phone img', startSec), cur = 0, timer = null, chosen = false;
    function show(i) {
      cur = i;
      items.forEach(function (it, k) { var on = k === i; it.classList.toggle('is-open', on); $('.xf__pill', it).setAttribute('aria-expanded', String(on)); });
      imgs.forEach(function (im, k) { im.classList.toggle('is-on', k === i); });
    }
    function stop() { clearInterval(timer); timer = null; }
    function start() { if (reduce || chosen || timer) return; timer = setInterval(function () { show((cur + 1) % items.length); }, 4500); }
    items.forEach(function (it, k) { $('.xf__pill', it).addEventListener('click', function () { chosen = true; stop(); show(k); }); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) start(); else stop(); }); }, { threshold: 0.35 }).observe(startSec);
    show(0);
  })();

  /* v40: the figures: the 45 dots come in row by row (the red one last), the bars grow one after the other */
  $$('.facts__array i').forEach(function (d, k) { d.style.transitionDelay = (reduce ? 0 : k === 0 ? 1.5 : 0.15 + k * 0.022).toFixed(3) + 's'; });
  $$('.facts__bar i').forEach(function (b, k) { b.style.setProperty('--v', b.getAttribute('data-v')); b.style.transitionDelay = (reduce ? 0 : 0.1 + k * 0.08).toFixed(2) + 's'; });
  /* v38: the figures' circle: the 45 dots come in one after the other round the circle, the red one (one in 45) last */
  $$('.figs__dot').forEach(function (d, k) { d.style.transitionDelay = (reduce ? 0 : k === 0 ? 1.7 : 0.2 + k * 0.03).toFixed(2) + 's'; });

  /* =================================================================== the questions: the same pills, each opens on its own */
  $$('.faq .xf__item').forEach(function (it) {
    var b = $('.xf__pill', it);
    b.addEventListener('click', function () { var on = !it.classList.contains('is-open'); it.classList.toggle('is-open', on); b.setAttribute('aria-expanded', String(on)); });
  });

  /* =================================================================== v58: a question that is not in the list
     The last pill opens a short form. With a server (data-api) it posts there; without one it opens the visitor's own
     mail app with the question in it, to the address in the footer. It never says a question was sent when it was not. */
  var askForm = $('.ask');
  if (askForm) (function () {
    var q = $('.ask__q', askForm), mail = $('input', askForm), btn = $('.ask__send', askForm), msg = $('.ask__msg', askForm);
    var api = (askForm.getAttribute('data-api') || '').replace(/\/$/, ''), to = askForm.getAttribute('data-mail') || 'info@avennex.eu';
    var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, busy = false;
    function say(html, kind) { msg.innerHTML = html; msg.className = 'ask__msg' + (kind ? ' is-' + kind : ''); }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    var mailLink = '<a href="mailto:' + to + '">' + to + '</a>';
    [q, mail].forEach(function (f) { f.addEventListener('input', function () { f.removeAttribute('aria-invalid'); }); });
    askForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var text = q.value.trim(), from = mail.value.trim();
      if (!EMAIL.test(from)) { mail.setAttribute('aria-invalid', 'true'); say('Vul een geldig e-mailadres in.', 'err'); mail.focus(); return; }
      if (text.length < 3) { q.setAttribute('aria-invalid', 'true'); say('Schrijf eerst je vraag.', 'err'); q.focus(); return; }
      if (!api) {
        var body = text + '\n\nAntwoord graag naar: ' + from;
        window.location.href = 'mailto:' + to + '?subject=' + encodeURIComponent('Vraag over Ember') + '&body=' + encodeURIComponent(body);
        say('Je mail opent met je vraag. Opent er niets? Mail naar ' + mailLink + '.', 'ok');
        return;
      }
      busy = true; btn.disabled = true; say('Bezig met versturen…');
      fetch(api + '/question', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, credentials: 'omit',
        body: JSON.stringify({ question: text, email: from, source: 'ember-site', page: location.pathname, lang: 'nl' }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.ok) throw new Error(j.error || ('http_' + r.status)); return j; }); })
        .then(function () { say('Bedankt, we antwoorden per e-mail.', 'ok'); askForm.reset(); })
        .catch(function () { say('Versturen lukte niet. Mail naar ' + mailLink + '.', 'err'); })
        .then(function () { busy = false; btn.disabled = false; });
    });
  })();

  /* =================================================================== the clouds: dots in 3D, as on stellar.org
     Each canvas[data-cloud] holds a point cloud that turns slowly and morphs between its shapes as the section
     passes (ring: the app's swarm; ember: the product's rounded body; globe). Drawn back to front with perspective;
     the nearer a dot, the larger and brighter. Grey dots with a few in the app's green. */
  function cloudShape(name, n, r) {
    var out = [], i, u, v, a;
    for (i = 0; i < n; i++) {
      u = r(); v = r(); a = r() * TAU;
      if (name === 'star') {                                    // the AI mark: a four-pointed star (and a small one), filled, a little depth
        var big = r() < 0.8, sx = 0, sy = 0, ss = 1;
        if (!big) { sx = 0.78; sy = -0.78; ss = 0.32; }
        var px, py; do { px = r() * 2 - 1; py = r() * 2 - 1; } while (Math.pow(Math.abs(px), 0.5) + Math.pow(Math.abs(py), 0.5) > 1);
        var bulge = 1 - Math.pow(Math.abs(px), 0.5) - Math.pow(Math.abs(py), 0.5);
        out.push([sx + px * ss, sy + py * ss, (r() * 2 - 1) * 0.14 * bulge * ss]);
      } else if (name === 'ring') {                                    // the app's ring: a torus, thin, a little loose
        var R0 = 1, tub = 0.08 + 0.12 * Math.pow(r(), 2), b = r() * TAU;
        out.push([(R0 + tub * Math.cos(b)) * Math.cos(a), tub * Math.sin(b) * 1.6, (R0 + tub * Math.cos(b)) * Math.sin(a)]);
      } else if (name === 'ember') {                            // Ember: points on a rounded slab 35 x 105 x 15
        var W2 = 0.35, H2 = 1.05, D2 = 0.15, side = r();
        var x = (u - 0.5) * 2 * W2, y = (v - 0.5) * 2 * H2, z = (side < 0.42 ? -1 : side < 0.84 ? 1 : (r() * 2 - 1)) * D2;
        if (side >= 0.84) { var e = r() < 0.5; if (e) x = (r() < 0.5 ? -1 : 1) * W2; else y = (r() < 0.5 ? -1 : 1) * H2; }
        // round the corners
        var cx = Math.max(Math.abs(x) - (W2 - 0.12), 0), cy = Math.max(Math.abs(y) - (H2 - 0.12), 0), k = Math.hypot(cx, cy);
        if (k > 0.12) { x -= Math.sign(x) * (k - 0.12) * cx / k; y -= Math.sign(y) * (k - 0.12) * cy / k; }
        out.push([x, y, z]);
      } else {                                                  // a globe, with the dots denser along its latitude lines
        var th = Math.acos(2 * v - 1), lat = Math.round((th / Math.PI) * 10) / 10 * Math.PI, ph = a, use = r() < 0.55 ? lat : th;
        out.push([Math.sin(use) * Math.cos(ph), Math.cos(use), Math.sin(use) * Math.sin(ph)]);
      }
    }
    return out;
  }
  $$('canvas[data-cloud]').forEach(function (c, ci) {
    var ctx = c.getContext('2d'), names = c.getAttribute('data-cloud').split(' '), N = narrow.matches ? 1400 : 2600;
    var seed = 7 + ci * 31, r = function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    var shapes = names.map(function (nm) { return cloudShape(nm, N, r); });
    var tone = []; for (var i = 0; i < N; i++) tone.push(r() < 0.12 ? 1 : 0);
    var host = c.closest('section'), W = 0, H = 0, dpr = 1, t = 0, last = 0, on = false, dark = host && host.classList.contains('proof');
    var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    function size() { dpr = Math.min(2, devicePixelRatio || 1); W = c.clientWidth; H = c.clientHeight; fit(c, W * dpr, H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    if (host) host.addEventListener('pointermove', function (e) { var b = c.getBoundingClientRect(); mouse.tx = clamp((e.clientX - b.left) / b.width - 0.5, -0.5, 0.5); mouse.ty = clamp((e.clientY - b.top) / b.height - 0.5, -0.5, 0.5); }, { passive: true });
    function frame(now) {
      if (!on) return;
      var dt = Math.min(0.05, (now - last) / 1000); last = now; t += reduce ? 0 : dt;
      mouse.x += (mouse.tx - mouse.x) * (1 - Math.exp(-dt * 3)); mouse.y += (mouse.ty - mouse.y) * (1 - Math.exp(-dt * 3));
      var rr = host.getBoundingClientRect(), k = clamp((innerHeight - rr.top) / (innerHeight + rr.height), 0, 1);
      var m = shapes.length > 1 ? smooth(seg(k, 0.12, 0.42)) : 0, A = shapes[0], B = shapes[shapes.length - 1];
      var star = names[names.length - 1] === 'star', ry = (star ? Math.sin(t * 0.5) * 0.35 : t * 0.18) + mouse.x * 0.8 + k * (star ? 0.4 : 1.2), rx = (star ? -0.05 : -0.35) + mouse.y * 0.5, cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
      var S = Math.min(W, H) * (names[0] === 'globe' ? 0.42 : 0.36), F = 3.2, pts = [];
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < N; i++) {
        var a = A[i], b = B[i], w = smooth(clamp((m - (i % 97) / 97 * 0.3) / 0.7, 0, 1));
        var x = mix(a[0], b[0], w), y = mix(a[1], b[1], w), z = mix(a[2], b[2], w);
        y += Math.sin(t * 0.8 + i) * 0.006;
        var x1 = x * cy + z * sy, z1 = -x * sy + z * cy, y1 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
        var pz = F / (F + z2);
        pts.push([W / 2 + x1 * S * pz, H / 2 + y1 * S * pz, z2, tone[i]]);
      }
      pts.sort(function (p1, p2) { return p2[2] - p1[2]; });
      for (var j = 0; j < pts.length; j++) {
        var q = pts[j], near = clamp(0.5 - q[2] * 0.5, 0, 1), rad = 0.55 + near * 1.1;
        ctx.fillStyle = q[3] ? 'rgba(130,185,142,' + (0.35 + near * 0.6).toFixed(2) + ')' : (dark ? 'rgba(236,238,242,' : 'rgba(35,37,43,') + (0.12 + near * 0.55).toFixed(2) + ')';
        ctx.fillRect(q[0] - rad, q[1] - rad, rad * 2, rad * 2);
      }
      requestAnimationFrame(frame);
    }
    size(); addEventListener('resize', size);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && !on) { on = true; last = performance.now(); requestAnimationFrame(frame); } else if (!e.isIntersecting) on = false; }); }, { rootMargin: '10%' }).observe(c);
    else { on = true; requestAnimationFrame(frame); }
  });

  /* =================================================================== the statement: holds in the middle while the words light up with the scroll */
  $$('[data-words]').forEach(function (stateText) { if (reduce) return;
    var pin = stateText.closest('.quote__pin'), hold = stateText.closest('.quote__hold');
    var words = stateText.textContent.trim().split(/\s+/); stateText.textContent = '';
    var spans = words.map(function (w, i) { var sp = document.createElement('span'); sp.className = 'w'; sp.textContent = w; stateText.appendChild(sp); if (i < words.length - 1) stateText.appendChild(document.createTextNode(' ')); return sp; });
    var FROM = [222, 223, 226], TO = [35, 37, 43], shown = [];        // v21: from white to black (it ran the other way)
    function size() { pin.style.setProperty('--sh', stateText.offsetHeight + 'px'); }
    jobs.push(function () {
      var H = innerHeight, hr = hold.getBoundingClientRect(), top = parseFloat(getComputedStyle(pin).top) || 0;
      var travel = Math.max(hr.height - pin.offsetHeight, 1);
      var p = clamp((top + H * 0.25 - hr.top) / (travel * 0.85 + H * 0.25), 0, 1), lit = p * (spans.length + 2);
      for (var i = 0; i < spans.length; i++) {
        var t = clamp(lit - i, 0, 1), q = Math.round(t * 20);
        if (shown[i] === q) continue; shown[i] = q; t = q / 20;
        spans[i].style.color = 'rgb(' + Math.round(mix(FROM[0], TO[0], t)) + ',' + Math.round(mix(FROM[1], TO[1], t)) + ',' + Math.round(mix(FROM[2], TO[2], t)) + ')';
      }
    });
    size(); addEventListener('resize', size);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { size(); ask(); });
  });
  // the partners: the track doubled for a seamless loop
  var ptrack = $('.partners__track');
  if (ptrack) Array.prototype.slice.call(ptrack.children).forEach(function (li) { var k = li.cloneNode(true); k.setAttribute('aria-hidden', 'true'); Array.prototype.forEach.call(k.querySelectorAll('img'), function (im) { im.alt = ''; }); ptrack.appendChild(k); });

  /* =================================================================== in practice: the white carousel */
  var track = $('.prak__track');
  if (track) (function () {
    var slides = $$('.slide', track), prev = $('.prak [data-car="prev"]'), next = $('.prak [data-car="next"]');
    function index() { var x = track.scrollLeft, best = 0, bd = Infinity; slides.forEach(function (sl, j) { var d = Math.abs(sl.offsetLeft - slides[0].offsetLeft - x); if (d < bd) { bd = d; best = j; } }); return best; }
    function update() {
      var i = index(), max = track.scrollWidth - track.clientWidth - 2;
      prev.disabled = track.scrollLeft <= 2; next.disabled = track.scrollLeft >= max;
    }
    function go(dir) { var i = clamp(index() + dir, 0, slides.length - 1); track.scrollTo({ left: slides[i].offsetLeft - slides[0].offsetLeft, behavior: reduce ? 'auto' : 'smooth' }); }
    prev.addEventListener('click', function () { go(-1); }); next.addEventListener('click', function () { go(1); });
    track.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } });
    track.addEventListener('scroll', function () { requestAnimationFrame(update); }, { passive: true });
    // drag with the mouse, as on a phone
    var down = null;
    track.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = { x: e.clientX, l: track.scrollLeft }; track.style.scrollSnapType = 'none'; track.setPointerCapture(e.pointerId); });
    track.addEventListener('pointermove', function (e) { if (down) track.scrollLeft = down.l - (e.clientX - down.x); });
    track.addEventListener('pointerup', function () { if (!down) return; down = null; track.style.scrollSnapType = ''; go(0); });
    addEventListener('resize', update); update();
  })();

  /* v30: footers to compare, ?footer=a to e (v31: d and e added) */
  var fvar = (location.search.match(/[?&]footer=([a-h])(?:&|$)/) || [])[1], footEl = $('.foot');
  if (fvar && footEl) footEl.setAttribute('data-v', fvar);

  /* =================================================================== the footer: Ember as in the hero, its twelve lights coming on one by one */
  var fprod = $('.foot__prod');
  if (fprod) {
    for (var fk = 0; fk < 12; fk++) {
      var fla = (90 - 30 * fk) * Math.PI / 180, fi = document.createElement('i');     // the hero's geometry: 7.5 px a mm in a 450 x 900 frame
      fi.style.left = ((225 + 79.5 * Math.cos(fla)) / 450 * 100).toFixed(2) + '%'; fi.style.top = ((282 - 79.5 * Math.sin(fla)) / 900 * 100).toFixed(2) + '%';
      fi.style.transitionDelay = (reduce ? 0 : 0.35 + fk * 0.085).toFixed(3) + 's'; fprod.appendChild(fi);
    }
    if ('IntersectionObserver' in window && !reduce) new IntersectionObserver(function (es, o) { es.forEach(function (e) { if (e.isIntersecting) { fprod.classList.add('is-on'); o.disconnect(); } }); }, { threshold: 0.4 }).observe(fprod);
    else fprod.classList.add('is-on');
  }

  /* =================================================================== reveal */
  var ins = $$('[data-in]');
  if (!reduce && 'IntersectionObserver' in window) {
    ins.forEach(function (el) { var sib = $$(':scope > [data-in]', el.parentNode); el.style.setProperty('--d', (Math.max(0, sib.indexOf(el)) * 0.08).toFixed(2) + 's'); });
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -10% 0px' });
    ins.forEach(function (el) { io.observe(el); });
  } else ins.forEach(function (el) { el.classList.add('is-in'); });
  ask();
})();
