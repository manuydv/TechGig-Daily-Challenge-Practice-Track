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

  /* ---------------- Enquiry form prefill helper ---------------- */
  const interestSelect = document.getElementById("interest");
  const messageField = document.getElementById("message");
  function prefillEnquiry(collection, message) {
    if (interestSelect) {
      [...interestSelect.options].forEach((opt) => {
        if (opt.value === collection || opt.textContent === collection) {
          interestSelect.value = opt.value;
        }
      });
    }
    if (messageField) messageField.value = message;
  }
  function goToContact() {
    document.getElementById("contact")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }

  /* ---------------- Product lightbox ---------------- */
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightboxImg");
  const lightboxEyebrow = document.getElementById("lightboxEyebrow");
  const lightboxTitle = document.getElementById("lightboxTitle");
  const lightboxDesc = document.getElementById("lightboxDesc");
  const lightboxMeta = document.getElementById("lightboxMeta");
  const lightboxPrice = document.getElementById("lightboxPrice");
  const lightboxThumbs = document.getElementById("lightboxThumbs");
  const lightboxCta = document.getElementById("lightboxCta");
  const lightboxPrev = document.getElementById("lightboxPrev");
  const lightboxNext = document.getElementById("lightboxNext");
  const lightboxClose = document.getElementById("lightboxClose");

  const lightboxMedia = document.querySelector(".lightbox-media");
  let lbImages = [];
  let lbIndex = 0;
  let lastFocused = null;

  function getImageBgColor(imgEl) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      // sample a corner pixel — a couple px in to avoid any edge/compression noise
      ctx.drawImage(imgEl, 2, 2, 1, 1, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return `rgb(${r}, ${g}, ${b})`;
    } catch (e) {
      return "";
    }
  }

  function sampleImageBackground(imgEl) {
    lightboxMedia.style.backgroundColor = getImageBgColor(imgEl);
  }

  // Match each Signature Piece photo box's background to its own image's
  // backdrop, instead of a flat gray — the box's aspect ratio doesn't always
  // match the photo's, so any mismatch would otherwise show as a visible
  // border around the (never-cropped) product photo.
  // Also shape each box to its own photo's exact aspect ratio — the fixed
  // 4:5 box otherwise leaves a left/right gap for any photo that isn't
  // exactly that ratio (all of these product shots are closer to 2:3), no
  // matter how well the background color is matched.
  document.querySelectorAll(".piece-photo").forEach((box) => {
    const img = box.querySelector("img");
    if (!img) return;
    const apply = () => {
      box.style.backgroundColor = getImageBgColor(img);
      if (img.naturalWidth && img.naturalHeight) {
        box.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
      }
    };
    if (img.complete && img.naturalWidth) apply();
    else img.addEventListener("load", apply, { once: true });
  });

  function renderLightboxImage() {
    const img = lbImages[lbIndex];
    lightboxImg.alt = img.alt || "";
    lightboxImg.onload = () => sampleImageBackground(lightboxImg);
    lightboxImg.src = img.src;
    if (lightboxImg.complete && lightboxImg.naturalWidth) sampleImageBackground(lightboxImg);
    lightboxThumbs.querySelectorAll(".lightbox-thumb").forEach((t, i) => {
      t.classList.toggle("is-active", i === lbIndex);
    });
    const multi = lbImages.length > 1;
    lightboxPrev.hidden = !multi;
    lightboxNext.hidden = !multi;
  }

  function openLightbox({ images, eyebrow, title, desc, meta, price, ctaText, onCta }) {
    lbImages = images;
    lbIndex = 0;
    lightboxEyebrow.textContent = eyebrow || "";
    lightboxTitle.textContent = title || "";
    lightboxDesc.textContent = desc || "";
    lightboxMeta.textContent = meta || "";
    lightboxPrice.textContent = price || "";
    lightboxThumbs.innerHTML = "";
    if (images.length > 1) {
      images.forEach((img, i) => {
        const b = document.createElement("button");
        b.className = "lightbox-thumb";
        b.innerHTML = `<img src="${img.src}" alt="" />`;
        b.addEventListener("click", () => { lbIndex = i; renderLightboxImage(); });
        lightboxThumbs.appendChild(b);
      });
    }
    lightboxCta.textContent = ctaText || "";
    lightboxCta.onclick = () => { closeLightbox(); onCta && onCta(); };
    renderLightboxImage();
    lastFocused = document.activeElement;
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    lightboxClose.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    lastFocused && lastFocused.focus();
  }

  lightboxClose.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });
  lightboxPrev.addEventListener("click", () => { lbIndex = (lbIndex - 1 + lbImages.length) % lbImages.length; renderLightboxImage(); });
  lightboxNext.addEventListener("click", () => { lbIndex = (lbIndex + 1) % lbImages.length; renderLightboxImage(); });
  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("is-open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") lightboxPrev.click();
    if (e.key === "ArrowRight") lightboxNext.click();
  });

  /* ---------------- Signature piece cards → zoomed detail lightbox ---------------- */
  document.querySelectorAll(".piece-card").forEach((card) => {
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    const open = () => {
      const img = card.querySelector(".piece-photo img");
      const tag = card.querySelector(".piece-tag")?.textContent || "";
      const title = card.querySelector("h3")?.textContent || "";
      const desc = card.querySelector("p")?.textContent || "";
      const meta = card.querySelector(".piece-meta")?.textContent || "";
      const price = card.querySelector(".piece-price")?.textContent || "";
      const collection = card.dataset.collection || "Women's Collection";
      openLightbox({
        images: [{ src: img.src, alt: img.alt }],
        eyebrow: `Signature Piece — ${tag}`,
        title, desc, meta, price,
        ctaText: "Enquire About This Piece",
        onCta: () => {
          prefillEnquiry(collection, `I'm interested in the ${title} (Signature Piece).`);
          goToContact();
        },
      });
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });

  /* ---------------- Our Range cards → gallery lightbox / enquiry prefill ---------------- */
  document.querySelectorAll(".card-link-wrap").forEach((link) => {
    link.addEventListener("click", (e) => {
      const category = link.dataset.category;
      const collection = link.dataset.collection;
      const photoBox = link.querySelector(".card-photo");
      if (photoBox) {
        e.preventDefault();
        const images = [...photoBox.querySelectorAll("img")].map((img) => ({ src: img.src, alt: img.alt }));
        const desc = link.querySelector("p")?.textContent || "";
        openLightbox({
          images,
          eyebrow: collection,
          title: category,
          desc,
          meta: images.length > 1 ? `${images.length} photos in this range` : "",
          price: "",
          ctaText: "Enquire About This Range",
          onCta: () => {
            prefillEnquiry(collection, `I'd like more information on the ${category} range.`);
            goToContact();
          },
        });
        return;
      }
      // no photos yet for this category — fall back to jumping straight to the enquiry form
      prefillEnquiry(collection, `I'd like more information on the ${category} range.`);
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

  /* ---------------- Hero background parallax on mouse ---------------- */
  if (!isTouch && !reduceMotion) {
    const heroSlideshow = document.querySelector(".hero-slideshow");
    document.querySelector(".hero")?.addEventListener("mousemove", (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 14;
      const y = (e.clientY / window.innerHeight - 0.5) * 14;
      if (heroSlideshow) heroSlideshow.style.transform = `scale(1.04) translate(${x}px, ${y}px)`;
    });
  }

  /* ---------------- Hero background slideshow (3 columns, staggered crossfade) ---------------- */
  // Shuffle each column's slide order on load so bags and jackets mix
  // randomly instead of always opening in the same fixed sequence.
  document.querySelectorAll(".hero-slideshow-col").forEach((col) => {
    const slides = [...col.querySelectorAll(".hero-slideshow-slide")];
    for (let i = slides.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slides[i], slides[j]] = [slides[j], slides[i]];
    }
    slides.forEach((s) => { s.classList.remove("is-active"); col.appendChild(s); });
    slides[0].classList.add("is-active");
  });

  document.querySelectorAll(".hero-slideshow-col").forEach((col, colIndex) => {
    const slides = col.querySelectorAll(".hero-slideshow-slide");
    if (slides.length < 2 || reduceMotion) return;
    let current = 0;
    setTimeout(() => {
      setInterval(() => {
        slides[current].classList.remove("is-active");
        current = (current + 1) % slides.length;
        slides[current].classList.add("is-active");
      }, 6000);
    }, colIndex * 1600);
  });

  /* ---------------- Our Range category photo cards (staggered crossfade) ---------------- */
  document.querySelectorAll(".card-photo").forEach((photo, i) => {
    const slides = photo.querySelectorAll(".card-photo-slide");
    if (slides.length < 2 || reduceMotion) return;
    let current = 0;
    setTimeout(() => {
      setInterval(() => {
        slides[current].classList.remove("is-active");
        current = (current + 1) % slides.length;
        slides[current].classList.add("is-active");
      }, 3400);
    }, i * 500);
  });

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
