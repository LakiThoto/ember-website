/* ============================================================================
   Ember · zwerm
   ----------------------------------------------------------------------------
   The swarm from the app, for the page. The 240 dots of the Figma component
   (zwerm-data.js) keep their own angle; a state only changes how far each dot
   sits from the ring, its colour and its opacity, so moving between states
   lets the swarm expand or draw in, as Smart Animate does in the prototype.

   Larger swarms add dots that copy the character of the 240 (same spread,
   sizes and colour slots). Canvas 2D, no library. Decorative: the canvas is
   aria-hidden, the swarm stands still under reduced motion and pauses while
   it is off screen.
   ========================================================================== */
(function () {
  'use strict';

  var Z = window.EMBER_ZWERM;
  var TAU = Math.PI * 2;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  var mix = function (a, b, t) { return a + (b - a) * t; };
  var ease = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  /* The states, as in the component: which distances, which palette, how restless */
  var STATES = {
    rust:       { pal: 'rust',     d: 4, amp: 0,    speed: 0.8, size: 1 },
    normaal:    { pal: 'normaal',  d: 4, amp: 0,    speed: 1,   size: 1 },
    aandacht:   { pal: 'aandacht', d: 5, amp: 0.02, speed: 1.4, size: 1 },
    oververhit: { pal: 'heet',     d: 6, amp: 0.05, speed: 1.9, size: 1.15 },
    geen:       { pal: 'geen',     d: 4, amp: 0,    speed: 0.3, size: 1, hide: true }
  };
  function rgb(h) {
    if (h === 'white' || h === '#FFFFFF') return [255, 255, 255];
    var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  var PAL = {}; Object.keys(Z.palette).forEach(function (k) { PAL[k] = Z.palette[k].map(rgb); });

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------------------ dots */
  function makeDots(extra, seed) {
    var r = rng(seed || 20261008), out = [];
    function add(src, a) {
      out.push({
        a: a, r: src[1], o: src[2], slot: src[3], d: [src[4], src[4], src[4], src[5], src[6]], g: src[7],
        ph: r() * TAU, f: 0.4 + r() * 0.9, sp: (0.05 + r() * 0.10) * (r() < 0.82 ? 1 : -1), u: r(),
        cur: src[4], op: 0, k: 2 + r() * 2.5
      });
    }
    Z.dots.forEach(function (s) { add(s, s[0]); });
    // more of the same: a random dot of the 240, at a new angle, with a slightly different distance
    for (var i = 0; i < extra; i++) {
      var s = Z.dots[Math.floor(r() * Z.dots.length)], j = (r() - 0.5) * 0.06;
      add([s[0], s[1] * (0.75 + r() * 0.4), s[2] * (0.7 + r() * 0.3), s[3], s[4] + j, s[5] + j * 1.6, s[6] + j * 2.4, s[7]], r() * TAU);
    }
    return out;
  }
  // index into d[]: rust and normaal share the distances
  var DI = { rust: 0, normaal: 1, aandacht: 3, oververhit: 4, geen: 2 };

  /* ----------------------------------------------------------------- Swarm */
  function Swarm(canvas, opt) {
    opt = opt || {};
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.dots = makeDots(opt.extra || 0, opt.seed);
    if (opt.every > 1) this.dots = this.dots.filter(function (d, i) { return i % opt.every === 0; });
    this.state = opt.state || 'normaal'; this.from = this.state; this.m = 1;   // m: progress of the change of state
    this.layout = opt.layout || function (w, h) { return { x: w / 2, y: h / 2, R: Math.min(w, h) * 0.4 }; };
    this.sizeK = opt.sizeK || 1;                 // extra factor on the dot size
    this.sizeExp = opt.sizeExp == null ? 0.55 : opt.sizeExp;   // 1: dots scale with the ring, as in the app; less: big swarms keep finer dots
    this.zoom = opt.zoom || function () { return 1; };          // CSS zoom on an ancestor (the phone)
    this.alpha = opt.alpha == null ? 1 : opt.alpha;
    this.t = 0; this.last = 0; this.run = false; this.dirty = true;
    this.pull = null;                            // { pts, centre, c } : drawn into points (Ember's lights)
    this.loose = opt.loose || 0;                 // 0 formed .. 1 scattered
    this.spin = 0;                               // extra rotation of the whole swarm (rad), e.g. driven by scroll
    this.squash = opt.squash || 1;               // < 1 flattens the ring into an orbit seen at an angle
    // palettes per state may be replaced (site v2: grafiet with Ember orange), the rest stays the component's
    this.pal = {}; var self = this;
    Object.keys(STATES).forEach(function (k) { var o = opt.palettes && opt.palettes[k]; self.pal[STATES[k].pal] = o ? o.map(rgb) : PAL[STATES[k].pal]; });
    this.resize();
    if ('ResizeObserver' in window) new ResizeObserver(function () { self.resize(); self.draw(); }).observe(canvas);
  }
  Swarm.STATES = STATES;
  Swarm.prototype.resize = function () {
    // layout size (unaffected by an ancestor's zoom), drawn at the pixels it really covers
    var d = Math.min(2, window.devicePixelRatio || 1) * this.zoom();
    this.w = this.c.offsetWidth; this.h = this.c.offsetHeight;
    var nw = Math.max(1, Math.round(this.w * d)), nh = Math.max(1, Math.round(this.h * d));
    if (this.c.width === nw && this.c.height === nh) { this.ctx.setTransform(d, 0, 0, d, 0, 0); return; }   // the same size: keep it (setting it again clears it, a flicker on a phone)
    this.c.width = nw; this.c.height = nh;
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
    this.dirty = true;
    if (!this.run && this.dots) this.step(0);         // a resized canvas is blank: draw it again when no loop will
  };
  Swarm.prototype.set = function (state) {
    if (!STATES[state] || state === this.state) return;
    this.from = this.state; this.state = state; this.m = reduce ? 1 : 0; this.dirty = true;
    if (reduce) this.draw();
  };
  Swarm.prototype.colour = function (slot, w) {
    var A = this.pal[STATES[this.from].pal][slot], B = this.pal[STATES[this.state].pal][slot];
    return [mix(A[0], B[0], w), mix(A[1], B[1], w), mix(A[2], B[2], w)];
  };
  Swarm.prototype.step = function (dt) {
    var S = STATES[this.state], F = STATES[this.from];
    if (this.m < 1) this.m = Math.min(1, this.m + dt / 0.9);
    var w = ease(this.m), speed = mix(F.speed, S.speed, w), amp = mix(F.amp, S.amp, w), size = mix(F.size, S.size, w);
    var hideF = F.hide ? 1 : 0, hideS = S.hide ? 1 : 0, hide = mix(hideF, hideS, w);
    var sp = reduce ? 0 : 1; this.t += dt * sp;
    var L = this.layout(this.w, this.h), R = L.R, ctx = this.ctx, t = this.t;
    var px = Math.pow(R / Z.ring, this.sizeExp) * this.sizeK;
    ctx.clearRect(0, 0, this.w, this.h);
    var cols = [this.colour(0, w), this.colour(1, w), this.colour(2, w), this.colour(3, w)];
    var P = this.pull, pc = P ? P.c : 0, loose = this.loose;
    for (var i = 0; i < this.dots.length; i++) {
      var p = this.dots[i];
      p.a += p.sp * 0.25 * speed * dt * sp;
      var target = mix(p.d[DI[this.from]], p.d[DI[this.state]], w);
      var br = Math.sin(t * p.f + p.ph) * 0.012 + Math.sin(t * (4 + p.f * 2) + p.ph) * amp;
      var d = target * (1 + br) + loose * (p.u - 0.5) * 1.1;
      var ang = p.a + this.spin;
      var x = L.x + Math.cos(ang) * d * R, y = L.y + Math.sin(ang) * d * R * this.squash;
      var op = p.o * mix(1, p.g ? p.g / Math.max(p.o, .01) : 0, hide);
      op *= 1 - loose * 0.7;
      if (pc > 0) {
        // into Ember's twelve lights: a spiral whose centre moves to the ring of lights
        var lk = Math.round(((((ang + Math.PI / 2) % TAU) + TAU) % TAU) / TAU * 12) % 12;
        var Lp = P.pts[lk], jr = P.r * 1.1 * Math.sqrt(p.u);
        var jx = Lp[0] + Math.cos(p.ph * 3.1) * jr, jy = Lp[1] + Math.sin(p.ph * 3.1) * jr;
        var cx = mix(L.x, P.centre[0], pc), cy = mix(L.y, P.centre[1], pc);
        var th = Math.atan2(y - L.y, x - L.x), rr = Math.hypot(x - L.x, y - L.y);
        var psi = Math.atan2(jy - P.centre[1], jx - P.centre[0]); psi += TAU * Math.round((th - psi) / TAU);
        var phi = mix(th, psi, pc), rho = mix(rr, Math.hypot(jx - P.centre[0], jy - P.centre[1]), pc);
        x = cx + Math.cos(phi) * rho; y = cy + Math.sin(phi) * rho;
        op *= mix(1, 0.75, pc) * (P.fade == null ? 1 : P.fade);
      }
      op *= this.alpha;
      if (op < 0.01) continue;
      var tw = 0.82 + 0.18 * Math.sin(t * 1.6 * p.f + p.ph);
      var c = cols[p.slot];
      ctx.fillStyle = 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (op * tw).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x, y, p.r * px * size * (pc > 0 ? mix(1, 0.8, pc) : 1), 0, TAU); ctx.fill();
    }
    this.dirty = false;
  };
  Swarm.prototype.draw = function () { this.step(0); };
  Swarm.prototype.start = function () {
    if (this.run) return;
    if (reduce) { this.draw(); return; }
    this.run = true; this.last = performance.now();
    var self = this;
    (function loop(now) {
      if (!self.run) return;
      var dt = Math.min(0.05, (now - self.last) / 1000); self.last = now;
      self.step(dt);
      requestAnimationFrame(loop);
    })(this.last);
  };
  Swarm.prototype.stop = function () { this.run = false; };
  /* animate only while on screen */
  Swarm.prototype.watch = function (el) {
    var self = this;
    if (!('IntersectionObserver' in window)) { this.start(); return this; }
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) self.start(); else self.stop(); });
    }, { rootMargin: '15% 0px' }).observe(el || this.c);
    return this;
  };

  window.EmberSwarm = Swarm;
})();
