#!/usr/bin/env bun
/**
 * Build script for the browser extension.
 *
 * Features:
 * 1. Reads manifest.json and discovers JS files actually referenced by the manifest.
 * 2. Copies ONLY those JS files (processed: comments + console.* removed) plus any non-JS assets
 *    that the manifest references (icons, html, etc.) into a temporary build directory while
 *    preserving the original folder structure.
 * 3. Produces a zip archive at dist/extension.zip ready for store submission.
 *
 * Usage:  bun build-extension.js [--manifest path/to/manifest.json] [--out dist/extension.zip]
 */
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import archiver from "archiver";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- CLI Args ----
const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : def;
}

const manifestPath = path.resolve(
  __dirname,
  getArg("--manifest", "manifest.json")
);
const outZipPath = path.resolve(
  __dirname,
  getArg("--out", path.join("dist", "extension.zip"))
);

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

function stripCommentsAndConsole(code) {
  // Remove /* block comments */ (non-greedy)
  code = code.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove // line comments but keep protocol (e.g., http://)
  code = code.replace(/(^|[^:])\/\/.*$/gm, (_, p1) => p1);
  // Remove console.* statements that are standalone expression statements.
  code = code.replace(/^[\t ]*console\.[A-Za-z0-9_]+\s*\([^;]*?\);?\s*$/gm, "");
  return code.trimStart();
}

function collectManifestFiles(manifest) {
  const jsFiles = new Set();
  const assetFiles = new Set();

  const addIfJs = (p) => {
    if (p && p.endsWith(".js")) jsFiles.add(p);
  };
  const addAsset = (p) => {
    if (p) assetFiles.add(p);
  };

  // Content scripts
  (manifest.content_scripts || []).forEach((cs) => {
    (cs.js || []).forEach(addIfJs);
    (cs.css || []).forEach(addAsset); // keep any CSS referenced
  });

  // Background service worker (MV3)
  if (manifest.background) {
    if (manifest.background.service_worker)
      addIfJs(manifest.background.service_worker);
    if (Array.isArray(manifest.background.scripts))
      manifest.background.scripts.forEach(addIfJs);
  }

  // Web accessible resources (MV3 style array of objects or MV2 style arrays)
  if (Array.isArray(manifest.web_accessible_resources)) {
    manifest.web_accessible_resources.forEach((entry) => {
      if (Array.isArray(entry.resources))
        entry.resources.forEach((r) => {
          r.endsWith(".js") ? jsFiles.add(r) : assetFiles.add(r);
        });
      else if (Array.isArray(entry))
        entry.forEach((r) => {
          r.endsWith(".js") ? jsFiles.add(r) : assetFiles.add(r);
        });
    });
  }

  // Icons
  if (manifest.icons) Object.values(manifest.icons).forEach(addAsset);

  // Action default_popup (html) + default_icon values
  if (manifest.action) {
    if (manifest.action.default_popup) addAsset(manifest.action.default_popup);
    if (manifest.action.default_icon) addAsset(manifest.action.default_icon);
    if (typeof manifest.action.default_icon === "object")
      Object.values(manifest.action.default_icon).forEach(addAsset);
  }

  // Options page / devtools / etc.
  ["options_page", "devtools_page"].forEach((k) => {
    if (manifest[k]) addAsset(manifest[k]);
  });
  if (manifest.options_ui && manifest.options_ui.page)
    addAsset(manifest.options_ui.page);

  // Include any js referenced indirectly in top-level keys (fallback)
  Object.values(manifest).forEach((v) => {
    if (typeof v === "string" && v.endsWith(".js")) jsFiles.add(v);
  });

  // Anything referenced as HTML/CSS/PNG etc. in js sets is already collected; ensure js not in asset set
  jsFiles.forEach((f) => assetFiles.delete(f));

  return { jsFiles: Array.from(jsFiles), assetFiles: Array.from(assetFiles) };
}

async function copyAndProcess(files, root, destRoot, processFn) {
  for (const rel of files) {
    const src = path.resolve(root, rel);
    const dest = path.resolve(destRoot, rel);
    await ensureDir(path.dirname(dest));
    const buf = await fsp.readFile(src, "utf8");
    await fsp.writeFile(dest, processFn(buf, rel), "utf8");
  }
}

async function copyAssets(files, root, destRoot) {
  for (const rel of files) {
    const src = path.resolve(root, rel);
    const dest = path.resolve(destRoot, rel);
    await ensureDir(path.dirname(dest));
    await fsp.copyFile(src, dest);
  }
}

async function createZip(srcDir, zipPath) {
  await ensureDir(path.dirname(zipPath));
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", reject);
    output.on("close", () => resolve(zipPath));
    archive.pipe(output);
    archive.directory(srcDir + path.sep, false);
    archive.finalize();
  });
}

async function main() {
  console.log("Reading manifest:", manifestPath);
  const manifestRaw = await fsp.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw);

  const { jsFiles, assetFiles } = collectManifestFiles(manifest);
  console.log("JS referenced by manifest:", jsFiles);
  console.log("Other assets referenced:", assetFiles);

  const tempDir = path.resolve(__dirname, `.ext-build-tmp-${Date.now()}`);
  await ensureDir(tempDir);

  const extRoot = path.dirname(manifestPath);
  // Copy manifest itself unchanged.
  await fsp.writeFile(
    path.join(tempDir, path.basename(manifestPath)),
    JSON.stringify(manifest, null, 2)
  );

  // Process JS
  await copyAndProcess(jsFiles, extRoot, tempDir, (code) =>
    stripCommentsAndConsole(code)
  );
  // Assets
  await copyAssets(assetFiles, extRoot, tempDir);

  // Zip
  await createZip(tempDir, outZipPath);
  console.log("Created zip at", outZipPath);

  // Cleanup temp dir
  await fs.promises.rm(tempDir, { recursive: true, force: true });
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
