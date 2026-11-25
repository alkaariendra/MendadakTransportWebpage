// ── Hero CTA: smooth mobile scroll + focus to quick-check form ────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-scroll-target]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const target = document.getElementById(el.dataset.scrollTarget);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        const first = target.querySelector('select, input, button');
        if (first) first.focus({ preventScroll: true });
      }, 450);
      window.mtTrackEvent?.('cta_click', { cta_type: 'hero_quick_check', cta_label: 'Cek Harga & Ketersediaan' });
    });
  });
});

// ── WhatsApp config ─────────────────────────────────────────────────
const whatsappPrimary   = "6285923601619";
const whatsappSecondary = "6289697301342";
const defaultMessage    = "Halo Mendadak Transport, saya ingin bertanya ketersediaan transport.";
const thankYouUrl       = "/terima-kasih";
const pagePath = window.location.pathname.replace(/\.html$/, '') || "/";
const pageTitle = document.querySelector("h1")?.textContent.trim().replace(/\s+/g, " ") || "";

const getBookingPrompt = () => {
  if (/bandara|airport/i.test(pagePath + pageTitle)) return "Tanggal, jam penerbangan, jumlah penumpang, dan tujuan akhir:";
  if (/tour|paket/i.test(pagePath + pageTitle)) return "Tanggal mulai, jumlah peserta, dan paket/rute yang diminati:";
  if (pagePath !== "/" && pageTitle) return "Tanggal mulai, durasi, dan pilihan lepas kunci atau driver:";
  return "Tanggal mulai, durasi, layanan, dan area jemput:";
};

const contextualMessage = `Halo Mendadak Transport, saya ingin cek harga dan ketersediaan ${pageTitle || "layanan transport Lombok"}.\n\n${getBookingPrompt()}`;

const createWhatsAppUrl = (number, message = defaultMessage) =>
  `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;

const withBookingPrompt = (message) => {
  const base = String(message || contextualMessage).trim();
  if (/tanggal|durasi|peserta|penerbangan|area jemput|tujuan akhir/i.test(base)) return base;
  return `${base}\n\n${getBookingPrompt()}`;
};

const applyWhatsAppLink = (link, number, message = contextualMessage) => {
  if (!link) return;
  link.setAttribute("href", createWhatsAppUrl(number, withBookingPrompt(message)));
  link.setAttribute("target", "_blank");
  link.setAttribute("rel", "noopener");
};

document.querySelectorAll("[data-whatsapp-link]").forEach((l) => applyWhatsAppLink(l, whatsappPrimary, contextualMessage));
document.querySelectorAll("[data-whatsapp-link-alt]").forEach((l) => applyWhatsAppLink(l, whatsappSecondary, contextualMessage));
document.querySelectorAll("[data-whatsapp-message]").forEach((l) =>
  applyWhatsAppLink(l, whatsappPrimary, l.dataset.whatsappMessage)
);
const floatingQuickCheck = document.querySelector("#quickCheckForm") && ["/", "/index"].includes(pagePath) ? document.createElement("a") : null;
if (floatingQuickCheck) {
  floatingQuickCheck.className = "floating-quick-check";
  floatingQuickCheck.href = "#cek-harga";
  floatingQuickCheck.dataset.trackCta = "quick_check";
  floatingQuickCheck.textContent = "Cek harga";
  floatingQuickCheck.setAttribute("aria-label", "Cek harga dan ketersediaan");
}
const floatingWhatsappActions = document.createElement("div");
floatingWhatsappActions.className = "floating-whatsapp-actions";
floatingWhatsappActions.setAttribute("aria-label", "Aksi WhatsApp");
floatingWhatsappActions.innerHTML = `
  <a class="floating-whatsapp-action floating-whatsapp-action-primary" href="#kontak" aria-label="Chat utama Mendadak Transport">
    <img src="assets/icon-whatsapp.svg" alt="" />
    <strong>Chat utama</strong>
  </a>
  <a class="floating-whatsapp-action floating-whatsapp-action-secondary" href="#kontak" aria-label="Chat alternatif Mendadak Transport">
    <img src="assets/icon-whatsapp.svg" alt="" />
    <strong>Chat alternatif</strong>
  </a>
`;
document.body.appendChild(floatingWhatsappActions);
if (floatingQuickCheck) floatingWhatsappActions.prepend(floatingQuickCheck);
applyWhatsAppLink(floatingWhatsappActions.querySelector(".floating-whatsapp-action-primary"), whatsappPrimary, contextualMessage);
applyWhatsAppLink(floatingWhatsappActions.querySelector(".floating-whatsapp-action-secondary"), whatsappSecondary, contextualMessage);

// ── Hero booking utility ────────────────────────────────────────────
const quickCheckForm = document.querySelector("#quickCheckForm");
const quickCheckDate = document.querySelector("#qcDate");

if (quickCheckDate) {
  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  quickCheckDate.min = localToday;
}

let quickCheckStarted = false;
quickCheckForm?.addEventListener("focusin", () => {
  if (quickCheckStarted) return;
  quickCheckStarted = true;
  window.mtTrackEvent?.("quick_check_start", { form_name: "quick_check" });
});

quickCheckForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const service = document.querySelector("#qcService")?.value;
  const date = quickCheckDate?.value;
  const duration = document.querySelector("#qcDuration")?.value;
  const area = document.querySelector("#qcArea")?.value;

  const english = document.documentElement.lang === 'en';
  const message = [
    english ? 'Hello Mendadak Transport, I would like to check the price and availability.' : 'Halo Mendadak Transport, saya ingin cek harga dan ketersediaan.',
    '',
    `${english ? 'Service type' : 'Jenis layanan'}: ${service}`,
    `${english ? 'Start date' : 'Tanggal mulai'}: ${date}`,
    `${english ? 'Duration' : 'Durasi'}: ${duration}`,
    `${english ? 'Pick-up area' : 'Area jemput'}: ${area}`
  ].join("\n");

  window.mtTrackEvent?.("quick_check_complete", { form_name: "quick_check", service_type: service, duration, pickup_area: area });
  window.open(createWhatsAppUrl(whatsappPrimary, message), "_blank", "noopener,noreferrer");
  window.mtTrackLeadSubmitted?.("quick_check", { service_type: service, duration, pickup_area: area });
});


const yearEl = document.querySelector("#year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ── Hamburger / Mobile Nav ──────────────────────────────────────────
const hamburger  = document.getElementById("hamburger");
const mobileNav  = document.getElementById("mobileNav");
const mobileLinks = document.querySelectorAll(".mobile-nav-link");

function toggleMenu(forceOpen) {
  const isOpen = forceOpen !== undefined ? forceOpen : !hamburger.classList.contains("open");
  hamburger.classList.toggle("open", isOpen);
  hamburger.setAttribute("aria-expanded", String(isOpen));
  mobileNav.classList.toggle("open", isOpen);
  mobileNav.setAttribute("aria-hidden", String(!isOpen));
  document.body.style.overflow = isOpen ? "hidden" : "";
}

if (hamburger) hamburger.addEventListener("click", () => toggleMenu());
mobileLinks.forEach((l) => l.addEventListener("click", () => toggleMenu(false)));
document.addEventListener("click", (e) => {
  if (mobileNav?.classList.contains("open") &&
      !mobileNav.contains(e.target) && !hamburger.contains(e.target)) {
    toggleMenu(false);
  }
});

// ── Header scroll effect ────────────────────────────────────────────
const siteHeader = document.querySelector(".site-header");
window.addEventListener("scroll", () => {
  siteHeader?.classList.toggle("scrolled", window.scrollY > 60);
}, { passive: true });

// ── Fleet discovery search and category filter ───────────────────────
const filterBtns = document.querySelectorAll(".filter-btn");
const priceCards = document.querySelectorAll(".price-card");
const fleetSearch = document.querySelector("[data-fleet-search]");
const fleetSearchClear = document.querySelector("[data-fleet-search-clear]");
const fleetResultCount = document.querySelector("[data-fleet-result-count]");
const fleetGrid = document.querySelector(".price-grid");
const fleetEmpty = fleetGrid ? document.createElement("p") : null;
let activeFleetFilter = "all";

// Baris harga sebelumnya membuat pengunjung mengklik area statis (dead click).
// Sekarang baris harga membuka WhatsApp dengan konteks unit yang sama seperti tombol Pesan.
priceCards.forEach((card) => {
  const nameEl = card.querySelector("h3");
  const waLink = card.querySelector(".whatsapp-action");
  const priceList = card.querySelector("dl");
  if (!nameEl || !waLink || !priceList) return;

  const unit = nameEl.textContent.trim();
  priceList.classList.add("price-list-actionable");
  priceList.setAttribute("role", "link");
  priceList.setAttribute("tabindex", "0");
  priceList.setAttribute("aria-label", `Pesan ${unit} via WhatsApp`);

  const openUnitWhatsApp = (event) => {
    if (event) event.preventDefault();
    const message = waLink.dataset.whatsappMessage
      || `Halo Mendadak Transport, saya ingin cek ketersediaan ${unit}.`;
    window.mtTrackEvent?.("pricelist_click", { car_model: unit, action: "whatsapp" });
    window.open(createWhatsAppUrl(whatsappPrimary, message), "_blank", "noopener,noreferrer");
  };

  priceList.addEventListener("click", openUnitWhatsApp);
  priceList.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      openUnitWhatsApp(event);
    }
  });
});

if (fleetEmpty) {
  fleetEmpty.className = "fleet-empty-state";
  fleetEmpty.textContent = "Belum ada unit yang cocok. Coba kata kunci atau kategori lain.";
  fleetEmpty.hidden = true;
  fleetGrid.insertAdjacentElement("afterend", fleetEmpty);
}

const updateFleetResults = () => {
  const query = (fleetSearch?.value || "").trim().toLowerCase();
  let visibleCount = 0;

  priceCards.forEach((card) => {
    const searchableText = card.textContent.toLowerCase();
    const matchesCategory = activeFleetFilter === "all" || card.dataset.category === activeFleetFilter;
    const matchesQuery = !query || searchableText.includes(query);
    const visible = matchesCategory && matchesQuery;
    card.style.display = visible ? "" : "none";
    card.setAttribute("aria-hidden", String(!visible));
    if (visible) visibleCount += 1;
  });

  if (fleetResultCount) {
    fleetResultCount.textContent = `${visibleCount} unit${visibleCount === 1 ? "" : " tersedia"}`;
  }
  if (fleetSearchClear) fleetSearchClear.hidden = !query;
  if (fleetEmpty) fleetEmpty.hidden = visibleCount > 0;
};

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeFleetFilter = btn.dataset.filter;
    updateFleetResults();
    window.mtTrackEvent?.("fleet_filter", { filter_name: activeFleetFilter, result_count: priceCards.length });
  });
});

let fleetSearchTracked = false;
fleetSearch?.addEventListener("input", () => {
  updateFleetResults();
  if (!fleetSearchTracked && fleetSearch.value.trim()) {
    fleetSearchTracked = true;
    window.mtTrackEvent?.("fleet_search", { query_present: true });
  }
});
fleetSearchClear?.addEventListener("click", () => {
  fleetSearch.value = "";
  fleetSearch.focus();
  updateFleetResults();
});

updateFleetResults();

// ── Scroll-triggered animations ─────────────────────────────────────
// Testimonial slider
const testimonialTrack = document.querySelector("[data-testimonial-track]");
const testimonialCards = testimonialTrack ? Array.from(testimonialTrack.querySelectorAll(".testimonial-card")) : [];
const testimonialPrev = document.querySelector("[data-testimonial-prev]");
const testimonialNext = document.querySelector("[data-testimonial-next]");

// Create dots dynamically before binding listeners
const dotsContainer = document.querySelector("[data-testimonial-dots]");
if (dotsContainer && testimonialCards.length) {
  testimonialCards.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.dataset.testimonialDot = i;
    dot.setAttribute("aria-label", `Testimoni ${i + 1}`);
    dotsContainer.appendChild(dot);
  });
}
const testimonialDots = Array.from(document.querySelectorAll("[data-testimonial-dot]"));

if (testimonialTrack && testimonialCards.length) {
  let testimonialTicking = false;

  const getTestimonialStep = () => {
    const cardWidth = testimonialCards[0].getBoundingClientRect().width;
    const gap = parseFloat(window.getComputedStyle(testimonialTrack).gap) || 0;
    return cardWidth + gap;
  };

  const setActiveTestimonial = (index) => {
    const safeIndex = Math.max(0, Math.min(index, testimonialCards.length - 1));
    testimonialDots.forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === safeIndex);
    });
  };

  const getActiveTestimonial = () => Math.round(testimonialTrack.scrollLeft / getTestimonialStep());

  const scrollToTestimonial = (index) => {
    const safeIndex = Math.max(0, Math.min(index, testimonialCards.length - 1));
    testimonialTrack.scrollTo({
      left: getTestimonialStep() * safeIndex,
      behavior: "smooth"
    });
    setActiveTestimonial(safeIndex);
  };

  testimonialPrev?.addEventListener("click", () => {
    scrollToTestimonial(getActiveTestimonial() - 1);
  });

  testimonialNext?.addEventListener("click", () => {
    scrollToTestimonial(getActiveTestimonial() + 1);
  });

  testimonialDots.forEach((dot) => {
    dot.addEventListener("click", () => {
      scrollToTestimonial(Number(dot.dataset.testimonialDot));
    });
  });


  testimonialTrack.addEventListener("scroll", () => {
    if (testimonialTicking) return;
    testimonialTicking = true;
    window.requestAnimationFrame(() => {
      setActiveTestimonial(getActiveTestimonial());
      testimonialTicking = false;
    });
  }, { passive: true });

  window.addEventListener("resize", () => setActiveTestimonial(getActiveTestimonial()));
}

const observer = new IntersectionObserver(
  (entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in-view"); observer.unobserve(e.target); }
  }),
  { threshold: 0.1 }
);
document.querySelectorAll(".animate-on-scroll").forEach((el) => observer.observe(el));

// ── Fleet quick-view overlay (hover desktop) ────────────────────────
document.querySelectorAll(".price-card").forEach((card) => {
  if (card.querySelector(".quick-view")) return;
  const nameEl = card.querySelector("h3");
  const dl = card.querySelector("dl");
  const wa = card.querySelector(".whatsapp-action");
  if (!nameEl || !dl || !wa) return;
  const unit = nameEl.textContent.trim();
  const priceText = dl.textContent.replace(/\s+/g, " ").trim();
  const overlay = document.createElement("div");
  overlay.className = "quick-view";
  overlay.innerHTML = `<strong>${unit}</strong><span>${priceText}</span><a href="${wa.getAttribute("href") || "#kontak"}" data-whatsapp-message="${wa.dataset.whatsappMessage || ""}">Pesan via WhatsApp</a>`;
  card.appendChild(overlay);
});

// ── WhatsApp flow: pre-fill from URL + progress ─────────────────────
(function () {
  const params = new URLSearchParams(location.search);
  const prefillMap = { qcService: "service", qcDate: "date", qcDuration: "duration", qcArea: "area", name: "name" };
  let prefilled = false;
  Object.entries(prefillMap).forEach(([id, key]) => {
    const val = params.get(key);
    if (!val) return;
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === "SELECT") {
      const opt = Array.from(el.options).find(o => o.value === val || o.text === val);
      if (opt) { el.value = opt.value; prefilled = true; }
    } else {
      el.value = val;
      prefilled = true;
    }
  });
  if (prefilled) window.mtTrackEvent?.("quick_check_prefill", { form_name: "quick_check" });

  const form = document.getElementById("quickCheckForm");
  if (!form) return;
  const submitBtn = form.querySelector(".qc-submit");
  if (!submitBtn) return;
  form.addEventListener("submit", () => {
    const original = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.textContent = "Mengirim ke WhatsApp...";
    setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.innerHTML = original;
    }, 2200);
  });
})();
