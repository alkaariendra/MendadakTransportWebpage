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

// AI booking assistant
const ASSISTANT_WELCOME_MESSAGE = "Halo, saya asisten Mendadak Transport. Paket chat website saat ini: New Honda Brio lepas kunci Rp350.000 / 24 jam, mulai besok jam 09:00. Saya cukup catat nama, nomor HP, dan pilihan pengantaran atau pengambilan. Jika datanya lengkap, notifikasi akan terkirim otomatis ke admin.";

const getAssistantWelcomeMessage = () => ({
  role: "assistant",
  content: ASSISTANT_WELCOME_MESSAGE
});

const assistantState = {
  open: false,
  busy: false,
  leadSent: false,
  messages: [getAssistantWelcomeMessage()]
};

const assistantQuickReplies = [
  "Saya pilih pengantaran",
  "Saya pilih pengambilan",
  "Saya mau booking Brio",
  "Kirim nama dan HP"
];

const assistantShell = document.createElement("div");
assistantShell.className = "ai-assistant";
assistantShell.innerHTML = `
  <button class="ai-assistant-toggle" type="button" aria-label="Buka AI assistant" aria-expanded="false">
    <span>AI</span>
    <strong>Tanya AI</strong>
  </button>
  <section class="ai-assistant-panel" aria-label="AI assistant Mendadak Transport">
    <div class="ai-assistant-header">
      <div>
        <strong>AI Booking Assistant</strong>
        <span>Mendadak Transport</span>
      </div>
      <button class="ai-assistant-close" type="button" aria-label="Tutup AI assistant">×</button>
    </div>
    <div class="ai-assistant-messages" aria-live="polite"></div>
    <div class="ai-assistant-quick" aria-label="Pertanyaan cepat"></div>
    <form class="ai-assistant-form">
      <textarea rows="1" name="message" placeholder="Tulis nama, nomor HP, atau alamat..." aria-label="Tulis nama, nomor HP, atau alamat"></textarea>
      <button type="submit">Kirim</button>
    </form>
    <button class="ai-assistant-wa" type="button">Kirim Manual ke Admin</button>
    <span class="ai-assistant-status" aria-live="polite"></span>
  </section>
`;
document.body.appendChild(assistantShell);

const assistantToggle = assistantShell.querySelector(".ai-assistant-toggle");
const assistantPanel = assistantShell.querySelector(".ai-assistant-panel");
const assistantClose = assistantShell.querySelector(".ai-assistant-close");
const assistantMessagesEl = assistantShell.querySelector(".ai-assistant-messages");
const assistantQuickEl = assistantShell.querySelector(".ai-assistant-quick");
const assistantForm = assistantShell.querySelector(".ai-assistant-form");
const assistantInput = assistantForm.querySelector("textarea");
const assistantSubmit = assistantForm.querySelector("button");
const assistantWa = assistantShell.querySelector(".ai-assistant-wa");
const assistantStatus = assistantShell.querySelector(".ai-assistant-status");

const cleanAssistantText = (text) => String(text || "")
  .replace(/\*\*(.*?)\*\*/g, "$1")
  .replace(/__(.*?)__/g, "$1")
  .replace(/`([^`]+)`/g, "$1")
  .replace(/[*_]{2,}/g, "")
  .replace(/^\s*[*]\s+/gm, "- ")
  .trim();

const escapeAssistantHtml = (text) => cleanAssistantText(text).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
}[char])).replace(/\n/g, "<br>");

const getCompactAssistantSummary = () => {
  const latestAssistant = [...assistantState.messages].reverse().find((message) => (
    message.role === "assistant"
    && message.content !== ASSISTANT_WELCOME_MESSAGE
    && !/pesanan sudah dikirim/i.test(message.content)
  ));
  const latestUsers = assistantState.messages
    .filter((message) => message.role === "user")
    .slice(-4)
    .map((message) => cleanAssistantText(message.content))
    .join("\n");

  return cleanAssistantText(latestAssistant?.content || latestUsers || "Pesanan dari AI assistant.")
    .replace(/klik tombol kirim pesanan ke admin.*$/i, "")
    .replace(/website akan mengirim notifikasi ke admin otomatis.*$/i, "")
    .replace(/ketersediaan dan harga final.*$/i, "")
    .trim()
    .slice(0, 900);
};

const updateAssistantWhatsApp = () => {
  const message = `Halo admin Mendadak Transport, saya ingin meneruskan pesanan dari AI assistant.\n\nPaket:\nNew Honda Brio lepas kunci\nHarga: Rp350.000 / 24 jam\nMulai: Besok jam 09:00\nDurasi: 24 jam\n\nRingkasan:\n${getCompactAssistantSummary()}`;
  assistantWa.dataset.fallbackUrl = createWhatsAppUrl(whatsappPrimary, message);
};

const renderAssistantMessages = () => {
  assistantMessagesEl.innerHTML = assistantState.messages
    .map((message) => `<div class="ai-message ${message.role}">${escapeAssistantHtml(message.content)}</div>`)
    .join("");
  assistantMessagesEl.scrollTop = assistantMessagesEl.scrollHeight;
  updateAssistantWhatsApp();
};

const setAssistantOpen = (open) => {
  assistantState.open = open;
  assistantShell.classList.toggle("open", open);
  assistantToggle.setAttribute("aria-expanded", String(open));
  if (open) {
    renderAssistantMessages();
    setTimeout(() => assistantInput.focus(), 80);
  }
};

const setAssistantBusy = (busy) => {
  assistantState.busy = busy;
  assistantSubmit.disabled = busy;
  assistantInput.disabled = busy;
  assistantWa.disabled = busy || assistantState.leadSent;
  assistantShell.classList.toggle("loading", busy);
};

const setAssistantStatus = (message, type = "") => {
  assistantStatus.textContent = message;
  assistantStatus.dataset.type = type;
};

const isAssistantLeadReady = (content) => {
  const text = cleanAssistantText(content);
  const hasSummary = /ringkasan\s+pesanan/i.test(text);
  const hasContact = /(whats\s*app|wa|hp|nomor)/i.test(text);
  const hasRentalDetail = /(armada|mobil|brio|lepas\s+kunci|pengantaran|pengambilan|alamat|jemput|lokasi)/i.test(text);
  const asksToSend = /kirim\s+pesanan\s+ke\s+admin|meneruskan\s+ringkasan|notifikasi\s+ke\s+admin/i.test(text);

  return hasSummary && hasContact && (hasRentalDetail || asksToSend);
};

assistantQuickEl.innerHTML = assistantQuickReplies
  .map((reply) => `<button type="button">${reply}</button>`)
  .join("");

assistantQuickEl.querySelectorAll("button").forEach((button) => {
  button.addEventListener("click", () => {
    assistantInput.value = button.textContent;
    assistantForm.requestSubmit();
  });
});

const askAssistant = async (content) => {
  const cleanContent = content.trim();
  if (!cleanContent || assistantState.busy) return;

  assistantState.messages.push({ role: "user", content: cleanContent });
  assistantInput.value = "";
  renderAssistantMessages();
  setAssistantBusy(true);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: assistantState.messages })
    });
    const data = await response.json().catch(() => ({}));

    const assistantReply = response.ok
      ? cleanAssistantText(data.reply)
      : (data.error || "Maaf, AI assistant sedang tidak tersedia. Silakan lanjut via WhatsApp.");

    assistantState.messages.push({
      role: "assistant",
      content: assistantReply
    });

    if (response.ok && isAssistantLeadReady(assistantReply)) {
      setTimeout(() => submitAssistantLead({ automatic: true }), 250);
    }
  } catch (error) {
    assistantState.messages.push({
      role: "assistant",
      content: "Maaf, koneksi ke AI assistant sedang bermasalah. Silakan lanjut via WhatsApp agar admin bisa bantu langsung."
    });
  } finally {
    setAssistantBusy(false);
    assistantInput.style.height = "auto";
    renderAssistantMessages();
  }
};

const submitAssistantLead = async ({ automatic = false } = {}) => {
  if (assistantState.busy || assistantState.leadSent) return;

  setAssistantBusy(true);
  setAssistantStatus(
    automatic ? "Data lengkap. Mengirim otomatis ke admin..." : "Mengirim pesanan ke admin...",
    "loading"
  );

  try {
    const response = await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: assistantState.messages,
        pageUrl: window.location.href
      })
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok && data.ok) {
      assistantState.leadSent = true;
      setAssistantStatus(data.message || "Pesanan sudah dikirim ke admin.", "success");
      assistantWa.textContent = "Terkirim ke Admin";
      assistantWa.disabled = true;
      if (!automatic) {
        assistantState.messages = [getAssistantWelcomeMessage()];
        assistantState.leadSent = false;
        assistantWa.textContent = "Kirim Manual ke Admin";
        assistantInput.value = "";
        assistantInput.style.height = "auto";
        renderAssistantMessages();
      }
      return;
    }

    const fallbackUrl = data.fallbackUrl || assistantWa.dataset.fallbackUrl;
    setAssistantStatus(
      automatic
        ? "Notifikasi otomatis belum aktif. Klik Kirim Manual ke Admin sebagai fallback."
        : (data.message || "Membuka WhatsApp admin sebagai fallback."),
      "warning"
    );
    if (!automatic && fallbackUrl) window.open(fallbackUrl, "_blank", "noopener");
  } catch (error) {
    setAssistantStatus(
      automatic
        ? "Koneksi notifikasi bermasalah. Klik Kirim Manual ke Admin sebagai fallback."
        : "Koneksi notifikasi bermasalah. Membuka WhatsApp admin.",
      "warning"
    );
    if (!automatic && assistantWa.dataset.fallbackUrl) {
      window.open(assistantWa.dataset.fallbackUrl, "_blank", "noopener");
    }
  } finally {
    setAssistantBusy(false);
  }
};

assistantToggle.addEventListener("click", () => setAssistantOpen(!assistantState.open));
assistantClose.addEventListener("click", () => setAssistantOpen(false));
assistantForm.addEventListener("submit", (event) => {
  event.preventDefault();
  askAssistant(assistantInput.value);
});
assistantWa.addEventListener("click", submitAssistantLead);
assistantInput.addEventListener("input", () => {
  assistantInput.style.height = "auto";
  assistantInput.style.height = `${Math.min(110, assistantInput.scrollHeight)}px`;
});

renderAssistantMessages();

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
// Testimonial slider
const testimonialTrack = document.querySelector("[data-testimonial-track]");
const testimonialCards = testimonialTrack ? Array.from(testimonialTrack.querySelectorAll(".testimonial-card")) : [];
const testimonialPrev = document.querySelector("[data-testimonial-prev]");
const testimonialNext = document.querySelector("[data-testimonial-next]");
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
