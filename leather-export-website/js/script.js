/* ==========================================================================
   ZOVARO — interactions
   ========================================================================== */
(() => {
  "use strict";

  const html = document.documentElement;
  const isTouch = matchMedia("(hover: none), (pointer: coarse)").matches;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- Preloader ---------------- */
  const preloader = document.getElementById("preloader");
  const preloadCount = document.getElementById("preloadCount");
  const preloadBar = document.getElementById("preloadBar");

  function runPreloader() {
    let n = 0;
    const done = () => {
      preloader.classList.add("is-done");
      html.classList.add("is-ready");
      playHeroIntro();
      setTimeout(() => preloader.remove(), 900);
    };
    if (reduceMotion) return done();
    const timer = setInterval(() => {
      n += Math.random() * 18 + 6;
      if (n >= 100) {
        n = 100;
        clearInterval(timer);
        preloadCount.textContent = "100";
        preloadBar.style.width = "100%";
        setTimeout(done, 350);
        return;
      }
      preloadCount.textContent = Math.floor(n);
      preloadBar.style.width = n + "%";
    }, 140);
  }

  /* ---------------- Hero intro ---------------- */
  function playHeroIntro() {
    document.querySelectorAll(".hero-title .word").forEach((el, i) => {
      el.style.transition = `transform .95s cubic-bezier(.22,1,.36,1) ${i * 0.12 + 0.1}s`;
      requestAnimationFrame(() => (el.style.transform = "translateY(0)"));
    });
    document.querySelectorAll("#hero [data-reveal]").forEach((el, i) => {
      setTimeout(() => el.classList.add("is-visible"), 500 + i * 130);
    });
  }

  /* ---------------- Custom cursor ---------------- */
  if (!isTouch) {
    const dot = document.getElementById("cursorDot");
    const ring = document.getElementById("cursorRing");
    const cursor = document.getElementById("cursor");
    let mx = 0, my = 0, rx = 0, ry = 0;

    window.addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.left = mx + "px"; dot.style.top = my + "px";
    });

    (function loop() {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      ring.style.left = rx + "px"; ring.style.top = ry + "px";
      requestAnimationFrame(loop);
    })();

    document.querySelectorAll("[data-hover]").forEach((el) => {
      el.addEventListener("mouseenter", () => cursor.classList.add("is-active"));
      el.addEventListener("mouseleave", () => cursor.classList.remove("is-active"));
    });
  }

  /* ---------------- Magnetic buttons ---------------- */
  if (!isTouch && !reduceMotion) {
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
      });
      el.addEventListener("mouseleave", () => (el.style.transform = ""));
    });
  }

  /* ---------------- Nav scroll + mobile toggle ---------------- */
  const nav = document.getElementById("siteNav");
  const navToggle = document.getElementById("navToggle");

  window.addEventListener("scroll", () => {
    nav.classList.toggle("is-scrolled", window.scrollY > 40);
  }, { passive: true });

  navToggle.addEventListener("click", () => {
    nav.classList.toggle("is-open");
  });
  document.querySelectorAll(".nav-links a").forEach((a) =>
    a.addEventListener("click", () => nav.classList.remove("is-open"))
  );

  /* ---------------- Scroll reveal ---------------- */
  const revealEls = document.querySelectorAll("[data-reveal], [data-reveal-clip]");
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  );
  revealEls.forEach((el) => {
    if (el.closest("#hero")) return; // hero handled by preloader intro
    io.observe(el);
  });

  // stagger index for grids
  document.querySelectorAll(".cards-grid").forEach((grid) => {
    [...grid.children].forEach((c, i) => c.style.setProperty("--i", i % 4));
  });
  document.querySelectorAll(".process").forEach((grid) => {
    [...grid.children].forEach((c, i) => c.style.setProperty("--i", i));
  });

  /* ---------------- Count-up stats ---------------- */
  const stats = document.querySelectorAll(".stat-num");
  const statsIo = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.dataset.count, 10);
        const dur = 1400;
        const start = performance.now();
        function tick(now) {
          const p = Math.min((now - start) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.floor(eased * target);
          if (p < 1) requestAnimationFrame(tick);
          else el.textContent = target;
        }
        requestAnimationFrame(tick);
        statsIo.unobserve(el);
      });
    },
    { threshold: 0.6 }
  );
  stats.forEach((el) => statsIo.observe(el));

  /* ---------------- Collection tabs ---------------- */
  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".tab-panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("is-active"));
      panels.forEach((p) => p.classList.remove("is-active"));
      tab.classList.add("is-active");
      const panel = document.querySelector(`[data-panel="${tab.dataset.tab}"]`);
      panel.classList.add("is-active");
      // reveal newly shown cards
      panel.querySelectorAll("[data-reveal]").forEach((el, i) => {
        el.classList.remove("is-visible");
        setTimeout(() => el.classList.add("is-visible"), i * 60);
      });
    });
  });

  /* ---------------- Card 3D tilt ---------------- */
  if (!isTouch && !reduceMotion) {
    document.querySelectorAll("[data-tilt]").forEach((card) => {
      card.addEventListener("mousemove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(700px) rotateX(${-py * 8}deg) rotateY(${px * 8}deg) translateY(-4px)`;
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "";
      });
    });
  }

  /* ---------------- Testimonial slider ---------------- */
  const slides = document.querySelectorAll(".slide");
  const dotsWrap = document.getElementById("sliderDots");
  let current = 0, sliderTimer;

  slides.forEach((_, i) => {
    const b = document.createElement("button");
    if (i === 0) b.classList.add("is-active");
    b.addEventListener("click", () => goToSlide(i));
    dotsWrap.appendChild(b);
  });
  const dots = dotsWrap.querySelectorAll("button");

  function goToSlide(i) {
    slides[current].classList.remove("is-active");
    dots[current].classList.remove("is-active");
    current = i;
    slides[current].classList.add("is-active");
    dots[current].classList.add("is-active");
  }
  function nextSlide() { goToSlide((current + 1) % slides.length); }
  function startSlider() {
    if (reduceMotion) return;
    sliderTimer = setInterval(nextSlide, 5200);
  }
  startSlider();
  document.getElementById("slider").addEventListener("mouseenter", () => clearInterval(sliderTimer));
  document.getElementById("slider").addEventListener("mouseleave", startSlider);

  /* ---------------- Hero parallax on mouse ---------------- */
  if (!isTouch && !reduceMotion) {
    const heroBag = document.querySelector(".hero-showcase");
    document.querySelector(".hero")?.addEventListener("mousemove", (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 26;
      const y = (e.clientY / window.innerHeight - 0.5) * 26;
      if (heroBag) heroBag.style.transform = `translate(${x}px, ${y}px)`;
    });
  }

  /* ---------------- Hero rotating showcase (3 signature bags) ---------------- */
  const heroSlides = document.querySelectorAll(".hero-slide");
  const heroDotsWrap = document.getElementById("heroShowcaseDots");
  if (heroSlides.length && heroDotsWrap) {
    let heroCurrent = 0, heroTimer;
    heroSlides.forEach((_, i) => {
      const dot = document.createElement("span");
      if (i === 0) dot.classList.add("is-active");
      heroDotsWrap.appendChild(dot);
    });
    const heroDots = heroDotsWrap.querySelectorAll("span");
    function goToHeroSlide(i) {
      heroSlides[heroCurrent].classList.remove("is-active");
      heroDots[heroCurrent].classList.remove("is-active");
      heroCurrent = i;
      heroSlides[heroCurrent].classList.add("is-active");
      heroDots[heroCurrent].classList.add("is-active");
    }
    function nextHeroSlide() { goToHeroSlide((heroCurrent + 1) % heroSlides.length); }
    function startHeroSlider() {
      if (reduceMotion) return;
      heroTimer = setInterval(nextHeroSlide, 3200);
    }
    startHeroSlider();
    const heroShowcaseEl = document.getElementById("heroShowcase");
    heroShowcaseEl?.addEventListener("mouseenter", () => clearInterval(heroTimer));
    heroShowcaseEl?.addEventListener("mouseleave", startHeroSlider);
  }

  /* ---------------- Contact form (client-side demo submit) ---------------- */
  const form = document.getElementById("contactForm");
  const formNote = document.getElementById("formNote");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    formNote.textContent = "Thank you — your enquiry has been noted. Our export desk will reply within one business day.";
    formNote.style.color = "var(--tan)";
    form.reset();
  });

  const newsForm = document.getElementById("newsForm");
  newsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = newsForm.querySelector("input");
    input.value = "Subscribed ✦";
    setTimeout(() => (input.value = ""), 2200);
  });

  /* ---------------- Footer year ---------------- */
  document.getElementById("year").textContent = new Date().getFullYear();

  /* ---------------- Boot ---------------- */
  let booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    runPreloader();
  }
  window.addEventListener("load", boot);
  if (document.readyState === "complete") boot();
})();
