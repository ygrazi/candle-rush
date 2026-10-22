/* Candle Rush v0.4
   Created by Yitzhak Grazi.
   A bubble shooter starring the mishpacha.
   Plain canvas, no libraries. Logical board is 400 x 680 and scales to any screen. */
(() => {
  'use strict';

  // ---------- Board geometry (logical pixels) ----------
  const W = 400, H = 680;
  const R = 20, D = 40;
  const ROW_H = D * Math.sqrt(3) / 2;
  const COLS = 9;
  const FIELD_L = 20, FIELD_R = FIELD_L + COLS * D;
  const FIELD_TOP = 66;
  const DEADLINE = 560;
  const LX = 200, LY = 626;
  const NEXT_X = 52, NEXT_Y = 634;
  const CLOCK_X = 344, CLOCK_Y = 634;
  const MAX_ROWS = 17;
  const SPEED = 950;
  const HIT = D * 0.86;
  const A_MIN = 9 * Math.PI / 180, A_MAX = Math.PI - A_MIN;
  const CLOCK_MAX = 18; // minutes: candles are lit 18 minutes before sunset
  const TAU = Math.PI * 2;
  const SPR_EXT = 1.36; // sprite half-size, in radii (hats and beards stick out)
  const WALL_H = 16 + MAX_ROWS * ROW_H;
  const FONT = "Fredoka, 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";

  // ---------- Cast ----------
  const CAST = [
    { name: 'Zaidy',     color: '#3f7ff0' },
    { name: 'Shmuli',    color: '#ff8b1f' },
    { name: 'Reb Yanky', color: '#9b5cf2' },
    { name: 'Moishy',    color: '#ffcf2e' },
    { name: 'Chazzan',   color: '#f2445c' },
    { name: 'Dod Ezra',  color: '#17c487' },
  ];
  const HAMSA = 6, BRICK = 7, HAMAN = 8;
  const EMPTY = -1;
  const isColor = t => t >= 0 && t < 6;

  const STOPS = ['Toledo', 'The Shtetl', 'Fez', 'Odessa', 'Aleppo', 'Salonika',
    'Ellis Island', 'Lower East Side', 'Ocean Parkway', 'Yerushalayim'];
  const stopName = n => STOPS[Math.min(n, STOPS.length) - 1];

  const LINES = {
    small: ['Nu!', 'Yalla!', 'Sababa!', 'Shkoyach!'],
    mid: ['Mazal Tov!', 'Kol HaKavod!', 'Gevaldig!', "Tov Me'od!"],
    big: ['Kapara!!', 'Mamash Gevaldig!', 'Ashrecha!!'],
    miss: ['Oy.', 'Nu?', 'Nebach.'],
  };
  const pick = a => a[(Math.random() * a.length) | 0];

  // ---------- Small helpers ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('candlerush.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('candlerush.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  };
  const vibrate = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* not supported */ } };
  const fmt = n => Math.round(n).toLocaleString('en-US');
  function mulberry32(a) {
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { const x = hexRgb(a), y = hexRgb(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; }
  function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); }
  function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  // ---------- Sound (synthesized, no files) ----------
  const Sound = (() => {
    let ac = null, master = null, noiseBuf = null;
    let muted = store.get('muted', false);
    // Freygish (Ahava Rabbah) scale, E based: the klezmer sound
    const FREY = [329.63, 349.23, 415.30, 440.00, 493.88, 523.25, 587.33, 659.25, 698.46, 830.61, 880.00, 987.77, 1046.5];
    function init() {
      try {
        if (!ac) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          ac = new AC();
          master = ac.createGain();
          master.gain.value = muted ? 0 : 0.55;
          master.connect(ac.destination);
          noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
          const d = noiseBuf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        if (ac.state === 'suspended') ac.resume();
      } catch (e) { /* audio unavailable */ }
    }
    function tone(f, dur, o = {}) {
      if (!ac || muted) return;
      const { type = 'sine', vol = 0.25, at = 0, to = null, attack = 0.006 } = o;
      const t0 = ac.currentTime + at;
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = type; osc.frequency.setValueAtTime(f, t0);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + dur + 0.03);
    }
    function noise(dur, o = {}) {
      if (!ac || muted) return;
      const { vol = 0.2, at = 0, freq = 1200, q = 1, type = 'bandpass' } = o;
      const t0 = ac.currentTime + at;
      const s = ac.createBufferSource(); s.buffer = noiseBuf;
      const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ac.createGain();
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f); f.connect(g); g.connect(master);
      s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.03);
    }
    return {
      init,
      get ctx() { return ac; },
      get bus() { return master; },
      get muted() { return muted; },
      toggle() { muted = !muted; store.set('muted', muted); if (master) master.gain.value = muted ? 0 : 0.55; return muted; },
      shoot() { noise(0.1, { vol: 0.1, freq: 2600, q: 0.8 }); tone(300, 0.12, { type: 'triangle', vol: 0.12, to: 640 }); },
      land() { tone(150, 0.12, { vol: 0.2, to: 90 }); },
      bounce() { tone(540, 0.04, { type: 'square', vol: 0.03 }); },
      pop(i) { const f = FREY[Math.min(i, FREY.length - 1)]; tone(f, 0.16, { type: 'triangle', vol: 0.2, at: i * 0.045 }); tone(f * 2, 0.08, { vol: 0.05, at: i * 0.045 }); },
      drop(n) { for (let i = 0; i < Math.min(n, 6); i++) tone(900 - i * 60, 0.35, { vol: 0.06, at: 0.12 + i * 0.05, to: 220 }); },
      grogger() { for (let i = 0; i < 14; i++) noise(0.03, { vol: 0.25, at: 0.15 + i * 0.045, freq: 1800 + (i % 2) * 900, q: 4 }); },
      ceiling() { tone(110, 0.5, { vol: 0.35, to: 45 }); noise(0.35, { vol: 0.25, freq: 300, q: 0.5, type: 'lowpass' }); },
      miss() { tone(260, 0.18, { vol: 0.06, to: 200 }); },
      swap() { tone(880, 0.05, { type: 'triangle', vol: 0.08 }); tone(1100, 0.05, { type: 'triangle', vol: 0.08, at: 0.05 }); },
      clear() { [0, 2, 4, 5, 7, 9, 12].forEach((n, i) => tone(FREY[n], 0.3, { type: 'triangle', vol: 0.18, at: i * 0.09 })); },
      over() { tone(392, 0.35, { type: 'triangle', vol: 0.2, to: 370 }); tone(330, 0.7, { type: 'triangle', vol: 0.2, at: 0.35, to: 247 }); },
    };
  })();

  // ---------- Background music ----------
  // An original tune in D freygish (Ahava Rabbah), played live: clarinet-style lead with a little
  // "krekhts" sob on long notes, oom-pah bass and accordion stabs, doumbek on the maqsum rhythm.
  // No audio files. Tempo climbs as candle lighting gets close.
  const Music = (() => {
    const VOL = 0.5;
    const TEMPO = { calm: 92, play: 108, hurry: 128, panic: 148 };
    const NOTE = { D4: 62, Eb4: 63, Fs4: 66, G4: 67, A4: 69, Bb4: 70, C5: 72, D5: 74, Eb5: 75, Fs5: 78, G5: 79, A5: 81 };
    const CHORD = {
      D: { bass: [50, 57], triad: [62, 66, 69] },
      Cm: { bass: [48, 55], triad: [60, 63, 67] },
      Gm: { bass: [43, 50], triad: [62, 67, 70] },
      Eb: { bass: [51, 58], triad: [63, 67, 70] },
    };
    // Melody as [note, length in eighth notes]. Every bar adds up to 8.
    const A1 = [['A4', 2], ['D5', 1], ['Eb5', 1], ['Fs5', 2], ['Eb5', 1], ['D5', 1],
      ['Eb5', 1], ['D5', 1], ['C5', 1], ['Bb4', 1], ['A4', 4],
      ['G4', 1], ['A4', 1], ['Bb4', 1], ['C5', 1], ['Eb5', 2], ['D5', 1], ['C5', 1]];
    const A_END1 = [['D5', 1], ['C5', 1], ['Bb4', 1], ['A4', 1], ['Fs4', 1], ['Eb4', 1], ['D4', 2]];
    const A_END2 = [['D5', 1], ['C5', 1], ['Bb4', 1], ['A4', 1], ['Bb4', 1], ['C5', 1], ['D5', 2]];
    const B1 = [['D5', 2], ['G5', 2], ['Fs5', 1], ['G5', 1], ['A5', 2],
      ['G5', 1], ['Fs5', 1], ['Eb5', 1], ['D5', 1], ['Fs5', 2], ['D5', 2],
      ['Eb5', 1], ['D5', 1], ['C5', 1], ['D5', 1], ['Eb5', 2], ['Fs5', 1], ['Eb5', 1]];
    const B_END1 = [['D5', 3], ['A4', 1], ['D5', 4]];
    const B_END2 = [['D5', 2], ['A4', 1], ['Fs4', 1], ['D4', 4]];
    const MELODY = [...A1, ...A_END1, ...A1, ...A_END2, ...B1, ...B_END1, ...B1, ...B_END2];
    const BARS = ['D', 'D', 'Cm', 'D', 'D', 'D', 'Cm', 'D', 'Gm', 'D', 'Eb', 'D', 'Gm', 'D', 'Eb', 'D'];
    const STEPS = BARS.length * 8;
    const mel = new Array(STEPS).fill(null);
    { let s = 0; for (const [n, len] of MELODY) { mel[s] = { m: NOTE[n], len }; s += len; } }
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

    let bus = null, noiseBuf = null, timer = 0, playing = false;
    let step = 0, nextTime = 0, tempo = TEMPO.calm, target = TEMPO.calm, drums = false;
    let enabled = store.get('music', true);

    function setup() {
      const ac = Sound.ctx;
      if (bus || !ac) return !!bus;
      bus = ac.createGain(); bus.gain.value = 0; bus.connect(Sound.bus);
      noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.2), ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return true;
    }
    function env(g, t, peak, attack, hold, release) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + attack);
      g.gain.setValueAtTime(peak, t + attack + hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
      return t + attack + hold + release;
    }
    function clarinet(ac, f, t, dur, sob) {
      const o = ac.createOscillator(); o.type = 'square';
      if (sob) { o.frequency.setValueAtTime(f * 1.06, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07); }
      else o.frequency.setValueAtTime(f, t);
      const lfo = ac.createOscillator(); lfo.frequency.value = 5.5;
      const depth = ac.createGain(); depth.gain.value = f * 0.007;
      lfo.connect(depth); depth.connect(o.frequency);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700; lp.Q.value = 0.8;
      const g = ac.createGain();
      const end = env(g, t, 0.12, 0.025, Math.max(0.02, dur - 0.1), 0.07);
      o.connect(lp); lp.connect(g); g.connect(bus);
      o.start(t); lfo.start(t); o.stop(end + 0.02); lfo.stop(end + 0.02);
    }
    function bass(ac, f, t, dur) {
      const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = ac.createGain();
      const end = env(g, t, 0.28, 0.01, dur * 0.4, dur * 0.5);
      o.connect(g); g.connect(bus); o.start(t); o.stop(end + 0.02);
    }
    function stab(ac, notes, t) {
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300;
      const g = ac.createGain();
      const end = env(g, t, 0.05, 0.008, 0.05, 0.08);
      lp.connect(g); g.connect(bus);
      for (const m of notes) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.connect(lp); o.start(t); o.stop(end + 0.02); }
    }
    function dum(ac, t) {
      const o = ac.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.16);
      const g = ac.createGain();
      const end = env(g, t, 0.4, 0.004, 0.02, 0.16);
      o.connect(g); g.connect(bus); o.start(t); o.stop(end + 0.02);
    }
    function tek(ac, t, vol = 0.1) {
      const s = ac.createBufferSource(); s.buffer = noiseBuf;
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
      const g = ac.createGain();
      const end = env(g, t, vol, 0.002, 0.005, 0.04);
      s.connect(hp); hp.connect(g); g.connect(bus); s.start(t); s.stop(end + 0.02);
    }
    function playStep(ac, i, t, eighth) {
      const n = mel[i];
      if (n) clarinet(ac, mtof(n.m), t, n.len * eighth * 0.95, n.len >= 2);
      const pos = i % 8, ch = CHORD[BARS[(i / 8) | 0]];
      if (pos === 0) bass(ac, mtof(ch.bass[0]), t, eighth * 2);
      if (pos === 4) bass(ac, mtof(ch.bass[1]), t, eighth * 2);
      if (pos === 2 || pos === 6) stab(ac, ch.triad, t);
      if (drums) {
        if (pos === 0 || pos === 4) dum(ac, t);          // maqsum: DUM tek . tek DUM . tek .
        if (pos === 1 || pos === 3 || pos === 6) tek(ac, t);
        if (tempo > 120 && (pos === 5 || pos === 7)) tek(ac, t, 0.06);
      }
    }
    function tick() {
      const ac = Sound.ctx;
      if (!ac || !playing) return;
      if (nextTime < ac.currentTime) nextTime = ac.currentTime + 0.03; // skip ahead after a stall instead of bursting
      while (nextTime < ac.currentTime + 0.15) {
        tempo += (target - tempo) * 0.08;
        const eighth = 30 / tempo;
        playStep(ac, step, nextTime, eighth);
        nextTime += eighth;
        step = (step + 1) % STEPS;
      }
    }
    function start() {
      if (!setup()) return;
      const ac = Sound.ctx;
      playing = true; step = 0; tempo = target;
      nextTime = ac.currentTime + 0.08;
      bus.gain.cancelScheduledValues(ac.currentTime);
      bus.gain.setTargetAtTime(VOL, ac.currentTime, 0.05);
      clearInterval(timer); timer = setInterval(tick, 25);
      tick();
    }
    function stop() {
      playing = false; clearInterval(timer);
      const ac = Sound.ctx;
      if (bus && ac) { bus.gain.cancelScheduledValues(ac.currentTime); bus.gain.setTargetAtTime(0, ac.currentTime, 0.04); }
    }
    return {
      get enabled() { return enabled; },
      get playing() { return playing; },
      toggle() { enabled = !enabled; store.set('music', enabled); return enabled; },
      // Called every frame. want: should this game state have music. mood: calm | play | hurry | panic
      update(want, mood) {
        target = TEMPO[mood] || TEMPO.play;
        drums = mood !== 'calm';
        const ac = Sound.ctx;
        const go = want && enabled && !Sound.muted && !!ac && ac.state === 'running';
        if (go && !playing) start();
        else if (!go && playing) stop();
      },
    };
  })();

  // ---------- Character art (all drawn in code, radius r, centered at 0,0) ----------
  function body(c, r, base) {
    const g = c.createRadialGradient(-0.35 * r, -0.45 * r, 0.05 * r, 0, 0, 1.05 * r);
    g.addColorStop(0, mix(base, '#ffffff', 0.5));
    g.addColorStop(0.5, base);
    g.addColorStop(1, mix(base, '#000000', 0.32));
    c.fillStyle = g; circ(c, 0, 0, r); c.fill();
    c.lineWidth = 0.07 * r; c.strokeStyle = mix(base, '#000000', 0.55); c.stroke();
  }
  function closedEye(c, r, x, y) {
    c.strokeStyle = '#1a1a2a'; c.lineWidth = 0.075 * r; c.lineCap = 'round';
    c.beginPath(); c.arc(x, y + 0.07 * r, 0.13 * r, 1.15 * Math.PI, 1.85 * Math.PI); c.stroke();
  }
  function eyes(c, r, o = {}) {
    const y = (o.y ?? -0.06) * r, dx = (o.dx ?? 0.3) * r, w = (o.w ?? 0.19) * r, h = (o.h ?? 0.23) * r;
    const px = (o.px ?? 0) * r, py = (o.py ?? 0.04) * r, pr = (o.pr ?? 0.1) * r;
    for (const s of [-1, 1]) {
      if (o.wink === s) { closedEye(c, r, s * dx, y); continue; }
      c.fillStyle = '#fff'; ell(c, s * dx, y, w, h); c.fill();
      c.lineWidth = 0.035 * r; c.strokeStyle = 'rgba(20,20,40,.6)'; c.stroke();
      c.fillStyle = '#18182a'; circ(c, s * dx + px, y + py, pr); c.fill();
      c.fillStyle = '#fff'; circ(c, s * dx + px - 0.04 * r, y + py - 0.04 * r, pr * 0.36); c.fill();
    }
  }
  function brows(c, r, o = {}) {
    const { y = -0.33, dx = 0.3, w = 0.15, tilt = 0, color = '#2a1a10', thick = 0.07 } = o;
    c.strokeStyle = color; c.lineWidth = thick * r; c.lineCap = 'round';
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(s * (dx - w) * r, (y + tilt / 2) * r);
      c.lineTo(s * (dx + w) * r, (y - tilt / 2) * r);
      c.stroke();
    }
  }
  function nose(c, r, base, s = 1) {
    c.fillStyle = mix(base, '#000000', 0.2); ell(c, 0, 0.1 * r, 0.1 * r * s, 0.085 * r * s); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; circ(c, -0.03 * r * s, 0.07 * r, 0.03 * r * s); c.fill();
  }
  function smile(c, r, y = 0.3, w = 0.2, color = '#3a1020') {
    c.strokeStyle = color; c.lineWidth = 0.07 * r; c.lineCap = 'round';
    c.beginPath(); c.arc(0, (y - w * 0.7) * r, w * r, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
  }
  function cheeks(c, r, a = 0.35) {
    c.fillStyle = `rgba(255,110,130,${a})`;
    for (const s of [-1, 1]) { ell(c, s * 0.52 * r, 0.2 * r, 0.13 * r, 0.08 * r); c.fill(); }
  }
  function beard(c, r, color, edge, o = {}) {
    const { w = 0.8, bottom = 1.06, topY = 0.02, dip = 0.34 } = o;
    c.beginPath();
    c.moveTo(-w * r, topY * r);
    c.bezierCurveTo(-w * r, 0.75 * r, -0.45 * r, bottom * r, 0, bottom * r);
    c.bezierCurveTo(0.45 * r, bottom * r, w * r, 0.75 * r, w * r, topY * r);
    c.bezierCurveTo(0.45 * r, dip * r, -0.45 * r, dip * r, -w * r, topY * r);
    c.closePath();
    c.fillStyle = color; c.fill();
    c.lineWidth = 0.04 * r; c.strokeStyle = edge; c.stroke();
    c.strokeStyle = edge; c.lineWidth = 0.03 * r; c.lineCap = 'round';
    for (const [x, y] of [[-0.4, 0.55], [0.35, 0.6], [-0.1, 0.8], [0.15, 0.72]]) {
      c.beginPath(); c.arc(x * r, y * r, 0.08 * r, 0.1 * Math.PI, 0.9 * Math.PI); c.stroke();
    }
  }
  function mustache(c, r, color, o = {}) {
    const { y = 0.22, w = 0.24, h = 0.09 } = o;
    c.fillStyle = color;
    for (const s of [-1, 1]) { ell(c, s * w * 0.55 * r, y * r, w * 0.6 * r, h * r, s * -0.25); c.fill(); }
  }
  function handlebar(c, r, color = '#17171c') {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0, 0.17 * r);
    c.bezierCurveTo(0.15 * r, 0.1 * r, 0.35 * r, 0.12 * r, 0.42 * r, 0.24 * r);
    c.bezierCurveTo(0.5 * r, 0.3 * r, 0.58 * r, 0.22 * r, 0.55 * r, 0.14 * r);
    c.bezierCurveTo(0.6 * r, 0.3 * r, 0.4 * r, 0.38 * r, 0.28 * r, 0.3 * r);
    c.bezierCurveTo(0.18 * r, 0.26 * r, 0.08 * r, 0.28 * r, 0, 0.3 * r);
    c.bezierCurveTo(-0.08 * r, 0.28 * r, -0.18 * r, 0.26 * r, -0.28 * r, 0.3 * r);
    c.bezierCurveTo(-0.4 * r, 0.38 * r, -0.6 * r, 0.3 * r, -0.55 * r, 0.14 * r);
    c.bezierCurveTo(-0.58 * r, 0.22 * r, -0.5 * r, 0.3 * r, -0.42 * r, 0.24 * r);
    c.bezierCurveTo(-0.35 * r, 0.12 * r, -0.15 * r, 0.1 * r, 0, 0.17 * r);
    c.closePath(); c.fill();
  }
  function payot(c, r, color, o = {}) {
    const { x = 0.74, y0 = -0.2, len = 0.6, loops = 3, w = 0.06, lw = 0.07 } = o;
    c.strokeStyle = color; c.lineWidth = lw * r; c.lineCap = 'round'; c.lineJoin = 'round';
    for (const s of [-1, 1]) {
      c.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const xx = s * x * r + Math.sin(t * loops * TAU) * w * r;
        const yy = (y0 + len * t) * r;
        if (i) c.lineTo(xx, yy); else c.moveTo(xx, yy);
      }
      c.stroke();
    }
  }
  function glasses(c, r, o = {}) {
    const { y = -0.06, dx = 0.3, rr = 0.21, color = '#15151c', lw = 0.055 } = o;
    c.strokeStyle = color; c.lineWidth = lw * r;
    for (const s of [-1, 1]) { circ(c, s * dx * r, y * r, rr * r); c.stroke(); }
    c.beginPath(); c.moveTo(-(dx - rr) * r, y * r); c.quadraticCurveTo(0, (y - 0.07) * r, (dx - rr) * r, y * r); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 0.03 * r;
    for (const s of [-1, 1]) { c.beginPath(); c.arc(s * dx * r, y * r, rr * 0.7 * r, 1.1 * Math.PI, 1.4 * Math.PI); c.stroke(); }
  }
  function fedora(c, r, crownH = 0.5) {
    const by = -0.5 * r, cw = 0.5 * r, top = by - crownH * r;
    c.fillStyle = '#1a1a20';
    c.beginPath();
    c.moveTo(-cw, by);
    c.lineTo(-cw * 0.92, top + 0.12 * r);
    c.quadraticCurveTo(-cw * 0.9, top, -cw * 0.5, top + 0.02 * r);
    c.quadraticCurveTo(0, top + 0.13 * r, cw * 0.5, top + 0.02 * r);
    c.quadraticCurveTo(cw * 0.9, top, cw * 0.92, top + 0.12 * r);
    c.lineTo(cw, by);
    c.closePath(); c.fill();
    c.fillStyle = '#3c3c48'; c.fillRect(-cw * 0.97, by - 0.15 * r, cw * 1.94, 0.1 * r);
    c.fillStyle = '#111116'; ell(c, 0, by, 0.95 * r, 0.15 * r); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = 0.04 * r;
    c.beginPath(); c.ellipse(0, by, 0.88 * r, 0.1 * r, 0, 1.05 * Math.PI, 1.95 * Math.PI); c.stroke();
  }
  function shtreimel(c, r) {
    // fur ring
    const g = c.createLinearGradient(0, -0.95 * r, 0, -0.3 * r);
    g.addColorStop(0, '#9a6633'); g.addColorStop(1, '#4b2c12');
    c.fillStyle = g; ell(c, 0, -0.6 * r, 0.98 * r, 0.32 * r); c.fill();
    // fluffy edge
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * TAU;
      const x = Math.cos(a) * 0.9 * r, y = -0.6 * r + Math.sin(a) * 0.27 * r;
      c.fillStyle = i % 2 ? '#7a4a20' : '#a8743c';
      circ(c, x, y, 0.1 * r); c.fill();
    }
    // velvet top
    c.fillStyle = '#141418';
    c.beginPath(); c.ellipse(0, -0.68 * r, 0.52 * r, 0.32 * r, 0, Math.PI, TAU); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.12)'; ell(c, -0.18 * r, -0.86 * r, 0.16 * r, 0.06 * r); c.fill();
  }
  function kippah(c, r) {
    c.fillStyle = '#1f3f9a';
    c.beginPath(); c.ellipse(0, -0.78 * r, 0.44 * r, 0.27 * r, 0, Math.PI, TAU); c.closePath(); c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = 0.05 * r; c.setLineDash([0.07 * r, 0.05 * r]);
    c.beginPath(); c.ellipse(0, -0.8 * r, 0.34 * r, 0.16 * r, 0, 1.08 * Math.PI, 1.92 * Math.PI); c.stroke();
    c.setLineDash([]);
    c.strokeStyle = '#ffcf2e'; c.lineWidth = 0.04 * r;
    c.beginPath(); c.moveTo(-0.44 * r, -0.78 * r); c.lineTo(0.44 * r, -0.78 * r); c.stroke();
  }
  function chazzanHat(c, r) {
    const g = c.createLinearGradient(-0.5 * r, 0, 0.5 * r, 0);
    g.addColorStop(0, '#d6d8e4'); g.addColorStop(0.45, '#ffffff'); g.addColorStop(1, '#c4c6d4');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-0.52 * r, -0.5 * r);
    c.lineTo(-0.44 * r, -1.08 * r);
    c.quadraticCurveTo(0, -1.2 * r, 0.44 * r, -1.08 * r);
    c.lineTo(0.52 * r, -0.5 * r);
    c.quadraticCurveTo(0, -0.42 * r, -0.52 * r, -0.5 * r);
    c.closePath(); c.fill();
    c.lineWidth = 0.04 * r; c.strokeStyle = '#9a9bb0'; c.stroke();
    c.strokeStyle = '#7f86b8'; c.lineWidth = 0.045 * r; c.lineJoin = 'round';
    c.beginPath();
    for (let i = 0; i <= 8; i++) { const x = (-0.47 + i * 0.1175) * r, y = (i % 2 ? -0.64 : -0.73) * r; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.stroke();
  }
  function musicNote(c, r, x, y) {
    c.save(); c.translate(x * r, y * r);
    c.fillStyle = '#ffffff'; c.strokeStyle = '#ffffff'; c.lineWidth = 0.05 * r;
    ell(c, 0, 0, 0.09 * r, 0.065 * r, -0.4); c.fill();
    c.beginPath(); c.moveTo(0.08 * r, -0.02 * r); c.lineTo(0.08 * r, -0.3 * r); c.quadraticCurveTo(0.18 * r, -0.24 * r, 0.2 * r, -0.12 * r); c.stroke();
    c.restore();
  }
  function fez(c, r) {
    const g = c.createLinearGradient(-0.45 * r, 0, 0.45 * r, 0);
    g.addColorStop(0, '#9c0f22'); g.addColorStop(0.45, '#e0263c'); g.addColorStop(1, '#8a0c1d');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-0.48 * r, -0.48 * r);
    c.lineTo(-0.34 * r, -1.06 * r);
    c.quadraticCurveTo(0, -1.12 * r, 0.34 * r, -1.06 * r);
    c.lineTo(0.48 * r, -0.48 * r);
    c.quadraticCurveTo(0, -0.4 * r, -0.48 * r, -0.48 * r);
    c.closePath(); c.fill();
    c.lineWidth = 0.04 * r; c.strokeStyle = '#5e0812'; c.stroke();
    c.fillStyle = '#f0405a'; ell(c, 0, -1.06 * r, 0.34 * r, 0.06 * r); c.fill();
    c.strokeStyle = '#121214'; c.lineWidth = 0.06 * r; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -1.08 * r); c.quadraticCurveTo(0.42 * r, -1.1 * r, 0.5 * r, -0.78 * r); c.stroke();
    c.lineWidth = 0.035 * r;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(0.5 * r, -0.8 * r); c.lineTo((0.5 + i * 0.03) * r, -0.6 * r); c.stroke(); }
  }
  function tricorn(c, r) {
    c.fillStyle = '#141418';
    c.beginPath();
    c.moveTo(-1.05 * r, -0.46 * r);
    c.quadraticCurveTo(-0.75 * r, -1.05 * r, 0, -1.02 * r);
    c.quadraticCurveTo(0.75 * r, -1.05 * r, 1.05 * r, -0.46 * r);
    c.quadraticCurveTo(0.5 * r, -0.66 * r, 0, -0.48 * r);
    c.quadraticCurveTo(-0.5 * r, -0.66 * r, -1.05 * r, -0.46 * r);
    c.closePath(); c.fill();
    c.strokeStyle = '#c9a24a'; c.lineWidth = 0.055 * r;
    c.beginPath(); c.moveTo(-1.0 * r, -0.48 * r); c.quadraticCurveTo(-0.5 * r, -0.66 * r, 0, -0.5 * r); c.quadraticCurveTo(0.5 * r, -0.66 * r, 1.0 * r, -0.48 * r); c.stroke();
  }

  function drawZaidy(c, r) {
    const base = CAST[0].color;
    body(c, r, base);
    c.fillStyle = '#f4f4f6';
    for (const s of [-1, 1]) { ell(c, s * 0.8 * r, -0.2 * r, 0.15 * r, 0.2 * r); c.fill(); }
    beard(c, r, '#f6f6f8', '#c3c7d4', { w: 0.8, bottom: 1.06, topY: 0.02, dip: 0.36 });
    nose(c, r, base);
    eyes(c, r, { y: -0.1, pr: 0.09 });
    glasses(c, r, { y: -0.1, rr: 0.2, color: '#6a5232', lw: 0.045 });
    brows(c, r, { y: -0.36, color: '#f4f4f6', thick: 0.11, tilt: -0.06 });
    smile(c, r, 0.48, 0.13, '#8a3a4a');
    mustache(c, r, '#ffffff', { y: 0.24, w: 0.26, h: 0.1 });
    fedora(c, r, 0.48);
  }
  function drawShmuli(c, r) {
    const base = CAST[1].color;
    body(c, r, base);
    payot(c, r, '#2a1c12', { x: 0.76, y0: -0.25, len: 0.5, loops: 2.5, w: 0.05, lw: 0.06 });
    nose(c, r, base);
    eyes(c, r, { y: -0.06, px: 0.03 });
    glasses(c, r, { y: -0.06, rr: 0.21, color: '#121218', lw: 0.065 });
    brows(c, r, { y: -0.37, color: '#2a1c12', tilt: -0.04 });
    smile(c, r, 0.4, 0.2);
    fedora(c, r, 0.52);
  }
  function drawYanky(c, r) {
    const base = CAST[2].color;
    body(c, r, base);
    beard(c, r, '#3b2414', '#22140a', { w: 0.78, bottom: 1.05, topY: 0.04, dip: 0.4 });
    payot(c, r, '#3b2414', { x: 0.82, y0: -0.3, len: 0.85, loops: 3.5, w: 0.07, lw: 0.075 });
    nose(c, r, base);
    eyes(c, r, { y: -0.08 });
    brows(c, r, { y: -0.34, color: '#3b2414', tilt: -0.05 });
    smile(c, r, 0.46, 0.13, '#ffb3c0');
    mustache(c, r, '#3b2414', { y: 0.23 });
    shtreimel(c, r);
  }
  function drawMoishy(c, r) {
    const base = CAST[3].color;
    body(c, r, base);
    c.save(); circ(c, 0, 0, r); c.clip();
    c.fillStyle = '#8a4b1c'; ell(c, 0, -0.98 * r, 0.98 * r, 0.5 * r); c.fill();
    c.restore();
    payot(c, r, '#b5602a', { x: 0.76, y0: -0.42, len: 0.72, loops: 3, w: 0.065, lw: 0.085 });
    cheeks(c, r, 0.45);
    c.fillStyle = 'rgba(150,80,30,.55)';
    for (const [x, y] of [[-0.55, 0.12], [-0.45, 0.2], [-0.6, 0.24], [0.55, 0.12], [0.45, 0.2], [0.6, 0.24]]) { circ(c, x * r, y * r, 0.025 * r); c.fill(); }
    eyes(c, r, { y: -0.1, w: 0.2, h: 0.25, pr: 0.115 });
    brows(c, r, { y: -0.42, color: '#5a2e10', tilt: -0.08 });
    c.fillStyle = '#5a1222';
    c.beginPath();
    c.moveTo(-0.32 * r, 0.2 * r);
    c.quadraticCurveTo(0, 0.28 * r, 0.32 * r, 0.2 * r);
    c.quadraticCurveTo(0.28 * r, 0.66 * r, 0, 0.66 * r);
    c.quadraticCurveTo(-0.28 * r, 0.66 * r, -0.32 * r, 0.2 * r);
    c.closePath(); c.fill();
    c.save(); c.clip();
    c.fillStyle = '#ffffff'; c.fillRect(-0.32 * r, 0.14 * r, 0.64 * r, 0.14 * r);
    c.fillStyle = '#ff6b8a'; ell(c, 0, 0.62 * r, 0.18 * r, 0.12 * r); c.fill();
    c.restore();
    kippah(c, r);
  }
  function drawChazzan(c, r) {
    const base = CAST[4].color;
    body(c, r, base);
    beard(c, r, '#1c1c22', '#0a0a0e', { w: 0.7, bottom: 0.98, topY: 0.14, dip: 0.5 });
    nose(c, r, base);
    closedEye(c, r, -0.3 * r, -0.08 * r);
    closedEye(c, r, 0.3 * r, -0.08 * r);
    brows(c, r, { y: -0.38, color: '#1c1c22', tilt: -0.14 });
    c.fillStyle = '#4a0f1c'; ell(c, 0, 0.42 * r, 0.15 * r, 0.19 * r); c.fill();
    c.fillStyle = '#ff7a93'; ell(c, 0, 0.53 * r, 0.09 * r, 0.06 * r); c.fill();
    mustache(c, r, '#1c1c22', { y: 0.21, w: 0.22, h: 0.08 });
    chazzanHat(c, r);
    musicNote(c, r, 0.68, -0.3);
  }
  function drawEzra(c, r) {
    const base = CAST[5].color;
    body(c, r, base);
    c.fillStyle = '#d9d9de';
    for (const s of [-1, 1]) { ell(c, s * 0.82 * r, -0.16 * r, 0.12 * r, 0.18 * r); c.fill(); }
    nose(c, r, base, 1.25);
    eyes(c, r, { y: -0.1, wink: 1 });
    brows(c, r, { y: -0.38, color: '#17171c', thick: 0.11, w: 0.17, tilt: -0.05 });
    smile(c, r, 0.5, 0.2);
    handlebar(c, r);
    fez(c, r);
  }
  function drawHamsa(c, r) {
    const g = c.createRadialGradient(-0.3 * r, -0.4 * r, 0.05 * r, 0, 0, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#f1e6c8');
    c.fillStyle = g; circ(c, 0, 0, r); c.fill();
    for (let i = 0; i < 6; i++) {
      c.strokeStyle = CAST[i].color; c.lineWidth = 0.17 * r;
      c.beginPath(); c.arc(0, 0, 0.9 * r, i / 6 * TAU - Math.PI / 2, (i + 1) / 6 * TAU - Math.PI / 2); c.stroke();
    }
    c.lineWidth = 0.05 * r; c.strokeStyle = '#8a7a50'; circ(c, 0, 0, r); c.stroke();
    const s = 0.62 * r;
    const shapes = (dx, dy, col) => {
      c.fillStyle = col;
      roundRect(c, -0.5 * s + dx, -0.2 * s + dy, 1.0 * s, 0.95 * s, 0.35 * s); c.fill();
      for (const [x, top] of [[-0.27, -0.95], [0, -1.05], [0.27, -0.95]]) { roundRect(c, (x - 0.1) * s + dx, top * s + dy, 0.2 * s, (-0.05 - top) * s, 0.1 * s); c.fill(); }
      for (const sd of [-1, 1]) {
        c.save(); c.translate(sd * 0.52 * s + dx, -0.12 * s + dy); c.rotate(sd * 0.32);
        roundRect(c, -0.1 * s, -0.5 * s, 0.2 * s, 0.75 * s, 0.1 * s); c.fill(); c.restore();
      }
    };
    shapes(0.04 * r, 0.05 * r, '#123087');
    shapes(0, 0, '#2b5ce0');
    c.fillStyle = '#ffffff'; ell(c, 0, 0.3 * s, 0.27 * s, 0.15 * s); c.fill();
    c.fillStyle = '#2b9bf0'; circ(c, 0, 0.3 * s, 0.11 * s); c.fill();
    c.fillStyle = '#0d1530'; circ(c, 0, 0.3 * s, 0.05 * s); c.fill();
  }
  function drawBrick(c, r) {
    c.save(); circ(c, 0, 0, r); c.clip();
    const g = c.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#bd7f49'); g.addColorStop(1, '#7a4720');
    c.fillStyle = g; c.fillRect(-r, -r, 2 * r, 2 * r);
    c.strokeStyle = 'rgba(58,30,10,.7)'; c.lineWidth = 0.07 * r;
    const courses = [-1, -0.5, 0, 0.5, 1];
    for (let i = 1; i < courses.length - 1; i++) { c.beginPath(); c.moveTo(-r, courses[i] * r); c.lineTo(r, courses[i] * r); c.stroke(); }
    for (let i = 0; i < courses.length - 1; i++) {
      const joints = i % 2 ? [-0.45, 0.45] : [0];
      for (const x of joints) { c.beginPath(); c.moveTo(x * r, courses[i] * r); c.lineTo(x * r, courses[i + 1] * r); c.stroke(); }
    }
    const rnd = mulberry32(11);
    c.strokeStyle = 'rgba(240,205,130,.7)'; c.lineWidth = 0.035 * r;
    for (let i = 0; i < 16; i++) {
      const x = (rnd() * 2 - 1) * r, y = (rnd() * 2 - 1) * r, a = rnd() * Math.PI;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 0.16 * r, y + Math.sin(a) * 0.16 * r); c.stroke();
    }
    const hl = c.createRadialGradient(-0.4 * r, -0.5 * r, 0, -0.4 * r, -0.5 * r, r);
    hl.addColorStop(0, 'rgba(255,255,255,.28)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = hl; c.fillRect(-r, -r, 2 * r, 2 * r);
    c.restore();
    c.lineWidth = 0.07 * r; c.strokeStyle = '#4a2810'; circ(c, 0, 0, r); c.stroke();
  }
  function drawHaman(c, r) {
    const base = '#93a07f';
    body(c, r, base);
    nose(c, r, base, 1.3);
    eyes(c, r, { y: -0.04, h: 0.16, w: 0.17, px: 0.06, py: 0.03, pr: 0.08 });
    brows(c, r, { y: -0.26, color: '#151515', thick: 0.12, w: 0.2, tilt: 0.22 });
    c.strokeStyle = '#2a1015'; c.lineWidth = 0.07 * r; c.lineCap = 'round';
    c.beginPath(); c.arc(0, 0.64 * r, 0.2 * r, 1.2 * Math.PI, 1.8 * Math.PI); c.stroke();
    c.fillStyle = '#151515';
    c.beginPath(); c.moveTo(-0.1 * r, 0.66 * r); c.lineTo(0.1 * r, 0.66 * r); c.lineTo(0, 0.96 * r); c.closePath(); c.fill();
    c.save(); c.translate(0, 0.03 * r); c.scale(0.85, 0.7); handlebar(c, r, '#151515'); c.restore();
    tricorn(c, r);
  }
  const DRAW = [drawZaidy, drawShmuli, drawYanky, drawMoishy, drawChazzan, drawEzra, drawHamsa, drawBrick, drawHaman];
  function drawPiece(c, t, r) { c.save(); DRAW[t](c, r); c.restore(); }

  // ---------- Canvas + scaling ----------
  const app = document.getElementById('app');
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let scale = 1, pxs = 1;
  let FW = W, FH = H, OX = 0, OY = 0; // full-screen logical size, and where the 400x680 board sits in it
  let sprites = [], bgCv = null, wallCv = null;

  function renderPiece(t, r, ps) {
    const half = r * SPR_EXT;
    const cv = document.createElement('canvas');
    cv.width = cv.height = Math.ceil(half * 2 * ps);
    const c = cv.getContext('2d');
    c.scale(ps, ps); c.translate(half, half);
    drawPiece(c, t, r);
    return cv;
  }
  function drawSprite(t, x, y, s = 1, a = 1, rot = 0) {
    const spr = sprites[t];
    if (!spr) return;
    const half = R * SPR_EXT * s;
    if (a !== 1) ctx.globalAlpha = Math.max(0, a);
    if (rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(spr, -half, -half, half * 2, half * 2); ctx.restore(); }
    else ctx.drawImage(spr, x - half, y - half, half * 2, half * 2);
    if (a !== 1) ctx.globalAlpha = 1;
  }

  function drawSkyline(c, rnd, width, baseY) {
    let x = -10;
    while (x < width + 10) {
      const w = 26 + rnd() * 34, h = 34 + rnd() * 46;
      const top = baseY - h;
      c.fillStyle = '#0a112b';
      c.fillRect(x, top, w, h);
      const kind = rnd();
      if (kind < 0.22) { circ(c, x + w / 2, top, w * 0.42); c.fill(); }
      else if (kind < 0.42) { for (let k = 0; k < w - 4; k += 8) c.fillRect(x + k, top - 6, 5, 6); }
      c.fillStyle = 'rgba(255,190,90,0.5)';
      const nw = Math.floor(w / 14);
      for (let k = 0; k < nw; k++) {
        if (rnd() < 0.5) {
          const wx = x + 6 + k * 14, wy = top + 10 + rnd() * Math.max(4, h - 30);
          c.beginPath(); c.moveTo(wx, wy + 9); c.lineTo(wx, wy + 3); c.arc(wx + 2.5, wy + 3, 2.5, Math.PI, 0); c.lineTo(wx + 5, wy + 9); c.closePath(); c.fill();
        }
      }
      x += w - 2;
    }
  }
  function buildBackground() {
    const cv = document.createElement('canvas');
    cv.width = Math.round(FW * pxs); cv.height = Math.round(FH * pxs);
    const c = cv.getContext('2d'); c.scale(cv.width / FW, cv.height / FH);
    const ground = OY + H;
    const g = c.createLinearGradient(0, 0, 0, ground);
    g.addColorStop(0, '#0d1531'); g.addColorStop(0.6, '#16234f'); g.addColorStop(1, '#1d2d63');
    c.fillStyle = g; c.fillRect(0, 0, FW, FH);
    const rnd = mulberry32(7);
    const stars = Math.round(90 * (FW * FH) / (W * H));
    for (let i = 0; i < stars; i++) {
      const x = rnd() * FW, y = rnd() * (ground - 40), s = rnd() * 1.3 + 0.3;
      c.fillStyle = `rgba(255,244,214,${0.15 + rnd() * 0.5})`; circ(c, x, y, s); c.fill();
    }
    drawSkyline(c, rnd, FW, ground + 2);
    c.fillStyle = '#0a112b'; c.fillRect(0, ground, FW, FH - ground);
    c.translate(OX, OY);
    // field panel
    c.fillStyle = 'rgba(7,12,32,0.66)';
    roundRect(c, FIELD_L - 5, FIELD_TOP - 16, FIELD_R - FIELD_L + 10, DEADLINE - FIELD_TOP + 26, 10); c.fill();
    c.strokeStyle = 'rgba(201,169,106,.75)'; c.lineWidth = 2;
    roundRect(c, FIELD_L - 5, FIELD_TOP - 16, FIELD_R - FIELD_L + 10, DEADLINE - FIELD_TOP + 26, 10); c.stroke();
    return cv;
  }
  function buildWall() {
    const w = FIELD_R - FIELD_L, h = WALL_H;
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * pxs); cv.height = Math.round(h * pxs);
    const c = cv.getContext('2d'); c.scale(cv.width / w, cv.height / h);
    c.fillStyle = '#a08454'; c.fillRect(0, 0, w, h);
    const rnd = mulberry32(42);
    const course = ROW_H / 2;
    const tones = ['#eadbb4', '#e2cf9f', '#dac38d', '#efe3c6', '#d3b982', '#e6d5aa'];
    for (let yb = h - 5; yb > -course; yb -= course) {
      let x = -(rnd() * 30);
      while (x < w) {
        const bw = 26 + rnd() * 34;
        const bx = x + 1, by = yb - course + 1, bww = bw - 2, bh = course - 2;
        c.fillStyle = tones[(rnd() * tones.length) | 0];
        roundRect(c, bx, by, bww, bh, 2.5); c.fill();
        c.fillStyle = 'rgba(120,95,50,0.2)';
        for (let k = 0; k < 6; k++) { circ(c, bx + rnd() * bww, by + rnd() * bh, 0.5 + rnd() * 0.8); c.fill(); }
        c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(bx + 1, by + 1, bww - 2, 1.4);
        c.fillStyle = 'rgba(90,65,30,0.28)'; c.fillRect(bx + 1, by + bh - 1.8, bww - 2, 1.4);
        x += bw;
      }
    }
    c.fillStyle = '#8f7647'; c.fillRect(0, h - 5, w, 5);
    c.fillStyle = '#c4a970'; c.fillRect(0, h - 5, w, 1.5);
    return cv;
  }

  function resize() {
    const cs = getComputedStyle(app);
    const aw = app.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const ah = app.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    scale = Math.max(0.3, Math.min(aw / W, ah / H));
    FW = Math.max(W, aw / scale); FH = Math.max(H, ah / scale);
    OX = (FW - W) / 2; OY = (FH - H) / 2;
    stage.style.width = Math.round(FW * scale) + 'px';
    stage.style.height = Math.round(FH * scale) + 'px';
    stage.style.setProperty('--u', scale + 'px');
    stage.style.setProperty('--ox', OX * scale + 'px');
    stage.style.setProperty('--oy', OY * scale + 'px');
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    pxs = scale * dpr;
    canvas.width = Math.round(FW * pxs);
    canvas.height = Math.round(FH * pxs);
    sprites = [];
    for (let t = 0; t < DRAW.length; t++) sprites[t] = renderPiece(t, R, pxs);
    bgCv = buildBackground();
    wallCv = buildWall();
  }

  // ---------- Grid ----------
  const rowCols = r => (r % 2 === 0 ? COLS : COLS - 1);
  const emptyGrid = () => Array.from({ length: MAX_ROWS }, () => new Array(COLS).fill(EMPTY));
  const cellX = (r, c) => FIELD_L + R + c * D + (r % 2 ? R : 0);
  const wallBottom = () => FIELD_TOP + G.wallRows * ROW_H;
  const cellY = r => wallBottom() + R + r * ROW_H;
  const visY = r => FIELD_TOP + G.wallVis * ROW_H + R + r * ROW_H;

  function neighbors(r, c) {
    const out = [];
    const cand = r % 2
      ? [[r, c - 1], [r, c + 1], [r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]]
      : [[r, c - 1], [r, c + 1], [r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]];
    for (const [rr, cc] of cand) if (rr >= 0 && rr < MAX_ROWS && cc >= 0 && cc < rowCols(rr)) out.push([rr, cc]);
    return out;
  }
  function flood(r, c, pred) {
    const seen = new Set([r * COLS + c]);
    const out = [[r, c]], q = [[r, c]];
    while (q.length) {
      const [cr, cc] = q.pop();
      for (const [nr, nc] of neighbors(cr, cc)) {
        const k = nr * COLS + nc;
        if (!seen.has(k) && G.grid[nr][nc] !== EMPTY && pred(G.grid[nr][nc])) { seen.add(k); out.push([nr, nc]); q.push([nr, nc]); }
      }
    }
    return out;
  }
  function forEachPiece(fn) {
    for (let r = 0; r < MAX_ROWS; r++) for (let c = 0; c < rowCols(r); c++) if (G.grid[r][c] !== EMPTY) fn(r, c, G.grid[r][c]);
  }
  function presentColors() {
    const s = new Set();
    forEachPiece((r, c, t) => { if (isColor(t)) s.add(t); });
    return [...s];
  }
  function hitsAny(x, y) {
    const top = wallBottom();
    const rg = Math.round((y - top - R) / ROW_H);
    for (let r = Math.max(0, rg - 2); r <= Math.min(MAX_ROWS - 1, rg + 2); r++) {
      const cy = top + R + r * ROW_H;
      for (let c = 0; c < rowCols(r); c++) {
        if (G.grid[r][c] === EMPTY) continue;
        const dx = cellX(r, c) - x, dy = cy - y;
        if (dx * dx + dy * dy < HIT * HIT) return true;
      }
    }
    return false;
  }
  function snapCell(x, y) {
    const top = wallBottom();
    const rg = Math.round((y - top - R) / ROW_H);
    const cands = [];
    for (let r = Math.max(0, rg - 1); r <= Math.min(MAX_ROWS - 1, rg + 1); r++) {
      for (let c = 0; c < rowCols(r); c++) {
        if (G.grid[r][c] !== EMPTY) continue;
        const dx = cellX(r, c) - x, dy = top + R + r * ROW_H - y;
        cands.push({ r, c, d: dx * dx + dy * dy });
      }
    }
    cands.sort((a, b) => a.d - b.d);
    for (const k of cands) if (k.r === 0 || neighbors(k.r, k.c).some(([nr, nc]) => G.grid[nr][nc] !== EMPTY)) return k;
    return cands[0] || null;
  }

  // ---------- Difficulty (like Snood's Child / Easy / Medium / Hard / Evil) ----------
  // guide: full = dotted path + landing spot, short = up to the first bounce, none = launcher only
  // miss: how much each miss costs on the candle clock, relative to normal. mult: gelt multiplier.
  const DIFFS = [
    { id: 'kids', name: 'Kids', desc: 'Full aim guide, slow clock, fewer characters', guide: 'full', miss: 0.67, rows: -1, colors: -1, bricks: 0, hamans: 0, hamsa: 0.06, mult: 0.5, multLabel: '½×' },
    { id: 'easy', name: 'Easy', desc: 'Full aim guide', guide: 'full', miss: 1, rows: 0, colors: 0, bricks: 0, hamans: 0, hamsa: 0, mult: 1, multLabel: '1×' },
    { id: 'medium', name: 'Medium', desc: 'Short aim guide', guide: 'short', miss: 1, rows: 0, colors: 0, bricks: 0, hamans: 0, hamsa: 0, mult: 1.5, multLabel: '1½×' },
    { id: 'hard', name: 'Hard', desc: 'No aim guide, faster clock', guide: 'none', miss: 1.34, rows: 0, colors: 0, bricks: 1, hamans: 0, hamsa: 0, mult: 2, multLabel: '2×' },
    { id: 'pesach', name: 'Erev Pesach', desc: 'No guide, fastest clock, extra bricks', guide: 'none', miss: 1.67, rows: 1, colors: 0, bricks: 3, hamans: 1, hamsa: 0, mult: 3, multLabel: '3×' },
  ];
  let diffIdx = Math.min(DIFFS.length - 1, Math.max(0, store.get('diff', 1) | 0));
  const diff = () => DIFFS[diffIdx];
  const bestKey = () => 'best.' + diff().id;
  function loadBest() {
    let b = store.get(bestKey(), null);
    if (b === null && diff().id === 'easy') b = store.get('best', 0); // scores from before difficulty levels existed
    return b || 0;
  }

  // ---------- Levels ----------
  function levelCfg(n) {
    const d = diff();
    const base = {
      rows: Math.min(4 + Math.ceil(n / 2), 9),
      colors: n <= 1 ? 4 : n <= 3 ? 5 : 6,
      bricks: n >= 3 ? Math.min(2 + Math.floor((n - 3) / 2), 8) : 0,
      hamans: n >= 2 ? Math.min(1 + Math.floor((n - 2) / 3), 4) : 0,
      missCost: n <= 4 ? 3 : n <= 8 ? 4 : 6,
      hamsa: n >= 2 ? 0.07 : 0,
    };
    return {
      rows: Math.max(3, Math.min(base.rows + d.rows, 10)),
      colors: Math.max(3, Math.min(base.colors + d.colors, 6)),
      bricks: base.bricks + d.bricks,
      hamans: base.hamans + d.hamans,
      missCost: Math.max(1, Math.round(base.missCost * d.miss)),
      hamsa: base.hamsa + d.hamsa,
    };
  }
  function buildLevel(n) {
    const cfg = levelCfg(n);
    const g = emptyGrid();
    for (let r = 0; r < cfg.rows; r++) {
      for (let c = 0; c < rowCols(r); c++) {
        let t = EMPTY;
        if (Math.random() < 0.42) {
          const opts = neighbors(r, c).filter(([rr, cc]) => (rr < r || (rr === r && cc < c)) && isColor(g[rr][cc]));
          if (opts.length) { const [rr, cc] = opts[(Math.random() * opts.length) | 0]; t = g[rr][cc]; }
        }
        if (t === EMPTY) t = (Math.random() * cfg.colors) | 0;
        g[r][c] = t;
      }
    }
    const spots = [];
    for (let r = 1; r < cfg.rows; r++) for (let c = 0; c < rowCols(r); c++) spots.push([r, c]);
    for (let i = spots.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [spots[i], spots[j]] = [spots[j], spots[i]]; }
    let k = 0;
    for (let i = 0; i < cfg.bricks && k < spots.length; i++, k++) { const [r, c] = spots[k]; g[r][c] = BRICK; }
    for (let i = 0; i < cfg.hamans && k < spots.length; i++, k++) { const [r, c] = spots[k]; g[r][c] = HAMAN; }
    return g;
  }

  // ---------- Game state ----------
  const G = {
    state: 'title', level: 1, score: 0, shown: 0, levelStartScore: 0,
    grid: emptyGrid(), gridVer: 0, wallRows: 0, wallVis: 0, clock: CLOCK_MAX, cfg: levelCfg(1),
    cur: 0, next: 1, angle: Math.PI / 2, shot: null, busy: 0, timer: 0, dieDropped: false,
    fx: [], falling: [], parts: [], texts: [], banner: null, shake: 0, candles: 0, t: 0,
    best: loadBest(), maxLevel: store.get('maxLevel', 1), clearInfo: null, pendingLevel: 1,
  };

  function pickType(allowHamsa = true) {
    if (allowHamsa && G.cfg.hamsa && G.cur !== HAMSA && G.next !== HAMSA && Math.random() < G.cfg.hamsa) return HAMSA;
    const p = presentColors();
    const arr = p.length ? p : [...Array(G.cfg.colors).keys()];
    return arr[(Math.random() * arr.length) | 0];
  }
  function fixQueue() {
    const p = presentColors();
    if (!p.length) return;
    if (isColor(G.cur) && !p.includes(G.cur)) G.cur = pickType(false);
    if (isColor(G.next) && !p.includes(G.next)) G.next = pickType(false);
  }
  function addScore(n) { const v = Math.round(n * diff().mult); G.score += v; return v; }
  function say(text, x, y, size = 22, color = '#ffd166') {
    G.texts.push({ text, x: Math.max(70, Math.min(W - 70, x)), y, size, color, age: 0, dur: 1.15 });
  }
  function banner(title, sub, dur = 1.5) { G.banner = { title, sub, age: 0, dur }; }
  function saveBest() {
    if (G.score > G.best) { G.best = G.score; store.set(bestKey(), G.best); }
  }

  function startLevel(n, carry = 0) {
    G.level = n; G.cfg = levelCfg(n);
    G.grid = buildLevel(n); G.gridVer++;
    G.wallRows = 0; G.wallVis = 0; G.clock = CLOCK_MAX;
    G.shot = null; G.fx = []; G.falling = []; G.parts = []; G.texts = [];
    G.score = carry; G.shown = carry; G.levelStartScore = carry;
    G.cur = pickType(false); G.next = pickType(false);
    G.angle = Math.PI / 2; G.candles = 0; G.dieDropped = false;
    G.state = 'play'; G.busy = 0.45;
    banner(`Level ${n}`, stopName(n));
    showScreen(null);
  }

  function fire() {
    if (G.state !== 'play' || G.shot || G.busy > 0) return;
    const a = G.angle;
    G.shot = { x: LX, y: LY, vx: Math.cos(a) * SPEED, vy: -Math.sin(a) * SPEED, t: G.cur };
    G.cur = G.next; G.next = pickType();
    Sound.shoot();
  }
  function swap() {
    if (G.state !== 'play' || G.busy > 0) return;
    [G.cur, G.next] = [G.next, G.cur];
    Sound.swap();
  }

  function updateShot(dt) {
    const s = G.shot;
    const steps = Math.max(1, Math.ceil(SPEED * dt / 4));
    for (let i = 0; i < steps; i++) {
      s.x += s.vx * dt / steps; s.y += s.vy * dt / steps;
      if (s.x < FIELD_L + R) { s.x = 2 * (FIELD_L + R) - s.x; s.vx = Math.abs(s.vx); Sound.bounce(); }
      else if (s.x > FIELD_R - R) { s.x = 2 * (FIELD_R - R) - s.x; s.vx = -Math.abs(s.vx); Sound.bounce(); }
      if (s.y - R <= wallBottom() || hitsAny(s.x, s.y)) { land(s); return; }
    }
  }

  function land(s) {
    G.shot = null;
    const cell = snapCell(s.x, s.y);
    if (!cell) { gameOver(); return; }
    G.grid[cell.r][cell.c] = s.t; G.gridVer++;
    Sound.land();
    resolve(cell.r, cell.c);
  }

  function spawnFall(r, c, t) {
    const f = { t, x: cellX(r, c), y: visY(r), vx: (Math.random() - 0.5) * 140, vy: -80 - Math.random() * 140, rot: 0, vr: (Math.random() - 0.5) * 6 };
    G.falling.push(f);
    return f;
  }
  function dropFloating() {
    const keep = new Set(), q = [];
    for (let c = 0; c < rowCols(0); c++) if (G.grid[0][c] !== EMPTY) { keep.add(c); q.push([0, c]); }
    while (q.length) {
      const [r, c] = q.pop();
      for (const [nr, nc] of neighbors(r, c)) {
        const k = nr * COLS + nc;
        if (G.grid[nr][nc] !== EMPTY && !keep.has(k)) { keep.add(k); q.push([nr, nc]); }
      }
    }
    const out = [];
    forEachPiece((r, c, t) => { if (!keep.has(r * COLS + c)) { out.push(spawnFall(r, c, t)); G.grid[r][c] = EMPTY; } });
    if (out.length) G.gridVer++;
    return out;
  }

  function resolve(r, c) {
    const t = G.grid[r][c];
    const x = cellX(r, c), y = visY(r);
    let group = [];
    if (t === HAMSA) {
      const seen = new Map();
      const hamsas = flood(r, c, tt => tt === HAMSA);
      const near = new Set();
      for (const [hr, hc] of hamsas) for (const [nr, nc] of neighbors(hr, hc)) if (isColor(G.grid[nr][nc])) near.add(G.grid[nr][nc]);
      for (const col of near) {
        const g = flood(r, c, tt => tt === col || tt === HAMSA);
        if (g.length >= 3) for (const p of g) seen.set(p[0] * COLS + p[1], p);
      }
      if (hamsas.length >= 3) for (const p of hamsas) seen.set(p[0] * COLS + p[1], p);
      group = [...seen.values()];
    } else if (isColor(t)) {
      const g = flood(r, c, tt => tt === t || tt === HAMSA);
      if (g.length >= 3) group = g;
    }

    let dropped = [];
    if (group.length) {
      group.forEach(([pr, pc], i) => {
        G.fx.push({ t: G.grid[pr][pc], x: cellX(pr, pc), y: visY(pr), age: -i * 0.035 });
        G.grid[pr][pc] = EMPTY;
        if (i < 12) Sound.pop(i);
      });
      G.gridVer++;
      dropped = dropFloating();
    }

    const popped = group.length;
    const hamanDropped = dropped.filter(f => f.t === HAMAN).length;
    const gained = popped * 10 + (dropped.length ? 20 * dropped.length * dropped.length : 0) + hamanDropped * 250;
    const earned = gained ? addScore(gained) : 0;

    if (!popped) {
      G.clock -= G.cfg.missCost;
      Sound.miss();
      if (Math.random() < 0.3) say(pick(LINES.miss), x, y - 10, 18, '#efe2c2');
    } else {
      G.clock = Math.min(CLOCK_MAX, G.clock + dropped.length);
      const total = popped + dropped.length;
      if (total >= 12) say(pick(LINES.big), x, y - 10, 30, '#ffb02e');
      else if (total >= 7) say(pick(LINES.mid), x, y - 10, 25, '#ffd166');
      else if (Math.random() < 0.45) say(pick(LINES.small), x, y - 10, 20, '#ffe7a8');
      if (dropped.length) { Sound.drop(dropped.length); vibrate(25); }
      if (hamanDropped) { Sound.grogger(); say('Booo, Haman!', W / 2, 300, 26, '#c8e6a0'); vibrate([30, 30, 30, 30, 30]); }
      if (earned >= 50) say('+' + fmt(earned), x, y + 22, 16, '#ffffff');
    }

    if (!presentColors().length) { levelClear(); return; }
    if (G.clock <= 0) ceilingDrop();
    fixQueue();
    if (crossed()) gameOver();
  }

  function crossed() {
    let over = false;
    forEachPiece(r => { if (cellY(r) + R > DEADLINE + 0.5) over = true; });
    return over;
  }
  function ceilingDrop() {
    G.wallRows++; G.clock = CLOCK_MAX; G.gridVer++;
    G.shake = 0.5; G.candles = 2.4; G.busy = Math.max(G.busy, 0.45);
    Sound.ceiling(); vibrate(90);
    banner('Candle lighting!', 'The stone comes down a row', 1.3);
  }
  function levelClear() {
    let hamans = 0;
    forEachPiece((r, c, t) => { if (t === HAMAN) hamans++; spawnFall(r, c, t); G.grid[r][c] = EMPTY; });
    G.gridVer++;
    const minutes = Math.max(0, Math.round(G.clock));
    const bonus = 500 + G.level * 250 + minutes * 50 + hamans * 250;
    G.clearInfo = { bonus: addScore(bonus), minutes, level: G.level };
    G.maxLevel = Math.max(G.maxLevel, G.level + 1); store.set('maxLevel', G.maxLevel);
    saveBest();
    Sound.clear(); if (hamans) Sound.grogger();
    vibrate([40, 40, 80]);
    say('Mazal Tov!', W / 2, 280, 40, '#ffb02e');
    G.state = 'clearing'; G.timer = 1.4;
  }
  function gameOver() {
    if (G.state === 'dying') return;
    G.state = 'dying'; G.timer = 1.7; G.dieDropped = false; G.shot = null;
    saveBest();
    Sound.over(); vibrate([60, 40, 140]);
    banner('Oy vey!', 'The stone came all the way down', 1.6);
  }

  // ---------- UI screens ----------
  const $ = id => document.getElementById(id);
  const screens = { title: $('screen-title'), diff: $('screen-diff'), pause: $('screen-pause'), level: $('screen-level'), over: $('screen-over') };
  function showScreen(name) {
    // the difficulty picker opens on top of the title screen
    for (const k in screens) screens[k].hidden = !(k === name || (name === 'diff' && k === 'title'));
    $('hud-buttons').hidden = false;
    $('btn-pause').hidden = !(G.state === 'play' || G.state === 'clearing' || G.state === 'dying');
    if (name) {
      const b = screens[name].querySelector('[data-focus]');
      if (b) setTimeout(() => { try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
    }
  }
  function showTitle() {
    G.state = 'title';
    G.cfg = levelCfg(1); G.grid = buildLevel(1); G.gridVer++;
    G.wallRows = 0; G.wallVis = 0; G.clock = CLOCK_MAX; G.shot = null;
    G.fx = []; G.falling = []; G.parts = []; G.texts = []; G.banner = null;
    const cont = $('btn-continue');
    cont.hidden = G.maxLevel <= 1;
    cont.textContent = `Continue at Level ${G.maxLevel}`;
    const best = $('best-line');
    best.hidden = !G.best;
    best.textContent = `Best on ${diff().name}: ${fmt(G.best)} gelt`;
    showScreen('title');
  }
  function buildDiffList() {
    const list = $('diff-list');
    list.innerHTML = '';
    DIFFS.forEach((d, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'diff'; b.dataset.diff = d.id;
      b.setAttribute('aria-pressed', String(i === diffIdx));
      if (i === diffIdx) b.setAttribute('data-focus', '');
      const name = document.createElement('span'); name.className = 'diff-name'; name.textContent = d.name;
      const desc = document.createElement('span'); desc.className = 'diff-desc'; desc.textContent = d.desc;
      const mult = document.createElement('span'); mult.className = 'diff-mult'; mult.textContent = `${d.multLabel} gelt`;
      b.append(name, desc, mult);
      b.addEventListener('click', () => {
        diffIdx = i; store.set('diff', i);
        G.best = loadBest();
        startLevel(G.pendingLevel);
      });
      list.append(b);
    });
  }
  function showDiff(level) {
    G.pendingLevel = level;
    $('diff-sub').textContent = level > 1 ? `Starting at Level ${level}, ${stopName(level)}` : 'Starting in Toledo';
    buildDiffList();
    showScreen('diff');
  }
  function showLevelDone() {
    const i = G.clearInfo;
    $('lvl-sub').textContent = `Level ${i.level} cleared`;
    $('lvl-bonus').textContent = '+' + fmt(i.bonus);
    $('lvl-min').textContent = i.minutes + ' min';
    $('lvl-gelt').textContent = fmt(G.score);
    $('lvl-next').textContent = stopName(i.level + 1);
    $('lvl-face').src = faceUrls[(Math.random() * 6) | 0];
    G.state = 'levelup';
    showScreen('level');
  }
  function showGameOver() {
    $('over-gelt').textContent = fmt(G.score);
    $('over-best').textContent = fmt(G.best);
    $('over-best-label').textContent = `Best on ${diff().name}`;
    $('over-level').textContent = `Level ${G.level}, ${stopName(G.level)}`;
    $('btn-retry').textContent = `Try Level ${G.level} again`;
    G.state = 'over';
    showScreen('over');
  }
  function togglePause() {
    if (G.state === 'play') { G.state = 'paused'; showScreen('pause'); }
    else if (G.state === 'paused') { G.state = 'play'; G.busy = 0.25; showScreen(null); }
  }
  function syncMute() {
    $('ico-sound').hidden = Sound.muted;
    $('ico-muted').hidden = !Sound.muted;
    $('btn-mute').setAttribute('aria-label', Sound.muted ? 'Turn sound on' : 'Mute sound');
  }
  function syncMusic() {
    document.querySelectorAll('[data-music]').forEach(b => {
      b.setAttribute('aria-pressed', String(Music.enabled));
      b.querySelector('span').textContent = Music.enabled ? 'Music on' : 'Music off';
    });
  }

  // ---------- Input ----------
  const keys = { left: false, right: false };
  let aiming = false;
  function toLogical(e) {
    const rc = canvas.getBoundingClientRect();
    return { x: (e.clientX - rc.left) / rc.width * FW - OX, y: (e.clientY - rc.top) / rc.height * FH - OY };
  }
  function aimAt(p) {
    const a = p.y >= LY - 12 ? (p.x < LX ? A_MAX : A_MIN) : Math.atan2(LY - p.y, p.x - LX);
    G.angle = Math.min(A_MAX, Math.max(A_MIN, a));
  }
  canvas.addEventListener('pointerdown', e => {
    Sound.init();
    if (G.state !== 'play') return;
    e.preventDefault();
    const p = toLogical(e);
    if (Math.hypot(p.x - NEXT_X, p.y - NEXT_Y) < 36) { swap(); return; }
    if (Math.hypot(p.x - CLOCK_X, p.y - CLOCK_Y) < 36) return;
    aiming = true; aimAt(p);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  canvas.addEventListener('pointermove', e => {
    if (G.state !== 'play') return;
    if (aiming || e.pointerType === 'mouse') aimAt(toLogical(e));
  });
  canvas.addEventListener('pointerup', e => {
    if (!aiming) return;
    aiming = false;
    const p = toLogical(e);
    if (p.y < LY - 12) { aimAt(p); fire(); }
  });
  canvas.addEventListener('pointercancel', () => { aiming = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  ['touchend', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, () => Sound.init(), { passive: true }));

  window.addEventListener('keydown', e => {
    const k = e.key;
    if (k === 'Escape' && !screens.diff.hidden) { showTitle(); return; }
    if (k === 'p' || k === 'P' || k === 'Escape') { togglePause(); return; }
    if (k === 'm' || k === 'M') { Sound.toggle(); syncMute(); return; }
    if (k === 'n' || k === 'N') { Music.toggle(); syncMusic(); return; }
    if (G.state !== 'play') return;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.left = true; e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.right = true; e.preventDefault(); }
    else if (k === ' ' || k === 'ArrowUp' || k === 'Enter') { e.preventDefault(); fire(); }
    else if (k === 'x' || k === 'X' || k === 'Shift' || k === 'ArrowDown') { e.preventDefault(); swap(); }
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play') togglePause(); });

  $('btn-play').addEventListener('click', () => showDiff(1));
  $('btn-continue').addEventListener('click', () => showDiff(G.maxLevel));
  $('btn-diff-back').addEventListener('click', showTitle);
  $('btn-pause').addEventListener('click', togglePause);
  $('btn-mute').addEventListener('click', () => { Sound.init(); Sound.toggle(); syncMute(); });
  $('btn-resume').addEventListener('click', togglePause);
  $('btn-restart').addEventListener('click', () => startLevel(G.level, G.levelStartScore));
  $('btn-home').addEventListener('click', showTitle);
  $('btn-next').addEventListener('click', () => startLevel(G.level + 1, G.score));
  $('btn-retry').addEventListener('click', () => startLevel(G.level, G.levelStartScore));
  $('btn-over-home').addEventListener('click', showTitle);
  document.querySelectorAll('[data-music]').forEach(b => b.addEventListener('click', () => { Sound.init(); Music.toggle(); syncMusic(); }));

  // ---------- Update ----------
  let aimCache = { key: '', pts: [], ghost: null };
  function getAim() {
    const key = G.angle.toFixed(4) + '|' + G.gridVer + '|' + G.wallRows;
    if (key === aimCache.key) return aimCache;
    let x = LX, y = LY, vx = Math.cos(G.angle), vy = -Math.sin(G.angle);
    const pts = [];
    let travelled = 0, nextDot = 34, end = null, firstBounce = -1;
    for (let i = 0; i < 420; i++) {
      x += vx * 4; y += vy * 4; travelled += 4;
      let bounced = false;
      if (x < FIELD_L + R) { x = 2 * (FIELD_L + R) - x; vx = -vx; bounced = true; }
      else if (x > FIELD_R - R) { x = 2 * (FIELD_R - R) - x; vx = -vx; bounced = true; }
      if (bounced && firstBounce < 0) firstBounce = pts.length;
      if (y - R <= wallBottom() || hitsAny(x, y)) { end = { x, y }; break; }
      if (travelled >= nextDot) { pts.push([x, y]); nextDot += 15; }
    }
    aimCache = { key, pts, firstBounce, ghost: end ? snapCell(end.x, end.y) : null };
    return aimCache;
  }

  function update(dt) {
    G.t += dt;
    const mood = G.state === 'title' ? 'calm' : G.clock <= 3 ? 'panic' : G.clock <= 6 ? 'hurry' : 'play';
    Music.update(G.state === 'title' || G.state === 'play', mood);
    if (G.state === 'paused') return;
    if (G.state === 'play') {
      if (keys.left) G.angle = Math.min(A_MAX, G.angle + 1.8 * dt);
      if (keys.right) G.angle = Math.max(A_MIN, G.angle - 1.8 * dt);
    }
    if (G.busy > 0) G.busy -= dt;
    if (G.shot && G.state === 'play') updateShot(dt);

    G.wallVis += (G.wallRows - G.wallVis) * Math.min(1, dt * 9);
    if (Math.abs(G.wallRows - G.wallVis) < 0.002) G.wallVis = G.wallRows;

    for (const f of G.fx) {
      const before = f.age;
      f.age += dt;
      if (before < 0 && f.age >= 0) {
        const col = isColor(f.t) ? CAST[f.t].color : '#ffffff';
        for (let k = 0; k < 7; k++) {
          const a = Math.random() * TAU, sp = 60 + Math.random() * 140;
          G.parts.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.5 + Math.random() * 0.3, age: 0, color: col, size: 2 + Math.random() * 2.5 });
        }
      }
    }
    G.fx = G.fx.filter(f => f.age < 0.28);
    for (const f of G.falling) { f.vy += 1500 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt; }
    G.falling = G.falling.filter(f => f.y < H + 60);
    for (const p of G.parts) { p.age += dt; p.vy += 300 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    G.parts = G.parts.filter(p => p.age < p.life);
    for (const t of G.texts) t.age += dt;
    G.texts = G.texts.filter(t => t.age < t.dur);
    if (G.banner) { G.banner.age += dt; if (G.banner.age > G.banner.dur) G.banner = null; }
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt);
    if (G.candles > 0) G.candles = Math.max(0, G.candles - dt);
    G.shown += (G.score - G.shown) * Math.min(1, dt * 7);
    if (Math.abs(G.score - G.shown) < 1) G.shown = G.score;

    if (G.state === 'clearing') { G.timer -= dt; if (G.timer <= 0) showLevelDone(); }
    if (G.state === 'dying') {
      G.timer -= dt;
      if (!G.dieDropped && G.timer < 1.15) {
        G.dieDropped = true;
        forEachPiece((r, c, t) => { spawnFall(r, c, t); G.grid[r][c] = EMPTY; });
        G.gridVer++;
      }
      if (G.timer <= 0) showGameOver();
    }
  }

  // ---------- Render ----------
  function outlined(text, x, y, size, fill, weight = 700, lw = 5) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = '#0b1230';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill; ctx.fillText(text, x, y);
  }
  function drawWall() {
    const y0 = FIELD_TOP - 14;
    const bottom = FIELD_TOP + G.wallVis * ROW_H;
    const h = bottom - y0;
    const sh = h / WALL_H * wallCv.height;
    ctx.drawImage(wallCv, 0, wallCv.height - sh, wallCv.width, sh, FIELD_L, y0, FIELD_R - FIELD_L, h);
    const g = ctx.createLinearGradient(0, bottom, 0, bottom + 12);
    g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(FIELD_L, bottom, FIELD_R - FIELD_L, 12);
  }
  function lowestBottom() {
    let m = 0;
    forEachPiece(r => { m = Math.max(m, cellY(r) + R); });
    return m;
  }
  function drawDeadline() {
    const danger = (G.state === 'play') && lowestBottom() > DEADLINE - ROW_H - 1;
    const a = danger ? 0.45 + 0.35 * Math.sin(G.t * 8) : 0.22;
    ctx.strokeStyle = danger ? `rgba(255,93,108,${a})` : `rgba(239,226,194,${a})`;
    ctx.lineWidth = danger ? 2.5 : 1.5;
    ctx.setLineDash([7, 7]);
    ctx.beginPath(); ctx.moveTo(FIELD_L + 4, DEADLINE); ctx.lineTo(FIELD_R - 4, DEADLINE); ctx.stroke();
    ctx.setLineDash([]);
  }
  function drawGrid() {
    for (let r = 0; r < MAX_ROWS; r++) {
      const y = visY(r);
      for (let c = 0; c < rowCols(r); c++) {
        const t = G.grid[r][c];
        if (t !== EMPTY) drawSprite(t, cellX(r, c), y);
      }
    }
  }
  function drawAim() {
    const mode = diff().guide;
    if (mode === 'none') return;
    const a = getAim();
    const short = mode === 'short';
    const pts = short ? a.pts.slice(0, Math.min(a.firstBounce < 0 ? a.pts.length : a.firstBounce, 12)) : a.pts;
    pts.forEach(([x, y], i) => {
      const al = short ? Math.max(0.1, 0.8 - i * 0.065) : Math.max(0.12, 0.85 - i * 0.022);
      ctx.fillStyle = `rgba(255,240,200,${al})`;
      circ(ctx, x, y, 2.6); ctx.fill();
    });
    if (!short && a.ghost) {
      const gx = cellX(a.ghost.r, a.ghost.c), gy = cellY(a.ghost.r);
      drawSprite(G.cur, gx, gy, 1, 0.3);
      ctx.strokeStyle = 'rgba(255,240,200,.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      circ(ctx, gx, gy, R - 1); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  function drawHUD() {
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = `600 11px ${FONT}`; ctx.fillStyle = 'rgba(239,226,194,.62)';
    ctx.fillText(`LEVEL ${G.level} · ${diff().name.toUpperCase()}`, 22, 24);
    let size = 19;
    const name = stopName(G.level);
    ctx.font = `700 ${size}px ${FONT}`;
    while (ctx.measureText(name).width > 150 && size > 12) { size--; ctx.font = `700 ${size}px ${FONT}`; }
    ctx.fillStyle = '#efe2c2'; ctx.fillText(name, 22, 45);

    ctx.textAlign = 'right';
    ctx.font = `600 11px ${FONT}`; ctx.fillStyle = 'rgba(239,226,194,.62)';
    ctx.fillText('GELT', 290, 24);
    ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd166';
    const s = fmt(G.shown);
    ctx.fillText(s, 290, 47);
    const cw = ctx.measureText(s).width;
    const cx = 290 - cw - 13, cy = 39;
    ctx.fillStyle = '#e8a91c'; circ(ctx, cx, cy, 8); ctx.fill();
    ctx.fillStyle = '#ffd166'; circ(ctx, cx, cy, 6); ctx.fill();
    ctx.strokeStyle = '#b07a10'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 2; i++) {
      const o = i * Math.PI / 3;
      ctx.moveTo(cx + 3.6 * Math.cos(-Math.PI / 2 + o), cy + 3.6 * Math.sin(-Math.PI / 2 + o));
      for (let k = 1; k <= 3; k++) { const a = -Math.PI / 2 + o + k * TAU / 3; ctx.lineTo(cx + 3.6 * Math.cos(a), cy + 3.6 * Math.sin(a)); }
    }
    ctx.stroke();
    ctx.textAlign = 'left';
  }
  function drawLauncher() {
    ctx.save();
    ctx.translate(LX, LY);
    ctx.rotate(-G.angle);
    const g = ctx.createLinearGradient(20, -6, 20, 6);
    g.addColorStop(0, '#ffe39a'); g.addColorStop(0.5, '#e0a93a'); g.addColorStop(1, '#9c6a14');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(20, -7); ctx.lineTo(72, 0); ctx.lineTo(20, 7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#5a3c08'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#0b1230'; circ(ctx, LX, LY, 27); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#d8ad55'; ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,227,154,.4)'; circ(ctx, LX, LY, 23.5); ctx.stroke();
    if (G.state === 'play' || G.state === 'paused' || G.state === 'clearing') drawSprite(G.cur, LX, LY);
  }
  function drawNext() {
    ctx.textAlign = 'center';
    ctx.font = `600 10px ${FONT}`; ctx.fillStyle = 'rgba(239,226,194,.62)';
    ctx.fillText('NEXT', NEXT_X, 600);
    ctx.fillStyle = 'rgba(8,13,32,.6)'; circ(ctx, NEXT_X, NEXT_Y, 25); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(239,226,194,.35)'; ctx.stroke();
    if (G.state === 'play' || G.state === 'paused') drawSprite(G.next, NEXT_X, NEXT_Y, 0.82);
    ctx.font = `600 8.5px ${FONT}`; ctx.fillStyle = 'rgba(239,226,194,.5)';
    ctx.fillText('TAP TO SWAP', NEXT_X, 673);
    ctx.textAlign = 'left';
  }
  function flame(x, y, s) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 18 * s);
    g.addColorStop(0, 'rgba(255,200,90,.6)'); g.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = g; circ(ctx, x, y, 18 * s); ctx.fill();
    ctx.fillStyle = '#ffb02e';
    ctx.beginPath(); ctx.moveTo(x, y - 9 * s); ctx.quadraticCurveTo(x + 4.5 * s, y - 1 * s, x, y + 3 * s); ctx.quadraticCurveTo(x - 4.5 * s, y - 1 * s, x, y - 9 * s); ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.moveTo(x, y - 5 * s); ctx.quadraticCurveTo(x + 2.2 * s, y, x, y + 2 * s); ctx.quadraticCurveTo(x - 2.2 * s, y, x, y - 5 * s); ctx.fill();
  }
  function drawCandles() {
    const lit = G.candles > 0;
    for (const x of [262, 282]) {
      ctx.fillStyle = '#aeb5cf'; roundRect(ctx, x - 7, 655, 14, 4, 2); ctx.fill();
      ctx.fillRect(x - 1.5, 641, 3, 14);
      ctx.fillStyle = '#d4d9ee'; roundRect(ctx, x - 6, 637, 12, 5, 2); ctx.fill();
      ctx.fillStyle = '#fbf6ea'; ctx.fillRect(x - 3, 611, 6, 27);
      ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(x + 1, 611, 2, 27);
      ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, 611); ctx.lineTo(x, 607); ctx.stroke();
      if (lit) flame(x, 603, 1 + 0.12 * Math.sin(G.t * 23 + x));
    }
    if (!lit && G.state === 'play' && G.clock <= 6) {
      const bob = Math.sin(G.t * 6) * 2;
      ctx.strokeStyle = '#c9a36a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(300, 600 + bob); ctx.lineTo(291, 593 + bob); ctx.stroke();
      flame(289, 590 + bob, 0.55 + 0.08 * Math.sin(G.t * 30));
    }
  }
  function drawClock() {
    const m = Math.max(0, G.clock);
    const frac = m / CLOCK_MAX;
    const col = m > 9 ? '#5ad08a' : m > 4 ? '#ffc43d' : '#ff5d6c';
    const pulse = (G.state === 'play' && m <= 6) ? 1 + 0.05 * Math.sin(G.t * 10) : 1;
    ctx.textAlign = 'center';
    ctx.font = `600 10px ${FONT}`; ctx.fillStyle = 'rgba(239,226,194,.62)';
    ctx.fillText('CANDLES IN', CLOCK_X, 600);
    ctx.save(); ctx.translate(CLOCK_X, CLOCK_Y); ctx.scale(pulse, pulse);
    ctx.fillStyle = '#efe2c2'; circ(ctx, 0, 0, 27); ctx.fill();
    if (frac > 0) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 24, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(23,33,77,.45)'; ctx.lineWidth = 1;
    for (let i = 0; i < CLOCK_MAX; i++) {
      const a = -Math.PI / 2 + i / CLOCK_MAX * TAU;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 24.5, Math.sin(a) * 24.5); ctx.lineTo(Math.cos(a) * 27, Math.sin(a) * 27); ctx.stroke();
    }
    ctx.fillStyle = '#efe2c2'; circ(ctx, 0, 0, 15.5); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#17214d'; circ(ctx, 0, 0, 27); ctx.stroke();
    ctx.fillStyle = '#17214d'; ctx.font = `700 15px ${FONT}`; ctx.fillText(String(Math.ceil(m)), 0, 3);
    ctx.font = `600 7px ${FONT}`; ctx.fillText('MIN', 0, 11);
    ctx.restore();
    ctx.textAlign = 'left';
  }
  function drawFx() {
    for (const f of G.fx) {
      if (f.age < 0) { drawSprite(f.t, f.x, f.y); continue; }
      const k = f.age / 0.28;
      drawSprite(f.t, f.x, f.y, 1 + k * 0.6, 1 - k);
    }
    for (const p of G.parts) {
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
      ctx.fillStyle = p.color; circ(ctx, p.x, p.y, p.size); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const f of G.falling) drawSprite(f.t, f.x, f.y, 1, 1, f.rot);
  }
  function drawTexts() {
    ctx.textAlign = 'center';
    for (const t of G.texts) {
      const k = t.age / t.dur;
      const pop = t.age < 0.15 ? 0.6 + (t.age / 0.15) * 0.4 : 1;
      ctx.save();
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.translate(t.x, t.y - k * 40);
      ctx.scale(pop, pop);
      outlined(t.text, 0, 0, t.size, t.color);
      ctx.restore();
    }
    ctx.textAlign = 'left';
  }
  function drawBanner() {
    const b = G.banner;
    if (!b) return;
    const a = b.age;
    const k = a < 0.22 ? 0.7 + 0.3 * Math.sin((a / 0.22) * Math.PI / 2) : 1;
    const alpha = a > b.dur - 0.3 ? Math.max(0, (b.dur - a) / 0.3) : Math.min(1, a / 0.12);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2, 318); ctx.scale(k, k);
    ctx.fillStyle = 'rgba(11,18,48,.9)';
    roundRect(ctx, -150, -40, 300, 80, 18); ctx.fill();
    ctx.strokeStyle = '#c9a96a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = 'center';
    outlined(b.title, 0, 3, 30, '#efe2c2', 700, 4);
    ctx.font = `500 14px ${FONT}`; ctx.fillStyle = 'rgba(239,226,194,.78)';
    ctx.fillText(b.sub, 0, 27);
    ctx.restore();
    ctx.textAlign = 'left';
  }

  function render() {
    ctx.setTransform(canvas.width / FW, 0, 0, canvas.height / FH, 0, 0);
    ctx.drawImage(bgCv, 0, 0, FW, FH);
    ctx.translate(OX, OY);
    let sx = 0, sy = 0;
    if (G.shake > 0) { sx = (Math.random() - 0.5) * 9 * G.shake; sy = (Math.random() - 0.5) * 9 * G.shake; }
    ctx.save(); ctx.translate(sx, sy);
    drawWall();
    drawDeadline();
    drawGrid();
    if (G.state === 'play' && !G.shot && G.busy <= 0) drawAim();
    ctx.restore();
    drawHUD();
    drawNext();
    drawCandles();
    drawClock();
    drawLauncher();
    drawFx();
    if (G.shot) drawSprite(G.shot.t, G.shot.x, G.shot.y);
    drawTexts();
    drawBanner();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, Math.max(0, (now - last) / 1000));
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // ---------- Boot ----------
  let faceUrls = [];
  function buildCast() {
    faceUrls = CAST.map((_, t) => renderPiece(t, 40, 2).toDataURL('image/png'));
    const wrap = $('cast');
    wrap.innerHTML = '';
    CAST.forEach((p, t) => {
      const fig = document.createElement('figure');
      const img = document.createElement('img');
      img.src = faceUrls[t]; img.alt = ''; img.width = 108; img.height = 108;
      const cap = document.createElement('figcaption'); cap.textContent = p.name;
      fig.append(img, cap); wrap.append(fig);
    });
  }
  // Two Shabbat candles in silver holders. s = candle scale, sp = half the gap between them (in s units)
  function drawCandlePair(c, cx, cy, s, sp = 0.32) {
    for (const side of [-1, 1]) {
      const x = cx + side * sp * s;
      const gl = c.createRadialGradient(x, cy - 0.55 * s, 0, x, cy - 0.55 * s, 0.42 * s);
      gl.addColorStop(0, 'rgba(255,200,90,.55)'); gl.addColorStop(1, 'rgba(255,200,90,0)');
      c.fillStyle = gl; circ(c, x, cy - 0.55 * s, 0.42 * s); c.fill();
      c.fillStyle = '#c3c9df';
      roundRect(c, x - 0.16 * s, cy + 0.62 * s, 0.32 * s, 0.08 * s, 0.04 * s); c.fill();
      c.fillRect(x - 0.035 * s, cy + 0.32 * s, 0.07 * s, 0.32 * s);
      c.fillStyle = '#e1e5f4';
      roundRect(c, x - 0.13 * s, cy + 0.26 * s, 0.26 * s, 0.09 * s, 0.04 * s); c.fill();
      const g = c.createLinearGradient(x - 0.07 * s, 0, x + 0.07 * s, 0);
      g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#e3d6ba');
      c.fillStyle = g; c.fillRect(x - 0.07 * s, cy - 0.38 * s, 0.14 * s, 0.66 * s);
      c.strokeStyle = '#2b2b2b'; c.lineWidth = 0.022 * s;
      c.beginPath(); c.moveTo(x, cy - 0.38 * s); c.lineTo(x, cy - 0.45 * s); c.stroke();
      c.fillStyle = '#ffb02e';
      c.beginPath(); c.moveTo(x, cy - 0.74 * s); c.quadraticCurveTo(x + 0.11 * s, cy - 0.53 * s, x, cy - 0.44 * s); c.quadraticCurveTo(x - 0.11 * s, cy - 0.53 * s, x, cy - 0.74 * s); c.fill();
      c.fillStyle = '#fff3c4';
      c.beginPath(); c.moveTo(x, cy - 0.63 * s); c.quadraticCurveTo(x + 0.05 * s, cy - 0.51 * s, x, cy - 0.47 * s); c.quadraticCurveTo(x - 0.05 * s, cy - 0.51 * s, x, cy - 0.63 * s); c.fill();
    }
  }
  function makeIcon(size, maskable) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(size * 0.5, size * 0.36, size * 0.05, size * 0.5, size * 0.5, size * 0.75);
    g.addColorStop(0, '#2b4290'); g.addColorStop(1, '#0f1836');
    c.fillStyle = g; c.fillRect(0, 0, size, size);
    const rnd = mulberry32(3);
    for (let i = 0; i < 22; i++) { c.fillStyle = `rgba(255,244,214,${0.3 + rnd() * 0.5})`; circ(c, rnd() * size, rnd() * size, size * (0.004 + rnd() * 0.006)); c.fill(); }
    // maskable icons get cropped to a circle, so shrink the art toward the center
    const k = maskable ? 0.8 : 1;
    c.save();
    c.translate(size / 2, size / 2); c.scale(k, k); c.translate(-size / 2, -size / 2);
    drawCandlePair(c, size * 0.5, size * 0.46, size * 0.44, 0.74);
    c.translate(size * 0.5, size * 0.64); drawPiece(c, 3, size * 0.2);
    c.restore();
    return cv.toDataURL('image/png');
  }
  function makeLogoCandles() {
    const cv = document.createElement('canvas');
    cv.width = 320; cv.height = 224;
    const c = cv.getContext('2d');
    drawCandlePair(c, 160, 128, 130, 0.42);
    return cv.toDataURL('image/png');
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 80); });
  window.addEventListener('orientationchange', () => setTimeout(resize, 250));

  resize();
  buildCast();
  $('logo-candles').src = makeLogoCandles();
  syncMute();
  syncMusic();
  showTitle();
  requestAnimationFrame(frame);

  // Handy for testing in the browser console
  window.CandleRush = {
    G, startLevel, makeIcon,
    aim(deg) { G.angle = Math.min(A_MAX, Math.max(A_MIN, deg * Math.PI / 180)); },
    fire, swap, Music,
    setDiff(i) { diffIdx = i; G.best = loadBest(); },
  };
})();
