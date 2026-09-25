const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const sourceDir = path.join(__dirname, "src");
const distDir = path.join(__dirname, "dist");

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

esbuild
  .build({
    entryPoints: [path.join(sourceDir, "code.ts")],
    bundle: true,
    outfile: path.join(distDir, "code.js"),
    platform: "browser",
    target: "es2017",
    logLevel: "info",
  })
  .then(() => {
    fs.copyFileSync(path.join(sourceDir, "ui.html"), path.join(distDir, "ui.html"));
    fs.copyFileSync(
      path.join(sourceDir, "manifest.json"),
      path.join(distDir, "manifest.json"),
    );
    console.log("[build] dist にFigma用ファイルを生成しました");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
