const whatsappPrimary = "6289697301342";
const whatsappSecondary = "62881038004520";
const defaultMessage =
  "Halo Mendadak Transport, saya ingin bertanya ketersediaan transport.";

const primaryLinks = document.querySelectorAll("[data-whatsapp-link]");
const secondaryLinks = document.querySelectorAll("[data-whatsapp-link-alt]");
const messageLinks = document.querySelectorAll("[data-whatsapp-message]");
const year = document.querySelector("#year");

const createWhatsAppUrl = (number, message = defaultMessage) =>
  `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;

const applyWhatsAppLink = (link, number, message) => {
  link.setAttribute("href", createWhatsAppUrl(number, message));
  link.setAttribute("target", "_blank");
  link.setAttribute("rel", "noopener");
};

if (year) {
  year.textContent = new Date().getFullYear();
}

primaryLinks.forEach((link) => applyWhatsAppLink(link, whatsappPrimary));
secondaryLinks.forEach((link) => applyWhatsAppLink(link, whatsappSecondary));

messageLinks.forEach((link) => {
  applyWhatsAppLink(link, whatsappPrimary, link.dataset.whatsappMessage);
});
