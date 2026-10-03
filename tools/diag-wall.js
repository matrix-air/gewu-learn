// 一次性诊断：竞品墙 5 张图在线上为何 2 张报 BROKEN（懒加载竞态 vs 真换行/真丢图）
const { chromium } = require("/Users/start-h/Documents/Aurora/tools/node_modules/playwright-core");
const BASE = process.argv[2] || "https://matrix-air.github.io/gewu-learn";
const CHROME = "/Users/start-h/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars"] });
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const failed = [];
  p.on("requestfailed", (r) => failed.push({ url: r.url(), err: r.failure() && r.failure().errorText }));
  p.on("response", (r) => { if (r.url().includes("assets/img/") && r.status() !== 200) failed.push({ url: r.url(), status: r.status() }); });

  await p.goto(BASE + "/index.html", { waitUntil: "load" });
  await p.evaluate(() => document.getElementById("vsWall").scrollIntoView({ block: "center" }));
  await p.waitForTimeout(900);
  const t900 = await p.$$eval("#vsWall .shot img", (ns) => ns.map((n) => ({
    src: n.getAttribute("src"), ok: n.complete && n.naturalWidth > 0, loading: n.loading,
    r: (() => { const x = n.getBoundingClientRect(); return [Math.round(x.left), Math.round(x.top), Math.round(x.width), Math.round(x.height)]; })(),
  })));

  // 再等：如果 3s 后全好 => 纯竞态；仍坏 => 真问题
  await p.waitForTimeout(3000);
  const t3s = await p.$$eval("#vsWall .shot img", (ns) => ns.map((n) => `${n.getAttribute("src")}=${n.complete && n.naturalWidth > 0 ? "ok" : "BROKEN"}`));
  const wall = await p.$eval("#vsWall", (n) => { const cs = getComputedStyle(n); return { display: cs.display, overflowX: cs.overflowX, scrollW: n.scrollWidth, clientW: n.clientWidth }; });

  console.log(JSON.stringify({ viewportW: 1440, wall, at900ms: t900, at3900ms: t3s, failed }, null, 1));
  await b.close();
})();
