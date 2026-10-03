// 无头渲染验收：截落地页/课程页全页与分屏片，并实测交互台真值
// 用法: node render-shots.js <baseUrl> <outPrefix>
const { chromium } = require("/Users/start-h/Documents/Aurora/tools/node_modules/playwright-core");

const BASE = process.argv[2] || "http://127.0.0.1:8792";
const OUT = process.argv[3] || "/tmp/gewu";
const CHROME = "/Users/start-h/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ["--hide-scrollbars", "--force-device-scale-factor=2"],
  });
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));

  const out = { errors: errs };

  /* ───── 落地页 ───── */
  await page.goto(BASE + "/index.html", { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1400);

  out.landing = {};
  // 数据层真值 → 页面上显示的数字必须对得上
  out.landing.statsText = await page.$eval(".statline", (n) => n.innerText.replace(/\s+/g, " ").trim());
  out.landing.layerCards = await page.$$eval("#layerCards .layer", (ns) =>
    ns.map((n) => n.innerText.replace(/\s+/g, " ").trim()));
  out.landing.clusterCount = await page.$$eval("#clusterGrid .cbox", (ns) => ns.length);
  out.landing.labCount = await page.$$eval("#labGrid .labcard", (ns) => ns.length);
  // 竞品截图是 loading=lazy：先滚到该区触发加载，再等"全部 settle"（load/error）而非固定延时。
  // 固定 900ms 在线上 Pages 会假阴性（实测 2/5 未解码完 → 误报 BROKEN）；等 settle 才是确定性的。
  await page.evaluate(() => document.getElementById("vsWall").scrollIntoView({ block: "center" }));
  await page.waitForFunction(() => {
    const ns = [...document.querySelectorAll("#vsWall .shot img")];
    return ns.length > 0 && ns.every((n) => n.complete);
  }, null, { timeout: 20000 }).catch(() => {});
  out.landing.wallCount = await page.$$eval("#vsWall .shot img", (ns) =>
    ns.map((n) => (n.complete && n.naturalWidth > 0 ? `ok:${n.naturalWidth}x${n.naturalHeight}` : "BROKEN:" + n.getAttribute("src"))));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  // hero 交互台：拖 α 到 50°，验证 F_Q 随 β−α 变小而爆涨
  out.landing.hero = await page.evaluate(async () => {
    const cv = document.querySelector("#heroStage canvas");
    if (!cv) return { err: "no hero canvas" };
    const h = +cv.dataset.h;
    const read = () => document.getElementById("heroVerdict").innerText.replace(/\s+/g, " ").trim();
    const r = cv.getBoundingClientRect();
    const cx = r.width * 0.44, cy = h * 0.44;
    const at = (deg) => {
      const a = deg * Math.PI / 180;
      return { x: r.left + cx + Math.sin(a) * 150, y: r.top + cy - Math.cos(a) * 150 };
    };
    const before = read();
    // 拖到 50°（先落到手柄上再拖）
    const p0 = at(37), p1 = at(50);
    cv.dispatchEvent(new PointerEvent("pointerdown", { clientX: p0.x, clientY: p0.y, bubbles: true, pointerId: 1 }));
    for (let i = 1; i <= 6; i++) {
      cv.dispatchEvent(new PointerEvent("pointermove", {
        clientX: p0.x + (p1.x - p0.x) * i / 6, clientY: p0.y + (p1.y - p0.y) * i / 6,
        bubbles: true, pointerId: 1 }));
    }
    cv.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
    await new Promise((r) => setTimeout(r, 120));
    return { canvasH: h, before, after: read(),
             sliderA: document.querySelector("#heroStage .val").textContent };
  });

  await page.screenshot({ path: OUT + "-landing-full.png", fullPage: true });
  const secs = await page.$$("header.hero, section.sec, footer.site-footer");
  let i = 1;
  for (const s of secs) {
    const b = await s.boundingBox();
    if (!b || b.height < 40) continue;
    await s.screenshot({ path: `${OUT}-landing-p${String(i).padStart(2, "0")}.png`, animations: "disabled" });
    i++;
  }

  /* ───── 课程页 ───── */
  await page.goto(BASE + "/app.html", { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1500);

  out.app = {};
  out.app.subjectTabs = await page.$$eval(".subj-tabs .tab", (ns) => ns.map((n) => n.innerText.trim()));
  out.app.clusterCount = await page.$$eval("#tree .tnode-cluster", (ns) => ns.length);
  out.app.chapterCount = await page.$$eval("#tree .tnode-chap", (ns) => ns.length);

  // 打开一个章 → 打开一节 → 检查六栏渲染 + KaTeX 是否真的排版了
  out.app.lesson = await page.evaluate(async () => {
    const clickFirst = (sel) => {
      const n = document.querySelector(sel);
      if (!n) return false;
      (n.querySelector("summary") || n).click();
      return true;
    };
    clickFirst("#tree .tnode-chap");
    await new Promise((r) => setTimeout(r, 250));
    // 点第一个 leaf
    const leaf = document.querySelector("#tree .tnode-chap .leaf-item");
    if (leaf) leaf.click();
    await new Promise((r) => setTimeout(r, 400));
    const pane = document.getElementById("lesson");
    if (!pane) return { err: "no #lesson" };
    const fields = Array.from(pane.querySelectorAll(".fld")).map((f) => ({
      label: f.querySelector(".fld-l")?.innerText.trim(),
      len: f.querySelector(".fld-v")?.innerText.length || 0,
    }));
    return {
      title: pane.querySelector(".lesson-title")?.innerText.trim() || "",
      fieldCount: fields.length,
      fields: fields,
      katexNodes: pane.querySelectorAll(".katex").length,
      rawDollarLeft: (pane.innerText.match(/\$/g) || []).length,
    };
  });

  // 进度：标记已学 → localStorage 落库 → 刷新后仍在
  out.app.progress = await page.evaluate(async () => {
    const b = document.getElementById("markLearned");
    if (!b) return { err: "no #markLearned" };
    b.click();
    await new Promise((r) => setTimeout(r, 250));
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("gewu."));
    const raw = keys.map((k) => k + "=" + localStorage.getItem(k));
    return { keys: keys, raw: raw, badge: document.getElementById("progressBadge")?.innerText.trim() || "" };
  });

  await page.screenshot({ path: OUT + "-app-full.png", fullPage: true });
  const appSecs = await page.$$(".app-head, .app-main, footer.site-footer");
  let j = 1;
  for (const s of appSecs) {
    const b = await s.boundingBox();
    if (!b || b.height < 40) continue;
    await s.screenshot({ path: `${OUT}-app-p${String(j).padStart(2, "0")}.png`, animations: "disabled" });
    j++;
  }

  /* ───── 小屏 ───── */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  out.mobileAppOverflowPx = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: OUT + "-app-mobile.png" });

  await page.goto(BASE + "/index.html", { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(900);
  out.mobileLandingOverflowPx = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: OUT + "-landing-mobile.png" });

  out.errors = errs;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => { console.error("RENDER FAIL:", e.message); process.exit(1); });
