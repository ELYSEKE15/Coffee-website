// Bourbon St. Cafe - site behaviour.
// No external requests and no innerHTML, so nothing a visitor types can run as code.

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const canObserve = "IntersectionObserver" in window;

// small helper: make an element and put text in it with textContent (safe)
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const money = (n) => Number(n).toLocaleString("en-US") + " RWF";

// 1. Mobile menu -------------------------------------------------------
const toggle = $(".menu-toggle");
const links = $(".nav-links");

function setMenu(open) {
  links.classList.toggle("active", open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.textContent = open ? "✕" : "☰";
}

if (toggle && links) {
  toggle.addEventListener("click", () => setMenu(!links.classList.contains("active")));
  links.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
  document.addEventListener("click", (e) => { if (!e.target.closest("nav")) setMenu(false); });
  // the screen became wide again: close the mobile menu
  matchMedia("(min-width: 901px)").addEventListener("change", (e) => e.matches && setMenu(false));
}

// 2. Placeholder links (href="#") would jump to the top, so do nothing.
$$('a[href="#"]').forEach((a) => a.addEventListener("click", (e) => e.preventDefault()));

// 3. Sections fade in slowly the first time they are scrolled to ---------
if (canObserve) {
  const reveal = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("in-view");
      obs.unobserve(entry.target); // only once
    });
  }, { threshold: 0.1 });

  $$(".about, .menu, .logos, .about2, .guest-page, .footer-section").forEach((section) => {
    section.classList.add("reveal");
    reveal.observe(section);
  });
}

// 4. Highlight the menu link of the section on screen --------------------
if (canObserve) {
  const menuLinks = $$(".nav-links a");

  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const current = menuLinks.find((a) => a.hash === "#" + entry.target.id);
      menuLinks.forEach((a) =>
        a === current ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")
      );
    });
  }, { rootMargin: "-40% 0px -40% 0px" });

  $$("#Home, #About, #Menu, #Blog, #Contact").forEach((section) => spy.observe(section));
}

// 5. Menu cards come from the database (same data as the order page) ------
// The first 4 items show. The rest get the class "extra" and stay hidden until VIEW MORE is clicked.
const FIRST_SHOWN = 4;
const moreBtn = $("#more-btn");

function makeCard(item, index) {
  const img = el("img");
  img.alt = item.name;
  img.loading = "lazy";
  // if the photo is missing, show the cafe logo instead of a broken image
  img.onerror = () => { img.onerror = null; img.src = "/images/logo.png"; };
  img.src = item.image || "/images/logo.png";

  const pic = el("div", "c-img");
  pic.append(img);

  const content = el("div", "c-content");
  content.append(el("h6", "", item.name), el("p", "", item.description || ""), el("p", "pay", money(item.price)));

  const card = el("div", "container");
  card.dataset.category = item.category;
  card.append(pic, content);

  if (index >= FIRST_SHOWN) {
    card.classList.add("extra");
    card.hidden = true;
  }
  return card;
}

async function loadMenuCards() {
  const box = $("#cards");
  if (!box) return;
  if (moreBtn) moreBtn.style.display = "none"; // shown again below only if there are more than 4 items

  try {
    const res = await fetch("/api/coffee");
    if (!res.ok) throw new Error("Server answered " + res.status);
    const items = await res.json();

    if (items.length === 0) {
      box.replaceChildren(el("p", "", "Our menu is coming soon."));
      return;
    }
    box.replaceChildren(...items.map(makeCard));
    if (moreBtn && items.length > FIRST_SHOWN) moreBtn.style.display = "";
    // CHANGED: tell extras.js the cards exist now, so it can build the category tabs
    document.dispatchEvent(new Event("menu:ready"));
  } catch (err) {
    console.error(err);
    box.replaceChildren(el("p", "", "Could not load the menu. Please refresh the page."));
  }
}

if (moreBtn) {
  moreBtn.addEventListener("click", () => {
    const open = moreBtn.getAttribute("aria-expanded") !== "true";
    $$(".extra").forEach((card) => (card.hidden = !open));
    moreBtn.setAttribute("aria-expanded", String(open));
    moreBtn.textContent = open ? "VIEW LESS" : "VIEW MORE";
  });
}

loadMenuCards();

// 6. Newsletter: simple check (a convenience only, NOT security) ---------
const subscribe = $(".sub-btn");
const email = $("#email-input");

if (subscribe && email) {
  const send = () => {
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
    email.setAttribute("aria-invalid", String(!valid));
    if (!valid) return email.focus();

    // TODO: send the email to your own backend with fetch() and validate it
    // again on the server. Nothing is saved yet.
    email.value = "";
    subscribe.textContent = "THANK YOU ✓";
    setTimeout(() => (subscribe.textContent = "SUBSCRIBE"), 2000);
  };

  subscribe.addEventListener("click", send);
  email.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
}