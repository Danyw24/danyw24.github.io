/* Vistas, intro y terminal movida por scroll.
   Sin este archivo el sitio funciona igual: vista HR y terminal estática por #terminal. */
(function () {
  "use strict";
  var html = document.documentElement;
  var BASE = document.currentScript.src;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) html.classList.add("anim");
  if (window.matchMedia("(pointer: coarse)").matches) html.classList.add("coarse");

  var intro = document.getElementById("intro");
  var canvas = document.getElementById("scene");
  var screen = document.getElementById("screen");
  var inner = document.getElementById("screen-inner");
  var spacer = document.getElementById("scroll-spacer");
  var blocks = Array.prototype.slice.call(document.querySelectorAll(".blk"));
  var ctrl = null, framed = false, termReady = false, busy = false;

  function store(v) { try { localStorage.setItem("view", v); } catch (e) {} }
  function canFrame() { return window.innerWidth >= 900 && window.innerHeight >= 560; }
  function webgl() {
    try { var c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); }
    catch (e) { return false; }
  }
  function loadIntro() {
    if (ctrl) return Promise.resolve(ctrl);
    return import(new URL("intro.min.js", BASE).href).then(function (m) {
      ctrl = m.createScene(canvas, { reduce: reduce });
      ctrl.onChoose = choose;
      return ctrl;
    });
  }
  function dropIntro() {
    if (ctrl) { ctrl.dispose(); ctrl = null; }
  }
  function cleanHash() {
    if (location.hash) location.hash = "hr";
    history.replaceState(null, "", location.pathname);
  }

  /* ---------- cambiar de vista ---------- */
  function showHR() {
    framed = false;
    html.classList.remove("framed");
    screen.classList.remove("off", "boot");
    html.setAttribute("data-view", "hr");
    cleanHash();
    store("hr");
    window.scrollTo(0, 0);
    dropIntro();
  }

  function enterTerminal(fromIntro) {
    store("terminal");
    var wantFrame = canFrame() && webgl();
    if (wantFrame) {
      framed = true;
      screen.style.visibility = "hidden";
      html.classList.add("framed");
      html.setAttribute("data-view", "terminal");
      return loadIntro().then(function (c) {
        return c.goFront({ instant: !fromIntro });
      }).then(function () {
        initTerminal();
        layoutFramed();
        screen.style.visibility = "";
        screen.classList.remove("off");
        screen.classList.add("boot");
        window.scrollTo(0, 0);
        update();
      }).catch(function () { flowTerminal(); });
    }
    var go = (fromIntro && ctrl && !reduce) ? ctrl.goInto() : Promise.resolve();
    return go.then(flowTerminal);
  }

  function flowTerminal() {
    framed = false;
    html.classList.remove("framed");
    html.setAttribute("data-view", "terminal");
    screen.style.visibility = "";
    inner.style.transform = "";
    ["--sx", "--sy", "--sw", "--sh", "--fs"].forEach(function (k) { html.style.removeProperty(k); });
    dropIntro();
    initTerminal();
    window.scrollTo(0, 0);
    update();
  }

  function choose(v) {
    if (busy) return;
    var view = html.getAttribute("data-view");
    if (view === "ask" && ctrl) {
      busy = true;
      if (v === "hr") {
        ctrl.sayHR();
        setTimeout(function () { intro.classList.add("to-hr"); }, 350);
        setTimeout(function () {
          showHR();
          intro.classList.remove("to-hr", "asking");
          busy = false;
        }, 950);
      } else {
        intro.classList.remove("asking");
        enterTerminal(true).then(function () { busy = false; });
      }
      return;
    }
    if (v === "hr") showHR();
    else { busy = true; enterTerminal(false).then(function () { busy = false; }); }
  }

  /* ---------- la pregunta ---------- */
  function startAsk() {
    if (!webgl()) { html.classList.add("no-webgl"); focusAsk(); return; }
    loadIntro().then(function (c) {
      return c.boot();
    }).then(function () {
      intro.classList.add("asking");
    }).catch(function () {
      html.classList.add("no-webgl");
      focusAsk();
    });
  }
  function focusAsk() {
    var b = document.querySelector("#ask button");
    if (b) b.focus();
  }

  document.addEventListener("keydown", function (e) {
    if (html.getAttribute("data-view") !== "ask" || e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key.toLowerCase();
    if (k === "y" || k === "enter") { e.preventDefault(); choose("hr"); }
    else if (k === "n") { e.preventDefault(); choose("terminal"); }
  });
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-choose]");
    if (a) { e.preventDefault(); choose(a.getAttribute("data-choose")); return; }
    var g = e.target.closest("[data-go]");
    if (g) { e.preventDefault(); goSection(g.getAttribute("data-go")); return; }
    var t = e.target.closest(".tape-btn");
    if (t) { e.preventDefault(); playTape(t.parentNode); }
  });

  /* ---------- terminal ---------- */
  function initTerminal() {
    if (termReady) return;
    termReady = true;
    blocks.forEach(function (b) {
      var t = b.querySelector(".typed");
      b._full = t ? t.textContent : "";
      var kids = b.querySelectorAll(".out > *");
      for (var i = 0; i < kids.length; i++) kids[i].style.setProperty("--i", i);
      var oks = b.querySelectorAll(".ok, .blank span:last-child");
      for (var j = 0; j < oks.length; j++) oks[j].style.setProperty("--i", j);
    });
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", onResize);
  }

  function visibleH() {
    var bar = screen.querySelector(".statusbar");
    return (framed ? screen.clientHeight : window.innerHeight) - (bar ? bar.offsetHeight : 0);
  }

  function layoutFramed() {
    if (!ctrl) return;
    ctrl.resize();
    var r = ctrl.screenRect();
    var s = html.style;
    s.setProperty("--sx", r.x + "px");
    s.setProperty("--sy", r.y + "px");
    s.setProperty("--sw", r.w + "px");
    s.setProperty("--sh", r.h + "px");
    s.setProperty("--fs", Math.max(15, Math.min(26, r.h / 21)).toFixed(1) + "px");
    var extra = Math.max(0, inner.scrollHeight - visibleH() + 24);
    spacer.style.height = (window.innerHeight + extra) + "px";
  }

  var rt = 0;
  function onResize() {
    clearTimeout(rt);
    rt = setTimeout(function () {
      if (html.getAttribute("data-view") !== "terminal") return;
      if (framed && !canFrame()) { flowTerminal(); return; }
      if (framed) layoutFramed();
      update();
    }, 120);
  }

  function blockTop(b) {
    return framed ? b.offsetTop : b.getBoundingClientRect().top + window.scrollY;
  }

  function update() {
    if (html.getAttribute("data-view") !== "terminal") return;
    var y = window.scrollY, vh = visibleH();
    if (framed) inner.style.transform = "translateY(" + (-y) + "px)";
    var line = framed ? y + vh * 0.9 : y + window.innerHeight * 0.88;
    var lastActive = null;
    blocks.forEach(function (b) {
      var top = blockTop(b);
      if (top < line) {
        if (!b._on) activate(b, top < line - vh * 0.6);
        lastActive = b;
      } else if (b._on && top > line + 40) {
        reset(b);
      }
    });
    blocks.forEach(function (b) { b.classList.toggle("current", b === lastActive); });
    markSection(y + vh * 0.3);
  }

  function activate(b, instant) {
    b._on = true;
    b.classList.add("active");
    var t = b.querySelector(".typed");
    if (!html.classList.contains("anim") || instant || !t) { if (t) t.textContent = b._full; return show(b); }
    b.classList.add("typing");
    t.textContent = "";
    var i = 0, full = b._full;
    b._timer = setInterval(function () {
      i++;
      t.textContent = full.slice(0, i);
      if (i >= full.length) {
        clearInterval(b._timer);
        b._timer = setTimeout(function () { b.classList.remove("typing"); show(b); }, 140);
      }
    }, Math.max(14, Math.min(40, 700 / full.length)));
  }

  function show(b) {
    b.classList.add("shown");
    var cs = b.querySelectorAll("[data-count]");
    for (var i = 0; i < cs.length; i++) countUp(cs[i]);
    if (b.classList.contains("last") && framed && html.classList.contains("anim")) {
      b._off = setTimeout(function () { screen.classList.remove("boot"); screen.classList.add("off"); }, 900);
    }
  }

  function reset(b) {
    b._on = false;
    clearInterval(b._timer); clearTimeout(b._timer); clearTimeout(b._off);
    b.classList.remove("active", "typing", "shown");
    var t = b.querySelector(".typed");
    if (t) t.textContent = b._full;
    if (b.classList.contains("last") && screen.classList.contains("off")) {
      screen.classList.remove("off");
      screen.classList.add("boot");
    }
  }

  function countUp(el) {
    var n = +el.getAttribute("data-count");
    if (!html.classList.contains("anim")) { el.textContent = n; return; }
    var t0 = performance.now(), dur = 900;
    (function step(now) {
      var p = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(n * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  var links = Array.prototype.slice.call(document.querySelectorAll("[data-go]"));
  function markSection(pos) {
    var cur = blocks[0].getAttribute("data-sec");
    blocks.forEach(function (b) { if (blockTop(b) <= pos) cur = b.getAttribute("data-sec"); });
    links.forEach(function (a) { a.classList.toggle("cur", a.getAttribute("data-go") === cur); });
  }

  function goSection(sec) {
    var b = document.querySelector('.blk[data-sec="' + sec + '"]');
    if (!b) return;
    var top = framed ? b.offsetTop - 12 : blockTop(b) - 56;
    window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
  }

  function playTape(box) {
    var id = box.getAttribute("data-yt");
    var f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0";
    f.title = "blueXploit demo";
    f.allow = "autoplay; encrypted-media; picture-in-picture";
    f.allowFullscreen = true;
    box.innerHTML = "";
    box.appendChild(f);
  }

  /* ---------- arranque ---------- */
  var view = html.getAttribute("data-view");
  if (view === "ask") startAsk();
  else if (view === "terminal") enterTerminal(false);
})();
