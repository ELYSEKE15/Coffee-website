require("dotenv").config();
const mongoose = require("mongoose");
const Coffee = require("./models/coffee");

// Prices are in Rwandan francs (RWF). Change them here whenever you want.
const menu = [
  // Drinks
  { name: "Espresso", category: "Drinks", price: 1500, image: "/images/menu/espresso.jpg", description: "Strong, rich shot of locally roasted coffee." },
  { name: "Cappuccino", category: "Drinks", price: 2800, image: "/images/menu/cappuccino.jpg", description: "Espresso with velvety steamed milk foam." },
  { name: "Vanilla Latte", category: "Drinks", price: 3500, image: "/images/cup.jpg", description: "Smooth espresso with vanilla and steamed milk." },
  { name: "Iced Mocha", category: "Drinks", price: 4000, image: "/images/menu/iced-mocha.jpg", description: "Espresso, chocolate and cold milk over ice." },
  { name: "Fresh Passion Juice", category: "Drinks", price: 2500, image: "/images/menu/passion-juice.jpg", description: "Freshly squeezed, no added sugar." },
  // Food
  { name: "Avocado Toast", category: "Food", price: 5500, image: "/images/Avocado Toast with Fried Eggs.jpg", description: "Sourdough, smashed avocado, chili flakes, microgreens." },
  { name: "Grain Bowl", category: "Food", price: 7500, image: "/images/Healthy Grain Bowl Ideas.jpg", description: "Quinoa, roasted veggies, feta and tahini dressing." },
  { name: "Chicken Sandwich", category: "Food", price: 6500, image: "/images/menu/chicken-sandwich.jpg", description: "Grilled chicken, greens and house sauce." },
  { name: "Beef Brochettes", category: "Food", price: 6000, image: "/images/menu/brochettes.jpg", description: "Grilled beef skewers served with fries." },
  { name: "Spanish Omelette", category: "Food", price: 3500, image: "/images/menu/omelette.jpg", description: "Fluffy eggs with potato, onion and tomato." },
  // Bakery
  { name: "Blueberry Muffin", category: "Bakery", price: 2000, image: "/images/bluebully.jpg", description: "Moist and fluffy, filled with juicy blueberries." },
  { name: "Butter Croissant", category: "Bakery", price: 2000, image: "/images/menu/croissant.jpg", description: "Flaky, golden and baked fresh each morning." },
  { name: "Chocolate Cake Slice", category: "Bakery", price: 3500, image: "/images/menu/chocolate-cake.jpg", description: "Rich chocolate sponge with a smooth ganache." },
];

mongoose.connect(process.env.MONGO_URI)
  .then(() => Coffee.deleteMany({}))
  .then(() => Coffee.insertMany(menu))
  .then(() => { console.log("Menu added: " + menu.length + " items"); process.exit(0); })
  .catch((err) => { console.error(err.message); process.exit(1); });