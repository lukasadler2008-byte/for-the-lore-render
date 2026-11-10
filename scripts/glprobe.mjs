// node scripts/glprobe.mjs <browserExecutable> <gl>  -> prints WebGL renderer and whether a screenshot shows the red canvas
process.env.TEMP = process.env.TMP = process.env.TMPDIR = "/tmp/claude-0/shorts3d/rtmp";
const { openBrowser } = await import("@remotion/renderer");
const [exe, gl] = process.argv.slice(2);
const br = await openBrowser("chrome", { browserExecutable: exe, chromiumOptions: { gl } });
const page = await br.newPage({ context: () => null, logLevel: "info", indent: false, pageIndex: 0, onBrowserLog: null, onLog: () => {} });
await page.goto({ url: "data:text/html,<canvas id=c width=64 height=64></canvas>", timeout: 20000 });
const r = await page.evaluate(() => {
  const c = document.getElementById("c"); const g = c.getContext("webgl2", { preserveDrawingBuffer: true });
  if (!g) return "NO WEBGL2";
  const d = g.getExtension("WEBGL_debug_renderer_info");
  g.clearColor(1, 0, 0, 1); g.clear(g.COLOR_BUFFER_BIT);
  const px = new Uint8Array(4); g.readPixels(1, 1, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
  return (d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER)) + " px=" + px.join(",") + " maxTex=" + g.getParameter(g.MAX_TEXTURE_SIZE) + " samples=" + g.getParameter(g.MAX_SAMPLES);
});
console.log(gl, "|", r);
await br.close({ silent: true });
