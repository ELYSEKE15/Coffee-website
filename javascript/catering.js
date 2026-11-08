// Catering request. We check the form here, then open WhatsApp with the message written.
// The cafe's WhatsApp number comes from the server (.env), so it is never typed into this file.
const $ = (s) => document.querySelector(s);

let whatsapp = ""; // filled in by loadNumber() below

function say(text, bad) {
  const msg = $("#c-msg");
  msg.textContent = text;
  msg.className = "p-msg" + (bad ? " bad" : "");
}

// today as "2026-11-08", so the customer cannot choose a day that has passed
function today() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + month + "-" + day;
}
$("#c-date").min = today();

// ask the server for the cafe's number; if it fails, the form stays switched off
async function loadNumber() {
  try {
    const res = await fetch("/api/contact");
    const data = await res.json();
    if (typeof data.whatsapp === "string" && /^[0-9]{8,15}$/.test(data.whatsapp)) whatsapp = data.whatsapp;
  } catch (err) {
    console.error(err);
  }
}
const ready = loadNumber(); // the submit below waits for this

$("#catering-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  await ready;

  if (!whatsapp) {
    return say("Catering requests are not switched on yet. Please call us or visit the cafe.", true);
  }

  const name = $("#c-name").value.trim();
  const phone = $("#c-phone").value.replace(/\s+/g, "");
  const type = $("#c-type").value;
  const date = $("#c-date").value;
  const guests = Number($("#c-guests").value);
  const note = $("#c-note").value.trim();

  if (name.length < 2) return say("Please enter your name.", true);
  if (!/^\+?[0-9]{7,15}$/.test(phone)) return say("Please enter a valid phone number.", true);
  if (!date || date < today()) return say("Please choose a date from today onwards.", true);
  if (!Number.isInteger(guests) || guests < 1 || guests > 500) return say("Guests must be from 1 to 500.", true);

  const text = [
    "Hello Bourbon St. Cafe, I would like to ask about catering.",
    "Name: " + name,
    "Phone: " + phone,
    "Event: " + type,
    "Date: " + date,
    "Guests: " + guests,
    note ? "Details: " + note : "",
  ].filter(Boolean).join("\n");

  window.open("https://wa.me/" + whatsapp + "?text=" + encodeURIComponent(text), "_blank", "noopener");
  say("WhatsApp is opening. Press send there to finish your request.");
});