// Admin panel. All text goes in with textContent (never innerHTML), so order data can't run as code.
const $ = (s) => document.querySelector(s);
const money = (n) => Number(n).toLocaleString("en-US") + " RWF";
const STATUSES = ["new", "preparing", "ready", "done", "cancelled"];
const MAX_PHOTO = 300 * 1024; // same limit as the server
let tab = "dash";
let menu = [];
let editingId = null;
let lastNew = null; // how many new orders we saw last time, to tell the admin when one arrives
let toastTimer;

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function cell(content) {
    const td = el("td");
    td.append(content);
    return td;
}

function toast(text, bad) {
    const box = $("#toast");
    box.textContent = text;
    box.className = "a-toast" + (bad ? " bad" : "");
    box.hidden = false;
    clearTimeout(toastTimer); // a new message restarts the timer
    toastTimer = setTimeout(() => (box.hidden = true), 3000);
}

// "#A1B2C3" style short order number
function shortId(order) {
    return "#" + order._id.slice(-6).toUpperCase();
}

// "5 min ago" is easier to read than a full date
function ago(date) {
    const mins = Math.round((Date.now() - new Date(date)) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + " min ago";
    const hours = Math.round(mins / 60);
    if (hours < 24) return hours + " h ago";
    return new Date(date).toLocaleDateString();
}

// One helper for every request. A 401 sends the admin back to the login screen.
async function api(url, method = "GET", body) {
    const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) { showLogin(); throw new Error("Please log in"); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Something went wrong");
    return data;
}

// ---------- show / hide password ----------
function hidePassword() {
    $("#password").type = "password";
    const btn = $("#toggle-pass");
    btn.textContent = "Show";
    btn.setAttribute("aria-label", "Show password");
    btn.setAttribute("aria-pressed", "false");
}

$("#toggle-pass").addEventListener("click", () => {
    const input = $("#password");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    const btn = $("#toggle-pass");
    btn.textContent = show ? "Hide" : "Show";
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    btn.setAttribute("aria-pressed", String(show));
    input.focus();
});

// ---------- login / logout ----------
// The password always goes back to hidden when the login screen appears.
function showLogin() { hidePassword(); $("#app").hidden = true; $("#login").hidden = false; }

function showApp() {
    $("#login").hidden = true;
    $("#app").hidden = false;
    openTab("dash");
}

$("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#login-msg");
    msg.textContent = "";
    try {
        const res = await fetch("/api/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: $("#password").value }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Login failed");
        $("#password").value = "";
        showApp();
    } catch (err) {
        msg.textContent = err.message;
    }
});

$("#logout").addEventListener("click", async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    document.title = "Admin - Bourbon St. Cafe";
    lastNew = null;
    showLogin();
});

// ---------- tabs ----------
function openTab(name) {
    tab = name;
    document.querySelectorAll(".a-tab").forEach((b) => b.classList.toggle("is-on", b.dataset.tab === name));
    document.querySelectorAll(".a-sec").forEach((s) => (s.hidden = s.id !== "tab-" + name));
    refresh();
}

// used by the dashboard cards: open the Orders tab with a filter already chosen
function goToOrders(status) {
    $("#filter").value = status;
    openTab("orders");
}

function refresh() {
    const run = tab === "dash" ? loadStats : tab === "orders" ? loadOrders : loadMenu;
    run().catch((err) => toast(err.message, true));
}

document.querySelectorAll(".a-tab").forEach((b) => b.addEventListener("click", () => openTab(b.dataset.tab)));
// new orders show up by themselves every 30 seconds
setInterval(() => { if (!$("#app").hidden && tab !== "menu") refresh(); }, 30000);
// and right away when the admin comes back to this browser tab
document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !$("#app").hidden && tab !== "menu") refresh();
});

// ---------- dashboard ----------
// Two extra blocks are made here, so admin.html stays the same.
const hello = el("p", "a-hello", "Loading…");
const latest = el("div", "a-latest");
$("#stats").before(hello);
$("#stats").after(latest);

async function loadStats() {
    // ask for both at the same time, it is faster than one after the other
    const [s, orders] = await Promise.all([api("/api/admin/stats"), api("/api/admin/orders")]);

    // greeting, date and the time of the last update
    const now = new Date();
    const hour = now.getHours();
    const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    hello.textContent = greet + " · " +
        now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) +
        " · Updated " + now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // tell the admin when a new order arrives, and show the count in the browser tab title
    if (lastNew !== null && s.newOrders > lastNew) toast("New order received!");
    lastNew = s.newOrders;
    document.title = (s.newOrders > 0 ? "(" + s.newOrders + ") " : "") + "Admin - Bourbon St. Cafe";

    // number cards. A card with an action opens the right tab when clicked.
    const box = $("#stats");
    box.replaceChildren();
    [
        ["📅", "Orders today", s.todayOrders, "since midnight", false, null],
        ["🔔", "New orders waiting", s.newOrders, s.newOrders > 0 ? "click to open them" : "all caught up", s.newOrders > 0, () => goToOrders("new")],
        ["🧾", "All orders", s.orders, "click to see them", false, () => goToOrders("")],
        ["💰", "Sales (done orders)", money(s.sales), "finished orders only", false, null],
        ["☕", "Menu items", s.items, "click to edit the menu", false, () => openTab("menu")],
    ].forEach(([icon, label, value, hint, alert, open]) => {
        const card = el("div", "a-stat" + (alert ? " is-alert" : ""));
        card.append(el("span", "", icon + " " + label), el("strong", "", String(value)), el("small", "a-hint", hint));
        if (open) {
            card.tabIndex = 0; // reachable with the keyboard
            card.setAttribute("role", "button");
            card.style.cursor = "pointer";
            card.addEventListener("click", open);
            card.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
        }
        box.append(card);
    });

    // the 5 latest orders, so the admin sees activity without opening the Orders tab
    latest.replaceChildren(el("h3", "", "Latest orders"));
    if (orders.length === 0) {
        latest.append(el("p", "", "No orders yet. New orders will appear here."));
        return;
    }

    const head = el("tr");
    ["Order", "Customer", "Total", "When", "Status"].forEach((t) => head.append(el("th", "", t)));
    const thead = el("thead");
    thead.append(head);

    const tbody = el("tbody");
    orders.slice(0, 5).forEach((o) => {
        const row = el("tr");
        row.append(
            cell(shortId(o)),
            cell(o.customerName),
            cell(money(o.total)),
            cell(ago(o.createdAt)),
            cell(el("span", "a-status s-" + o.status, o.status)),
        );
        tbody.append(row);
    });

    const table = el("table", "a-table");
    table.append(thead, tbody);
    const wrap = el("div", "a-scroll");
    wrap.append(table);

    const more = el("button", "a-mini", "View all orders");
    more.type = "button";
    more.addEventListener("click", () => goToOrders(""));

    latest.append(wrap, more);
}

// ---------- orders ----------
async function loadOrders() {
    const status = $("#filter").value;
    const orders = await api("/api/admin/orders" + (status ? "?status=" + status : ""));
    const body = $("#orders");
    body.replaceChildren();

    if (orders.length === 0) {
        const row = el("tr");
        const td = cell(status ? "No " + status + " orders." : "No orders yet.");
        td.colSpan = 6;
        row.append(td);
        body.append(row);
        return;
    }

    orders.forEach((o) => {
        const select = el("select", "a-status s-" + o.status);
        STATUSES.forEach((s) => {
            const option = el("option", "", s);
            option.value = s;
            option.selected = s === o.status;
            select.append(option);
        });
        select.addEventListener("change", async () => {
            try {
                await api("/api/admin/orders/" + o._id, "PATCH", { status: select.value });
                select.className = "a-status s-" + select.value;
                toast("Order " + shortId(o) + " is now " + select.value);
            } catch (err) { toast(err.message, true); loadOrders(); }
        });

        const who = el("div");
        who.append(el("strong", "", o.customerName), el("small", "", o.phone));
        if (o.note) who.append(el("small", "", "Note: " + o.note));

        // "5 min ago" on top, the full date and time below it
        const when = el("div");
        when.append(el("strong", "", ago(o.createdAt)), el("small", "", new Date(o.createdAt).toLocaleString()));

        const row = el("tr");
        row.append(
            cell(shortId(o)),
            cell(when),
            cell(who),
            cell(o.items.map((i) => i.quantity + "× " + i.name).join(", ")),
            cell(money(o.total)),
            cell(select),
        );
        body.append(row);
    });
}
$("#filter").addEventListener("change", refresh);

// ---------- menu ----------
async function loadMenu() {
    menu = await api("/api/coffee");
    const body = $("#menu");
    body.replaceChildren();

    if (menu.length === 0) {
        const row = el("tr");
        const td = cell("No items yet. Add your first item above.");
        td.colSpan = 5;
        row.append(td);
        body.append(row);
        return;
    }

    menu.forEach((item) => {
        const img = el("img");
        img.alt = item.name;
        img.onerror = () => { img.onerror = null; img.src = "/images/logo.png"; };
        img.src = item.image || "/images/logo.png";

        const edit = el("button", "a-mini", "Edit");
        edit.type = "button";
        edit.addEventListener("click", () => startEdit(item));
        const del = el("button", "a-mini danger", "Delete");
        del.type = "button";
        del.addEventListener("click", async () => {
            if (!confirm("Delete " + item.name + "?")) return;
            try {
                await api("/api/coffee/delete/" + item._id, "DELETE");
                toast("Deleted " + item.name);
                loadMenu();
            } catch (err) { toast(err.message, true); }
        });
        const actions = el("div");
        actions.append(edit, del);

        const row = el("tr");
        row.append(cell(img), cell(item.name), cell(item.category), cell(money(item.price)), cell(actions));
        body.append(row);
    });
}

// Shrink the photo in the browser: max 600px, JPEG. Small file = fast site and small database.
// createImageBitmap reads the file directly. No blob: link is needed, so the security policy stays strict.
async function shrink(file) {
    let bitmap;
    try { bitmap = await createImageBitmap(file); }
    catch { throw new Error("This file is not a photo"); }

    const scale = Math.min(1, 600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // transparent PNGs would turn black without this
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    return new Promise((resolve, reject) =>
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error("Could not read this photo"))),
            "image/jpeg", 0.8
        )
    );
}

async function uploadPhoto(id, blob) {
    const res = await fetch("/api/coffee/" + id + "/image", {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
    });
    if (res.status === 401) { showLogin(); throw new Error("Please log in"); }
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Photo upload failed");
    }
}

// Show a preview as soon as a photo is picked. FileReader makes a data: link, which the policy allows.
$("#m-file").addEventListener("change", () => {
    const file = $("#m-file").files[0];
    const preview = $("#m-preview");
    if (!file) { preview.hidden = true; return; }
    const reader = new FileReader();
    reader.onload = () => { preview.src = reader.result; preview.hidden = false; };
    reader.readAsDataURL(file);
});

function startEdit(item) {
    editingId = item._id;
    $("#m-name").value = item.name;
    $("#m-price").value = item.price;
    $("#m-cat").value = item.category;
    $("#m-image").value = item.image || "";
    $("#m-preview").src = item.image || "";
    $("#m-preview").hidden = !item.image;
    $("#m-desc").value = item.description || "";
    $("#form-title").textContent = "Edit " + item.name;
    $("#m-save").textContent = "SAVE CHANGES";
    $("#m-cancel").hidden = false;
    $("#menu-form").scrollIntoView({ behavior: "smooth" });
}

function resetForm() {
    editingId = null;
    $("#menu-form").reset();
    $("#m-preview").hidden = true;
    $("#form-title").textContent = "Add a new item";
    $("#m-save").textContent = "ADD ITEM";
    $("#m-cancel").hidden = true;
}
$("#m-cancel").addEventListener("click", resetForm);

$("#menu-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
        name: $("#m-name").value,
        price: Number($("#m-price").value),
        category: $("#m-cat").value,
        image: $("#m-image").value,
        description: $("#m-desc").value,
    };

    // lock the button while saving, so a double click can't create the item twice
    const save = $("#m-save");
    save.disabled = true;
    save.textContent = "SAVING…";

    try {
        const file = $("#m-file").files[0];
        const photo = file ? await shrink(file) : null; // check the photo first, before saving anything
        if (photo && photo.size > MAX_PHOTO) throw new Error("This photo is too big. Try a smaller one.");

        const saved = editingId
            ? await api("/api/coffee/" + editingId, "PUT", payload)
            : await api("/api/coffee", "POST", payload);
        if (photo) await uploadPhoto(saved._id, photo);
        toast(editingId ? "Item updated" : "Item added");
        resetForm();
        loadMenu();
    } catch (err) {
        toast(err.message, true);
    } finally {
        save.disabled = false;
        save.textContent = editingId ? "SAVE CHANGES" : "ADD ITEM";
    }
});

// ---------- start: are we already logged in? ----------
fetch("/api/admin/me")
    .then((res) => res.json())
    .then((data) => (data.admin ? showApp() : showLogin()))
    .catch(showLogin);