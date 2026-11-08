// Blog. To add a post: copy one block inside POSTS, change the words, and put the newest post first.
// Every text goes in with textContent, so nothing written here can run as code.
const $ = (s) => document.querySelector(s);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// EDIT: these three posts are only examples of general coffee tips. Replace them with your own.
const POSTS = [
  {
    title: "Latte, cappuccino or flat white?",
    date: "2026-11-05",
    text: [
      "All three start with espresso, a small and strong shot of coffee. The difference is the milk.",
      "A latte has the most steamed milk and only a thin layer of foam, so it tastes soft and mild.",
      "A cappuccino has less milk and a thick layer of foam, so the coffee taste is stronger.",
      "A flat white is a smaller drink with smooth, thin foam. It is a good choice if you like coffee with a creamy finish.",
    ],
  },
  {
    title: "Keep your coffee beans fresh at home",
    date: "2026-10-28",
    text: [
      "Coffee loses its taste when it meets air, light, heat and water.",
      "Keep your beans in a closed container, in a cool and dark place.",
      "Grind them just before you make your coffee, and buy only what you will finish in a few weeks.",
    ],
  },
  {
    title: "Welcome to our blog",
    date: "2026-10-20",
    text: [
      "write here who you are",
    ],
  },
];

// "2026-11-05" -> "5 November 2026". Noon keeps the date from jumping because of time zones.
function niceDate(date) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function makePost(post) {
  const [first, ...rest] = post.text;

  const body = el("div", "p-more");
  rest.forEach((paragraph) => body.append(el("p", "", paragraph)));
  body.hidden = true;

  const card = el("article", "p-post");
  card.append(el("small", "", niceDate(post.date)), el("h2", "", post.title), el("p", "", first), body);

  // only posts with more than one paragraph get a button
  if (rest.length > 0) {
    const button = el("button", "p-read", "Read more");
    button.type = "button";
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", () => {
      const open = body.hidden; // hidden now means we are about to open it
      body.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
      button.textContent = open ? "Show less" : "Read more";
    });
    card.append(button);
  }
  return card;
}

const box = $("#posts");
box.replaceChildren(...(POSTS.length ? POSTS.map(makePost) : [el("p", "", "No posts yet. Please come back soon.")]));