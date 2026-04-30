require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

// Usage: node export.js <folderName> [dbName]
// Example: node export.js level1_2025-08-22 level1
const ARG_FOLDER = process.argv[2];
const DB_NAME = process.argv[3] || process.env.DB_NAME || "level1";

if (!ARG_FOLDER) {
  console.error("Please provide an output folder name. Example: node export.js my_export_folder");
  process.exit(1);
}

// Ensure base data directory exists: ./data
const baseDir = path.join(__dirname, "data");
fs.mkdirSync(baseDir, { recursive: true });

// Create ./data/<ARG_FOLDER>, or ./data/<ARG_FOLDER>-<timestamp> if it exists
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
let outputDir = path.join(baseDir, ARG_FOLDER);
if (fs.existsSync(outputDir)) {
  outputDir = path.join(baseDir, `${ARG_FOLDER}-${stamp}`);
}
fs.mkdirSync(outputDir, { recursive: true });

async function exportCollection(name, filter = {}) {
  const docs = await mongoose.connection.db.collection(name).find(filter).toArray();
  const filePath = path.join(outputDir, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(docs, null, 2));
  console.log(`Exported ${docs.length} docs from ${name} -> ${path.relative(process.cwd(), filePath)}`);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: DB_NAME });
  console.log(`Connected to MongoDB (db=${DB_NAME})`);
  console.log(`Saving to: ${path.relative(process.cwd(), outputDir)}`);

  const cols = await mongoose.connection.db.listCollections().toArray();
  const names = cols.map((c) => c.name).filter((n) => !n.startsWith("system."));

  for (const name of names) {
    await exportCollection(name);
  }

  await mongoose.disconnect();
  console.log(`Done. Files saved to: ${outputDir}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

