// Order page. All text goes in with textContent (never innerHTML), so menu data can't run as code.

const $ = (s) => document.querySelector(s);
const money = (n) => n.toLocaleString("en-US") + " RWF";

const PAY_TEXT = {
    pickup: "Total to pay at pickup",
    momo: "Total to pay at pickup with MTN MoMo",
    airtel: "Total to pay at pickup with Airtel Money",
};

let coffees = [];
let filter = "All";
const cart = new Map();

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

// Coffee Loader Component Helper
function createCoffeeLoader(text = "Brewing...") {
    const loader = el("div", "coffee-loader");
    const steam = el("div", "coffee-steam");
    steam.append(el("span"), el("span"), el("span"));
    
    const cup = el("div", "coffee-cup");
    cup.prepend(steam);
    
    loader.append(text ? el("p", "", text) : null, cup);
    return loader;
}

function say(text, type) {
    const msg = $("#msg");
    if (!msg) return;
    msg.textContent = text;
    msg.className = "o-msg " + (type || "");
}

function showLoading() {
    const box = $("#items");
    if (!box) return;
    box.replaceChildren(createCoffeeLoader("Preparing your order options..."));
}

function drawTabs() {
    const box = $("#tabs");
    if (!box) return;
    box.replaceChildren();
    ["All", ...new Set(coffees.map((c) => c.category))].forEach((type) => {
        const tab = el("button", "o-tab" + (type === filter ? " is-on" : ""), type);
        tab.type = "button";
        tab.setAttribute("aria-pressed", String(type === filter));
        tab.addEventListener("click", () => { filter = type; drawTabs(); drawMenu(); });
        box.append(tab);
    });
}

function control(coffee) {
    const qty = cart.get(coffee._id) || 0;
    if (qty === 0) {
        const add = el("button", "o-add", "ADD");
        add.type = "button";
        add.addEventListener("click", () => setQty(coffee._id, 1));
        return add;
    }
    const step = el("div", "o-step");
    const minus = el("button", "", "−");
    const plus = el("button", "", "+");
    minus.type = plus.type = "button";
    minus.setAttribute("aria-label", "Remove one " + coffee.name);
    plus.setAttribute("aria-label", "Add one " + coffee.name);
    minus.addEventListener("click", () => setQty(coffee._id, qty - 1));
    plus.addEventListener("click", () => setQty(coffee._id, qty + 1));
    step.append(minus, el("span", "", String(qty)), plus);
    return step;
}

function drawMenu() {
    const box = $("#items");
    if (!box) return;
    box.replaceChildren();
    coffees
        .filter((c) => filter === "All" || c.category === filter)
        .forEach((coffee) => {
            const card = el("article", "o-card");
            const img = el("img");
            img.alt = coffee.name;
            img.loading = "lazy";
            img.onerror = () => {
                img.onerror = null;
                img.src = "/images/logo.png";
                img.classList.add("is-fallback");
            };
            img.src = coffee.image || "/images/logo.png";

            const foot = el("div", "o-foot");
            foot.append(el("span", "o-price", money(coffee.price)), control(coffee));
            const body = el("div", "o-body");
            body.append(el("h3", "", coffee.name), el("p", "", coffee.description), foot);

            card.append(img, body);
            box.append(card);
        });
}

function setQty(id, qty) {
    qty = Math.max(0, Math.min(20, qty));
    if (qty === 0) cart.delete(id);
    else cart.set(id, qty);
    drawMenu();
    drawCart();
}

function drawCart() {
    const box = $("#lines");
    if (!box) return;
    box.replaceChildren();
    let total = 0;
    let count = 0;

    cart.forEach((qty, id) => {
        const coffee = coffees.find((c) => c._id === id);
        if (!coffee) return;
        total += coffee.price * qty;
        count += qty;
        const row = el("div", "o-line");
        row.append(el("span", "", qty + " × " + coffee.name), el("strong", "", money(coffee.price * qty)));
        box.append(row);
    });

    if (count === 0) box.append(el("p", "o-empty", "Your cart is empty. Add something tasty!"));
    const countEl = $("#count");
    const totalEl = $("#total");
    if (countEl) countEl.textContent = count ? "(" + count + ")" : "";
    if (totalEl) totalEl.textContent = money(total);

    const fab = $("#fab");
    if (fab) {
        fab.hidden = count === 0;
        fab.textContent = "View order · " + count + " item" + (count === 1 ? "" : "s") + " · " + money(total);
    }
}

async function loadMenu() {
    const box = $("#items");
    if (!box) return;
    showLoading(); 
    try {
        const res = await fetch("/api/coffee");
        if (!res.ok) throw new Error("Server answered " + res.status);
        coffees = await res.json();
        if (coffees.length === 0) {
            box.replaceChildren(el("p", "", "The menu is empty. Please come back soon."));
            return;
        }
        drawTabs();
        drawMenu();
        drawCart();
    } catch (err) {
        console.error(err);
        box.replaceChildren(el("p", "", "Could not load the menu. Please refresh the page and try again."));
    }
}

const orderForm = $("#order-form");
if (orderForm) {
    orderForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (cart.size === 0) return say("Please add at least one item.", "error");

        const chosen = document.querySelector('input[name="pay"]:checked');
        const method = chosen ? chosen.value : "pickup";

        const button = $("#send");
        if (button) button.disabled = true;
        say("Sending your order...");
        try {
            const res = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: $("#name").value,
                    phone: $("#phone").value,
                    note: $("#note").value,
                    paymentMethod: method,
                    items: [...cart].map(([id, quantity]) => ({ id, quantity })),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || "Order failed");

            const who = $("#name").value.trim();
            const phone = $("#phone").value.trim();
            $("#done-text").textContent =
                who + ", your order #" + data.orderId.slice(-6).toUpperCase() +
                " is received. " + PAY_TEXT[method] + ": " + money(data.total) + ". " +
                "We will call " + phone + " if we need to confirm anything. Please show your order number at the counter.";
            $("#cart-body").hidden = true;
            $("#done").hidden = false;
            $("#fab").hidden = true;
            cart.clear();
            e.target.reset();
            say("");
            $("#cart").scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (err) {
            say(err.message === "Failed to fetch" ? "No connection. Try again." : err.message, "error");
        } finally {
            if (button) button.disabled = false;
        }
    });
}

const againBtn = $("#again");
if (againBtn) {
    againBtn.addEventListener("click", () => {
        $("#done").hidden = true;
        $("#cart-body").hidden = false;
        drawMenu();
        drawCart();
    });
}

loadMenu();