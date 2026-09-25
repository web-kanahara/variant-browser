const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const watch = process.argv.includes("--watch");
const sourceDir = path.join(__dirname, "src");
const distDir = path.join(__dirname, "dist");
const uiTemplatePath = path.join(sourceDir, "ui", "ui.html");
const manifestPath = path.join(sourceDir, "manifest.json");

// Figmaは画面を1つのHTMLとして読み込むため、バンドルしたJSとCSSをui.htmlへ直接埋め込む
let uiOutput = null;

function writeUi() {
  if (!uiOutput) return;
  const html = fs
    .readFileSync(uiTemplatePath, "utf8")
    .replace("<!-- inline:css -->", () => `<style>\n${uiOutput.css}</style>`)
    .replace("<!-- inline:js -->", () => `<script>\n${uiOutput.js.replace(/<\/script/gi, "<\\/script")}</script>`);
  fs.writeFileSync(path.join(distDir, "ui.html"), html);
}

function copyManifest() {
  fs.copyFileSync(manifestPath, path.join(distDir, "manifest.json"));
}

const inlineUi = {
  name: "inline-ui",
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length) return;
      const output = (extension) => result.outputFiles.find((file) => file.path.endsWith(extension))?.text ?? "";
      uiOutput = { js: output(".js"), css: output(".css") };
      writeUi();
      if (watch) console.log("[build] ui.html を更新しました");
    });
  },
};

const common = {
  bundle: true,
  platform: "browser",
  target: "es2017",
  logLevel: "info",
};

async function main() {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });
  copyManifest();

  const contexts = await Promise.all([
    esbuild.context({
      ...common,
      entryPoints: [path.join(sourceDir, "code.ts")],
      outfile: path.join(distDir, "code.js"),
    }),
    esbuild.context({
      ...common,
      entryPoints: [path.join(sourceDir, "ui", "ui.ts")],
      outdir: path.join(distDir, "ui"),
      write: false,
      plugins: [inlineUi],
    }),
  ]);

  if (!watch) {
    const results = await Promise.all(contexts.map((context) => context.rebuild()));
    await Promise.all(contexts.map((context) => context.dispose()));
    if (results.some((result) => result.errors.length)) process.exit(1);
    console.log("[build] dist にFigma用ファイルを生成しました");
    return;
  }

  await Promise.all(contexts.map((context) => context.watch()));
  // ui.htmlのテンプレートとmanifest.jsonはesbuildの監視対象外なので個別に監視する
  fs.watch(uiTemplatePath, () => writeUi());
  fs.watch(manifestPath, () => copyManifest());
  console.log("[build] 変更を監視しています（Ctrl+C で終了）");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
