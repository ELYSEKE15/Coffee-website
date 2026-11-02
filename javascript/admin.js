// Admin panel. All text goes in with textContent (never innerHTML), so order data can't run as code.
const $ = (s) => document.querySelector(s);
const money = (n) => Number(n).toLocaleString("en-US") + " RWF";
const STATUSES = ["new", "preparing", "ready", "done", "cancelled"];
let tab = "dash";
let menu = [];
let editingId = null;

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
    setTimeout(() => (box.hidden = true), 3000);
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

// ---------- login / logout ----------
function showLogin() { $("#app").hidden = true; $("#login").hidden = false; }

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
    showLogin();
});

// ---------- tabs ----------
function openTab(name) {
    tab = name;
    document.querySelectorAll(".a-tab").forEach((b) => b.classList.toggle("is-on", b.dataset.tab === name));
    document.querySelectorAll(".a-sec").forEach((s) => (s.hidden = s.id !== "tab-" + name));
    refresh();
}

function refresh() {
    const run = tab === "dash" ? loadStats : tab === "orders" ? loadOrders : loadMenu;
    run().catch((err) => toast(err.message, true));
}

document.querySelectorAll(".a-tab").forEach((b) => b.addEventListener("click", () => openTab(b.dataset.tab)));
// new orders show up by themselves every 30 seconds
setInterval(() => { if (!$("#app").hidden && tab !== "menu") refresh(); }, 30000);

// ---------- dashboard ----------
async function loadStats() {
    const s = await api("/api/admin/stats");
    const box = $("#stats");
    box.replaceChildren();
    [
        ["Orders today", s.todayOrders],
        ["New orders waiting", s.newOrders, s.newOrders > 0],
        ["All orders", s.orders],
        ["Sales (done orders)", money(s.sales)],
        ["Menu items", s.items],
    ].forEach(([label, value, alert]) => {
        const card = el("div", "a-stat" + (alert ? " is-alert" : ""));
        card.append(el("span", "", label), el("strong", "", String(value)));
        box.append(card);
    });
}

// ---------- orders ----------
async function loadOrders() {
    const status = $("#filter").value;
    const orders = await api("/api/admin/orders" + (status ? "?status=" + status : ""));
    const body = $("#orders");
    body.replaceChildren();

    if (orders.length === 0) {
        const row = el("tr");
        const td = cell("No orders yet.");
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
                toast("Order #" + o._id.slice(-6).toUpperCase() + " is now " + select.value);
            } catch (err) { toast(err.message, true); loadOrders(); }
        });

        const who = el("div");
        who.append(el("strong", "", o.customerName), el("small", "", o.phone));
        if (o.note) who.append(el("small", "", "Note: " + o.note));

        const row = el("tr");
        row.append(
            cell("#" + o._id.slice(-6).toUpperCase()),
            cell(new Date(o.createdAt).toLocaleString()),
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

function startEdit(item) {
    editingId = item._id;
    $("#m-name").value = item.name;
    $("#m-price").value = item.price;
    $("#m-cat").value = item.category;
    $("#m-image").value = item.image || "";
    $("#m-desc").value = item.description || "";
    $("#form-title").textContent = "Edit " + item.name;
    $("#m-save").textContent = "SAVE CHANGES";
    $("#m-cancel").hidden = false;
    $("#menu-form").scrollIntoView({ behavior: "smooth" });
}

function resetForm() {
    editingId = null;
    $("#menu-form").reset();
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
        image: $("#m-image").value.trim(),
        description: $("#m-desc").value,
    };
    try {
        if (editingId) await api("/api/coffee/" + editingId, "PUT", payload);
        else await api("/api/coffee", "POST", payload);
        toast(editingId ? "Item updated" : "Item added");
        resetForm();
        loadMenu();
    } catch (err) { toast(err.message, true); }
});

// ---------- start: are we already logged in? ----------
fetch("/api/admin/me")
    .then((res) => res.json())
    .then((data) => (data.admin ? showApp() : showLogin()))
    .catch(showLogin);