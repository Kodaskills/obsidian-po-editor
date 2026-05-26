(function () {
  // MSGSTR language cycling
  var phrases = [
    { text: "Hello, world!", lang: "en" },
    { text: "Bonjour, monde !", lang: "fr" },
    { text: "\xA1Hola, mundo!", lang: "es" },
    { text: "こんにちは、世界！", lang: "ja" },
    { text: "你好，世界！", lang: "zh" },
    { text: "مرحبا، يا عالم!", lang: "ar", rtl: true },
    { text: "नमस्ते दुनिया!", lang: "hi" },
    { text: "Hallo, Welt!", lang: "de" },
  ];
  var phraseIdx = 0;
  var rightBox = document.getElementById("v1-right-box");
  var rightLang = document.getElementById("v1-right-lang");
  var rightText = document.getElementById("v1-right-text");
  if (rightBox && rightLang && rightText) {
    setInterval(function () {
      phraseIdx = (phraseIdx + 1) % phrases.length;
      var next = phrases[phraseIdx];
      rightBox.classList.add("is-fading");
      setTimeout(function () {
        rightLang.textContent = "MSGSTR \xB7 " + next.lang.toUpperCase();
        rightText.textContent = "“" + next.text + "”";
        rightBox.dataset.dir = next.rtl ? "rtl" : "ltr";
        rightBox.classList.remove("is-fading");
      }, 300);
    }, 2500);
  }

  // Theme switching
  var themeBtns = document.querySelectorAll("[data-theme-btn]");
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    themeBtns.forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.themeBtn === t);
    });
  }
  themeBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setTheme(btn.dataset.themeBtn);
    });
  });

  // Marquee duplication for seamless loop
  var marquee = document.getElementById("v1-marquee-track");
  if (marquee) {
    var children = Array.from(marquee.childNodes);
    for (var i = 0; i < 2; i++) {
      children.forEach(function (node) {
        marquee.appendChild(node.cloneNode(true));
      });
    }
  }

  // Install tabs
  var tabBtns = document.querySelectorAll("[data-tab]");
  tabBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var tabIdx = btn.dataset.tab;
      tabBtns.forEach(function (b) {
        b.classList.remove("active");
      });
      document.querySelectorAll('[id^="install-tab-"]').forEach(function (p) {
        p.classList.remove("active");
      });
      btn.classList.add("active");
      var panel = document.getElementById("install-tab-" + tabIdx);
      if (panel) panel.classList.add("active");
    });
  });

  // FAQ accordion
  var faqBtns = document.querySelectorAll("[data-faq]");
  var firstAnswer = document.querySelector('[data-faq-answer="0"]');
  if (firstAnswer) {
    firstAnswer.classList.add("open");
    var firstIcon = document.querySelector('[data-faq="0"] .faq-icon');
    if (firstIcon) firstIcon.classList.add("open");
  }
  faqBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var faqIdx = btn.dataset.faq;
      var answer = document.querySelector('[data-faq-answer="' + faqIdx + '"]');
      var icon = btn.querySelector(".faq-icon");
      if (answer.classList.contains("open")) {
        answer.classList.remove("open");
        if (icon) icon.classList.remove("open");
      } else {
        answer.classList.add("open");
        if (icon) icon.classList.add("open");
      }
    });
  });

  // Nav shadow on scroll
  var navSticky = document.querySelector(".nav-sticky");
  if (navSticky) {
    window.addEventListener(
      "scroll",
      function () {
        navSticky.classList.toggle("is-scrolled", window.scrollY > 40);
      },
      { passive: true },
    );
  }

  // Scroll reveal
  var STAGGER = [
    { sel: ".features-grid > .feat-card", d: 65 },
    { sel: ".steps-grid > .step-row", d: 80 },
    { sel: ".formats-grid > .format-item, .formats-grid > .format-item-featured", d: 45 },
    { sel: ".roadmap-item", d: 90 },
    { sel: ".faq-list > .faq-item", d: 50 },
  ];
  STAGGER.forEach(function (g) {
    document.querySelectorAll(g.sel).forEach(function (el, i) {
      el.dataset.reveal = "";
      el.style.setProperty("--reveal-delay", Math.min(i * g.d, 450) + "ms");
    });
  });
  var SINGLES =
    ".section-header, .obsidian-window, .two-col, .steps-header, .install-header, .tab-bar, .roadmap, .cta-inner";
  document.querySelectorAll(SINGLES).forEach(function (el) {
    if (!("reveal" in el.dataset)) el.dataset.reveal = "";
  });
  if ("IntersectionObserver" in window) {
    var revObs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            revObs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.07, rootMargin: "0px 0px -30px 0px" },
    );
    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight) {
        el.classList.add("is-visible");
      } else {
        revObs.observe(el);
      }
    });
  } else {
    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      el.classList.add("is-visible");
    });
  }
})();
