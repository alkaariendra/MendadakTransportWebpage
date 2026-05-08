// ── WhatsApp config ─────────────────────────────────────────────────
const whatsappPrimary   = "6289697301342";
const whatsappSecondary = "62881038004520";
const defaultMessage    = "Halo Mendadak Transport, saya ingin bertanya ketersediaan transport.";

const createWhatsAppUrl = (number, message = defaultMessage) =>
  `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;

const applyWhatsAppLink = (link, number, message) => {
  link.setAttribute("href", createWhatsAppUrl(number, message));
  link.setAttribute("target", "_blank");
  link.setAttribute("rel", "noopener");
};

document.querySelectorAll("[data-whatsapp-link]").forEach((l) => applyWhatsAppLink(l, whatsappPrimary));
document.querySelectorAll("[data-whatsapp-link-alt]").forEach((l) => applyWhatsAppLink(l, whatsappSecondary));
document.querySelectorAll("[data-whatsapp-message]").forEach((l) =>
  applyWhatsAppLink(l, whatsappPrimary, l.dataset.whatsappMessage)
);

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

// ── Fleet category filter ───────────────────────────────────────────
const filterBtns  = document.querySelectorAll(".filter-btn");
const priceCards  = document.querySelectorAll(".price-card");

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const filter = btn.dataset.filter;
    priceCards.forEach((card) => {
      const show = filter === "all" || card.dataset.category === filter;
      card.style.display = show ? "" : "none";
    });
  });
});

// ── Scroll-triggered animations ─────────────────────────────────────
const observer = new IntersectionObserver(
  (entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in-view"); observer.unobserve(e.target); }
  }),
  { threshold: 0.1 }
);
document.querySelectorAll(".animate-on-scroll").forEach((el) => observer.observe(el));
