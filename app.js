"use strict";

/* ════════════════════════════════════════════════════
   Shubh Deepavali — interaction engine
   - Cinematic intro (skippable, reduced-motion safe)
   - Smooth canvas fireworks + embers (pooled, DPR-aware)
   - Scroll reveals, countdown, calendar, festive song
   ════════════════════════════════════════════════════ */

const prefersReduced = () =>
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (sel, root = document) => root.querySelector(sel);

/* ───────── INTRO ───────── */
function initIntro() {
  const intro = $("#intro");
  const enterBtn = $("#enterBtn");
  if (!intro || !enterBtn) return;

  document.body.classList.add("locked");

  // Light the scene shortly after first paint (cinematic beat 1)
  requestAnimationFrame(() => {
    setTimeout(() => intro.classList.add("is-lit"), prefersReduced() ? 0 : 250);
  });

  // Gentle welcome bursts behind the intro (beats 2–3)
  if (!prefersReduced()) {
    setTimeout(() => Sky.burst(window.innerWidth * 0.22, window.innerHeight * 0.3, 60, true), 1300);
    setTimeout(() => Sky.burst(window.innerWidth * 0.78, window.innerHeight * 0.26, 70, true), 2500);
  }

  let entered = false;
  function enter() {
    if (entered) return;
    entered = true;
    intro.classList.add("is-leaving");
    document.body.classList.remove("locked");
    document.body.classList.add("entered");
    // Celebrate the entrance
    if (!prefersReduced()) {
      setTimeout(() => {
        Sky.burst(window.innerWidth * 0.5, window.innerHeight * 0.32, 110, false);
        setTimeout(() => Sky.burst(window.innerWidth * 0.3, window.innerHeight * 0.4, 70, false), 350);
        setTimeout(() => Sky.burst(window.innerWidth * 0.7, window.innerHeight * 0.4, 70, false), 650);
      }, 350);
    }
    // Move focus to the hero heading for keyboard / screen-reader users
    setTimeout(() => {
      const h = $("#mainHeading");
      if (h) h.focus({ preventScroll: true });
      try { intro.remove(); } catch (e) { intro.style.display = "none"; }
    }, 850);
  }

  enterBtn.addEventListener("click", () => { Music.startFromGesture(); enter(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !entered) enter();
  });
  // Safety: never trap anyone behind the intro
  setTimeout(() => { if (!entered) enter(); }, 30000);
}

/* ───────── SKY: fireworks + embers ─────────
   Single canvas, additive blending, motion-blur trails.
   Pooled particles, capped counts, DPR-aware, pauses offscreen. */
const Sky = (() => {
  let canvas, ctx, W = 0, H = 0, dpr = 1;
  let rockets = [], parts = [], embers = [];
  let running = false, raf = 0, lastAuto = 0;
  const MAX_PARTS = 380;
  const GOLD = ["#f9e7a8", "#e8c66a", "#ffd76e", "#ffbe78", "#fff6d8"];
  const ACCENT = ["#ff9d5c", "#ff8f7a", "#d9b8ff"];

  function setup() {
    canvas = $("#sky");
    if (!canvas) return false;
    ctx = canvas.getContext("2d", { alpha: true });
    resize();
    window.addEventListener("resize", resize, { passive: true });
    // Slow ambient embers rising
    if (!prefersReduced()) {
      for (let i = 0; i < 42; i++) embers.push(newEmber(true));
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop(); else start();
    });
    return true;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function newEmber(anywhere) {
    return {
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : H + 10,
      r: 0.8 + Math.random() * 1.8,
      vy: 0.18 + Math.random() * 0.5,
      sway: Math.random() * Math.PI * 2,
      swaySpd: 0.004 + Math.random() * 0.012,
      swayAmp: 12 + Math.random() * 26,
      a: 0.12 + Math.random() * 0.3,
      gold: Math.random() < 0.8
    };
  }

  function launch(auto) {
    if (prefersReduced() || document.hidden) return;
    if (rockets.length > 5) return;
    rockets.push({
      x: W * (0.15 + Math.random() * 0.7),
      y: H + 8,
      vy: -(H * 0.011 + 4.5 + Math.random() * 2),
      vx: (Math.random() - 0.5) * 0.8,
      target: H * (0.18 + Math.random() * 0.3),
      hue: Math.random()
    });
  }

  function burst(x, y, n, soft) {
    if (prefersReduced()) return;
    const palette = soft ? GOLD : (Math.random() < 0.72 ? GOLD : GOLD.concat(ACCENT));
    const count = Math.min(n || 80, MAX_PARTS - parts.length);
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.25;
      const spd = (soft ? 1.2 : 2.2) + Math.random() * (soft ? 2.4 : 4.4);
      parts.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 0.6,
        life: 1,
        decay: 0.008 + Math.random() * 0.012,
        r: 1 + Math.random() * 2.1,
        color: palette[(Math.random() * palette.length) | 0],
        tw: Math.random() * Math.PI * 2
      });
    }
    if (parts.length > MAX_PARTS) parts.splice(0, parts.length - MAX_PARTS);
    try { if (typeof Music !== "undefined" && Music.sfxBurst) Music.sfxBurst(soft); } catch (e) {}
    start();
  }

  function frame(t) {
    if (!running) return;
    raf = requestAnimationFrame(frame);

    // Trail fade that preserves page transparency: fade previous pixels
    // toward transparent instead of painting an opaque layer over the
    // body's gradient background.
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = "rgba(0, 0, 0, 0.86)";
    ctx.fillRect(0, 0, W, H);

    // Embers
    ctx.globalCompositeOperation = "lighter";
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.sway += e.swaySpd * 16;
      e.y -= e.vy;
      e.x += Math.sin(e.sway) * 0.25;
      if (e.y < -12) embers[i] = newEmber(false);
      ctx.globalAlpha = e.a * (0.7 + 0.3 * Math.sin(e.sway * 0.7));
      ctx.fillStyle = e.gold ? "#e8c66a" : "#8f93ff";
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Rockets
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.x += r.vx; r.y += r.vy; r.vy += 0.045;
      ctx.strokeStyle = "rgba(249, 231, 168, 0.8)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x - r.vx * 6, r.y - r.vy * 6);
      ctx.stroke();
      if (r.y <= r.target || r.vy > -1.2) {
        rockets.splice(i, 1);
        burst(r.x, r.y, 70 + ((Math.random() * 50) | 0), false);
      }
    }

    // Particles
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.vx *= 0.986; p.vy = p.vy * 0.986 + 0.035;
      p.x += p.vx; p.y += p.vy;
      p.tw += 0.12; p.life -= p.decay;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life) * (0.65 + 0.35 * Math.sin(p.tw));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // Ambient auto-show: one rocket every ~3s while entered
    if (document.body.classList.contains("entered") && !document.hidden) {
      if (t - lastAuto > 3000) { lastAuto = t; launch(true); }
    }
    // Idle down when nothing is happening (but keep embers alive while visible)
    if (rockets.length === 0 && parts.length === 0 && !document.body.classList.contains("entered")) {
      // keep running for embers during intro; cheap enough
    }
  }

  function start() {
    if (running || prefersReduced() || !ctx) return;
    running = true;
    ctx.clearRect(0, 0, W, H);
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  return {
    init() { if (setup()) start(); },
    burst, launch,
    manual(x, y) { burst(x, y, 90, false); }
  };
})();

/* ───────── SCROLL REVEALS ───────── */
function initReveals() {
  const els = Array.from(document.querySelectorAll(".reveal"));
  if (!els.length) return;
  if (prefersReduced() || !("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add("is-visible");
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.14, rootMargin: "0px 0px -6% 0px" });
  els.forEach((el) => io.observe(el));
}

/* ───────── COUNTDOWN (English, tabular) ───────── */
function initCountdown() {
  const dEl = $("#cdD"), hEl = $("#cdH"), mEl = $("#cdM"), sEl = $("#cdS");
  const label = $("#countLabel");
  if (!dEl) return;
  const target = new Date("2026-11-08T18:30:00+05:30").getTime();
  if (isNaN(target)) return;
  const pad = (n) => String(n).padStart(2, "0");
  function set(el, val) {
    const str = pad(val);
    if (el.textContent !== str) {
      el.textContent = str;
      if (!prefersReduced()) {
        el.classList.remove("tick");
        void el.offsetWidth;
        el.classList.add("tick");
      }
    }
  }
  function tick() {
    const diff = target - Date.now();
    if (diff <= 0) {
      if (label) label.textContent = "The celebration has begun — see you tonight";
      set(dEl, 0); set(hEl, 0); set(mEl, 0); set(sEl, 0);
      return;
    }
    set(dEl, Math.floor(diff / 86400000));
    set(hEl, Math.floor(diff / 3600000) % 24);
    set(mEl, Math.floor(diff / 60000) % 60);
    set(sEl, Math.floor(diff / 1000) % 60);
  }
  tick();
  setInterval(tick, 1000);
}

/* ───────── ADD TO CALENDAR (.ics, English) ───────── */
function initCalendar() {
  const btn = $("#calBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//PramanikFamily//Diwali2026//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:diwali-2026-pramanik@invitation",
      "DTSTAMP:20260101T000000Z",
      "DTSTART;TZID=Asia/Kolkata:20261108T183000",
      "DTEND;TZID=Asia/Kolkata:20261108T220000",
      "SUMMARY:Diwali Celebration & Lakshmi Puja — Pramanik Family",
      "LOCATION:Family Residence\\, Kayemba\\, Birbhum\\, West Bengal 731241",
      "DESCRIPTION:An evening of prayer\\, sweets and togetherness. Please arrive by 6:15 PM.",
      "END:VEVENT",
      "END:VCALENDAR"
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diwali-2026-invitation.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  });
}

/* ───────── FESTIVE BACKGROUND SONG ─────────
   Primary: "audio/diwali-festive-loop.mp3" — your festive background song.
   To use your own Hindi Diwali song instead, see audio/README.txt.
   Fallback: soft WebAudio drone if the file cannot load.
   Starts ONLY on user gesture. Toggle + auto-pause when hidden. */
const Music = (() => {
  let actx = null, master = null, playing = false, timer = 0;
  let song = null, songFailed = false, fadeTimer = 0;

  function songEl() {
    if (!song) song = document.getElementById("bgSong");
    return song;
  }

  function fadeSong(to, ms, done) {
    const a = songEl();
    if (!a) { if (done) done(); return; }
    try {
      if (fadeTimer) clearInterval(fadeTimer);
      const from = a.volume;
      const steps = Math.max(1, Math.round(ms / 50));
      let i = 0;
      fadeTimer = setInterval(() => {
        i++;
        const k = Math.min(1, i / steps);
        a.volume = from + (to - from) * (k * k);
        if (k >= 1) { clearInterval(fadeTimer); fadeTimer = 0; if (done) done(); }
      }, 50);
    } catch (e) { if (done) done(); }
  }

  function playSong() {
    const a = songEl();
    if (!a || songFailed) return false;
    try {
      a.volume = 0;
      const p = a.play();
      if (p && p.catch) p.catch(() => { songFailed = true; playDrone(); });
      fadeSong(0.5, 1500);
      return true;
    } catch (e) { songFailed = true; return false; }
  }

  function ensure() {
    if (actx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      actx = new AC();
      master = actx.createGain();
      master.gain.value = 0;
      const filter = actx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 620;
      master.connect(filter);
      filter.connect(actx.destination);

      // Warm drone: tonic + fifth, barely-there volume
      [[110, 0.5], [164.81, 0.32], [220, 0.18]].forEach(([f, g]) => {
        const o = actx.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        const gn = actx.createGain();
        gn.gain.value = g;
        o.connect(gn);
        gn.connect(master);
        o.start();
      });
      // Slow breathing LFO on the master gain
      const lfo = actx.createOscillator();
      lfo.frequency.value = 0.08;
      const lfoGain = actx.createGain();
      lfoGain.gain.value = 0.012;
      lfo.connect(lfoGain);
      lfoGain.connect(master.gain);
      lfo.start();
      return true;
    } catch (e) { return false; }
  }

  function fadeTo(v, ms) {
    if (!actx || !master) return;
    try {
      const t = actx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(v, t + ms / 1000);
    } catch (e) {}
  }

  function playDrone() {
    if (!ensure()) return;
    try {
      if (actx.state === "suspended") actx.resume();
      fadeTo(0.055, 1200);
      timer = setInterval(bell, 16000);
    } catch (e) {}
  }

  function bell() {
    if (!actx || !playing || document.hidden) return;
    try {
      const o = actx.createOscillator();
      o.type = "sine";
      o.frequency.value = 880;
      const g = actx.createGain();
      g.gain.setValueAtTime(0.05, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 2.4);
      o.connect(g);
      g.connect(actx.destination);
      o.start();
      o.stop(actx.currentTime + 2.5);
    } catch (e) {}
  }

  /* Firework + ignition sound effects (synthesized, no files).
     Only audible while the music toggle is on (playing === true). */
  function sfxBurst(soft) {
    if (!actx || !playing || document.hidden) return;
    try {
      const t = actx.currentTime;
      const big = !soft;
      // Distant launch whistle for full bursts
      if (big) {
        const w = actx.createOscillator();
        w.type = "sine";
        w.frequency.setValueAtTime(480, t);
        w.frequency.exponentialRampToValueAtTime(1350, t + 0.45);
        const wg = actx.createGain();
        wg.gain.setValueAtTime(0.0001, t);
        wg.gain.exponentialRampToValueAtTime(0.045, t + 0.12);
        wg.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        w.connect(wg); wg.connect(actx.destination);
        w.start(t); w.stop(t + 0.55);
      }
      // Deep pop
      const o = actx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(150, t + (big ? 0.42 : 0));
      o.frequency.exponentialRampToValueAtTime(42, t + (big ? 0.7 : 0.28));
      const g = actx.createGain();
      g.gain.setValueAtTime(big ? 0.22 : 0.07, t + (big ? 0.42 : 0));
      g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 1.0 : 0.5));
      o.connect(g); g.connect(actx.destination);
      o.start(t + (big ? 0.42 : 0)); o.stop(t + (big ? 1.05 : 0.55));
      // Sparkle crackle (filtered noise decay)
      const dur = big ? 1.0 : 0.5;
      const len = Math.floor(actx.sampleRate * dur);
      const buf = actx.createBuffer(1, len, actx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      }
      const src = actx.createBufferSource();
      src.buffer = buf;
      const f = actx.createBiquadFilter();
      f.type = "bandpass"; f.frequency.value = big ? 1900 : 2600; f.Q.value = 0.8;
      const ng = actx.createGain();
      ng.gain.value = big ? 0.16 : 0.05;
      src.connect(f); f.connect(ng); ng.connect(actx.destination);
      src.start(t + (big ? 0.47 : 0.05));
    } catch (e) {}
  }

  /* Soft ignition "foom" when a diya catches light. */
  function ignite() {
    if (!actx || !playing || document.hidden) return;
    try {
      const t = actx.currentTime;
      const dur = 0.35;
      const len = Math.floor(actx.sampleRate * dur);
      const buf = actx.createBuffer(1, len, actx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const k = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * k) * 0.8;
      }
      const src = actx.createBufferSource();
      src.buffer = buf;
      const f = actx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 900;
      const g = actx.createGain();
      g.gain.value = 0.22;
      src.connect(f); f.connect(g); g.connect(actx.destination);
      src.start(t);
    } catch (e) {}
  }

  function updateBtn() {
    const t = $("#musicToggle");
    if (!t) return;
    t.classList.toggle("is-playing", playing);
    t.setAttribute("aria-pressed", playing ? "true" : "false");
    t.setAttribute("aria-label", playing ? "Mute festive music" : "Play festive music");
  }

  return {
    sfxBurst,
    ignite,
    startFromGesture() {
      if (playing || prefersReduced()) return;
      playing = true;
      updateBtn();
      ensure(); // ready the AudioContext for firework/diya sound effects
      // Prefer the festive song file; fall back to the drone if it fails.
      if (!songFailed && songEl()) {
        if (playSong()) return;
      }
      playDrone();
    },
    toggle() {
      const t = $("#musicToggle");
      if (t) t.classList.add("loading");
      const a = songEl();
      const useSong = a && !songFailed;
      try {
        if (!playing) {
          playing = true;
          ensure(); // silent context for sound effects even when the file plays
          if (useSong) {
            if (a.paused) { if (!playSong()) playDrone(); }
            else fadeSong(0.5, 800);
          } else {
            if (!ensure()) { if (t) t.classList.remove("loading"); return; }
            if (actx.state === "suspended") actx.resume();
            fadeTo(0.055, 800);
            timer = setInterval(bell, 16000);
          }
        } else {
          playing = false;
          if (useSong && a) fadeSong(0.0001, 400, () => { try { a.pause(); } catch (e) {} });
          else { fadeTo(0.0001, 400); clearInterval(timer); }
        }
      } catch (e) {}
      if (t) t.classList.remove("loading");
      updateBtn();
    },
    init() {
      const t = $("#musicToggle");
      if (t) t.addEventListener("click", () => Music.toggle());
      const a = songEl();
      if (a) {
        a.volume = 0;
        a.addEventListener("error", () => { songFailed = true; });
        try { a.load(); } catch (e) {}
      }
      document.addEventListener("visibilitychange", () => {
        try {
          if (document.hidden) {
            if (playing) {
              if (a && !a.paused && !songFailed) { fadeSong(0.0001, 300, () => { try { a.pause(); } catch (e) {} }); }
              else if (actx && actx.state === "running") actx.suspend();
            }
          } else if (playing) {
            if (a && !songFailed) {
              if (a.paused) playSong();
            } else if (actx && actx.state === "suspended") actx.resume();
          }
        } catch (e) {}
      });
      updateBtn();
    }
  };
})();

/* ───────── Manual firework button + tap anywhere ───────── */
function initBurstButton() {
  const btn = $("#burstBtn");
  if (btn) {
    btn.addEventListener("click", (e) => {
      const r = btn.getBoundingClientRect();
      Sky.manual(r.left + r.width / 2, Math.max(80, r.top - 60));
      btn.animate(
        [{ transform: "scale(1)" }, { transform: "scale(.94)" }, { transform: "scale(1)" }],
        { duration: 320, easing: "cubic-bezier(.22,.9,.3,1)" }
      );
    });
  }
  // Celebration tap: launch a small burst where the user taps the hero (not on links/buttons)
  const hero = $(".hero");
  if (hero && !prefersReduced()) {
    let lastTap = 0;
    hero.addEventListener("pointerdown", (e) => {
      if (e.target.closest("a,button")) return;
      // Ignore the start of a scroll gesture on touch
      if (e.pointerType !== "mouse") {
        const now = performance.now();
        if (now - lastTap < 600) return;
        lastTap = now;
      }
      Sky.manual(e.clientX, e.clientY);
    }, { passive: true });
  }
}

/* ───────── LIGHT-A-DIYA GAME ─────────
   Tap the lighter to arm its flame, then tap a diya to light it.
   Fully button-based: works with touch, mouse and keyboard. */
function initDiyaGame() {
  const lighter = $("#lighter");
  const hint = $("#diyaHint");
  const count = $("#diyaCount");
  const diyas = Array.from(document.querySelectorAll(".diya-btn"));
  if (!lighter || !diyas.length) return;

  let armed = false;
  let lit = 0;
  const total = diyas.length;

  function setHint(msg) { if (hint) hint.textContent = msg; }

  lighter.addEventListener("click", () => {
    if (lit >= total) return;
    armed = !armed;
    lighter.classList.toggle("is-armed", armed);
    lighter.setAttribute("aria-pressed", armed ? "true" : "false");
    lighter.setAttribute("aria-label", armed ? "Lighter flame ready — now tap a diya" : "Pick up the lighter flame");
    setHint(armed
      ? "Flame ready — now tap any unlit diya."
      : "Step 1 — tap the lighter to pick up its flame. Step 2 — tap a diya to light it.");
  });

  diyas.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("lit")) return;
      if (!armed) {
        // Nudge: the flame must come from the lighter first
        if (!prefersReduced()) {
          btn.classList.remove("deny");
          void btn.offsetWidth;
          btn.classList.add("deny");
          setTimeout(() => btn.classList.remove("deny"), 450);
        }
        setHint("Pick up the lighter flame first, then tap a diya.");
        return;
      }
      // Light it!
      armed = false;
      lighter.classList.remove("is-armed");
      lighter.setAttribute("aria-pressed", "false");
      lighter.setAttribute("aria-label", "Pick up the lighter flame");
      btn.classList.add("lit");
      btn.setAttribute("aria-label", "Diya " + (btn.dataset.diya || "") + " is lit. Shubh Deepavali!");
      lit++;
      if (count) count.textContent = lit + " of " + total + (total === 1 ? " diya lit" : " diyas lit");

      // Ignition crackle + a firework blooming above the diya
      try { if (typeof Music !== "undefined" && Music.ignite) Music.ignite(); } catch (e) {}
      const r = btn.getBoundingClientRect();
      Sky.manual(r.left + r.width / 2, Math.max(70, r.top - 40));

      if (lit >= total) {
        setHint("All diyas are glowing — Shubh Deepavali! Thank you for lighting them.");
        try { lighter.disabled = true; } catch (e) {}
        // Grand finale volley
        if (!prefersReduced()) {
          setTimeout(() => Sky.burst(window.innerWidth * 0.25, window.innerHeight * 0.3, 90, false), 400);
          setTimeout(() => Sky.burst(window.innerWidth * 0.75, window.innerHeight * 0.3, 90, false), 800);
          setTimeout(() => Sky.burst(window.innerWidth * 0.5, window.innerHeight * 0.22, 120, false), 1200);
        }
      } else {
        setHint("Beautiful! " + (total - lit) + " more to go — tap the lighter again.");
      }
    });
  });
}

/* ───────── BOOT ───────── */
document.addEventListener("DOMContentLoaded", () => {
  Sky.init();
  initIntro();
  initReveals();
  initCountdown();
  initCalendar();
  Music.init();
  initBurstButton();
  initDiyaGame();
});
