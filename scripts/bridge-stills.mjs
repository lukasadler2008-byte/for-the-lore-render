// usage: node scripts/bridge-stills.mjs <outPrefix> <frame,frame,...> [scale]  (bundles once, jpeg)
// Linux/no-GPU port: software WebGL. Env overrides:
//   BRIDGE_GL=swiftshader|angle|swangle|egl|angle-egl|vulkan (default swangle)
//   BRIDGE_BROWSER=/path/to/chrome (default /usr/bin/google-chrome; "remotion" = Remotion's own headless shell)
//   COMP=PisaShort picks the composition (BRIDGE_COMP still works; default BridgeShort).
//   BRIDGE_ENTRY=src/sandboxes/<name>/index.tsx renders a sandbox copy instead of the main project entry.
//   REMOTION_TMP=<dir> keeps bundles out of the system temp dir (default /tmp/claude-0/shorts3d/rtmp)
import fs from "node:fs";
const tmp = process.env.REMOTION_TMP || "/tmp/claude-0/shorts3d/rtmp";
fs.mkdirSync(tmp, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.TMPDIR = tmp;
const { bundle } = await import("@remotion/bundler");
const { renderStill, selectComposition, openBrowser } = await import("@remotion/renderer");
const path = await import("node:path");
const [prefix, frames, scale = "0.5"] = process.argv.slice(2);
fs.mkdirSync(path.dirname(path.resolve(prefix)), { recursive: true });
const b = process.env.BRIDGE_BROWSER ?? "/usr/bin/google-chrome";
const browserExecutable = b === "remotion" ? null : b;
const chromiumOptions = { gl: process.env.BRIDGE_GL || "swangle" };
const tb = Date.now();
const serveUrl = process.env.BRIDGE_SERVE || await bundle({ entryPoint: path.resolve(process.env.BRIDGE_ENTRY || "src/index.ts"), publicDir: path.resolve("public") });
console.log("bundle", ((Date.now() - tb) / 1000).toFixed(1) + "s", serveUrl, "gl", chromiumOptions.gl, "browser", browserExecutable ?? "remotion headless shell");
const puppeteerInstance = await openBrowser("chrome", { browserExecutable, chromiumOptions });
const inputProps = process.env.BRIDGE_PROPS ? JSON.parse(process.env.BRIDGE_PROPS) : {}; // e.g. {"post":{"ink":false}}
const composition = await selectComposition({ serveUrl, id: process.env.COMP || process.env.BRIDGE_COMP || "BridgeShort", browserExecutable, chromiumOptions, puppeteerInstance, inputProps });
const onBrowserLog = (l) => { if (process.env.BRIDGE_LOG || l.type === "error" || l.type === "warning") console.log(`[${l.type}]`, l.text.slice(0, 300)); };
for (const f of frames.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${f}.jpg`, imageFormat: "jpeg", jpegQuality: 88, scale: Number(scale),
    browserExecutable, chromiumOptions, timeoutInMilliseconds: 600000, onBrowserLog, puppeteerInstance, inputProps });
  console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
await puppeteerInstance.close({ silent: true });
