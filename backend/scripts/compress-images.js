// Makes smaller copies of the photos in /images, with the SAME file names and folders.
// Your original photos are never changed.
//
//   1. npm install            (installs "sharp", only needed for this script)
//   2. npm run images
//   3. Look at the new folder  images-optimized  next to your images folder.
//      If the photos look good, copy them over the originals.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SOURCE = path.join(__dirname, "..", "..", "images");
const TARGET = path.join(__dirname, "..", "..", "images-optimized");
const MAX_SIDE = 1600; // no photo needs to be bigger than this on a cafe website
const EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

// every file inside a folder, including subfolders
function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

async function shrink(file) {
  const ext = path.extname(file).toLowerCase();
  let image = sharp(file).rotate() // .rotate() fixes photos that were taken sideways
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true });

  if (ext === ".png") image = image.png({ compressionLevel: 9 });
  else if (ext === ".webp") image = image.webp({ quality: 80 });
  else image = image.jpeg({ quality: 80, mozjpeg: true });

  return image.toBuffer();
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error("Cannot find the images folder: " + SOURCE);
    process.exit(1);
  }

  let before = 0;
  let after = 0;

  for (const file of listFiles(SOURCE)) {
    if (!EXTENSIONS.has(path.extname(file).toLowerCase())) continue;

    const relative = path.relative(SOURCE, file);
    const target = path.join(TARGET, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });

    const original = fs.statSync(file).size;
    try {
      const smaller = await shrink(file);
      // keep the new file only when it is really smaller
      const keep = smaller.length < original;
      fs.writeFileSync(target, keep ? smaller : fs.readFileSync(file));
      const size = keep ? smaller.length : original;
      before += original;
      after += size;
      console.log((keep ? "smaller " : "same    ") + relative + "  " +
        Math.round(original / 1024) + " KB -> " + Math.round(size / 1024) + " KB");
    } catch (err) {
      console.log("skipped " + relative + " (" + err.message + ")");
    }
  }

  console.log("\nTotal: " + Math.round(before / 1024) + " KB -> " + Math.round(after / 1024) + " KB");
  console.log("New photos are in: " + TARGET);
}

main();