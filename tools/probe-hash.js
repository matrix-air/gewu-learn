/* 取证脚本：畸形 hash 是否打断 app.html 装配 / 合法深链是否仍生效
   用途：改 `app.js` 深链段（try/catch decodeURIComponent）后回归。
   用法：node tools/probe-hash.js [base]      默认 http://127.0.0.1:8792

   两条踩过的 harness 坑（改脚本前先读）：
   1) Playwright 只改 hash 的 goto 是**同文档导航**，DOMContentLoaded 不会重跑，
      量到的是上一个页面的状态。必须给每个用例加唯一 query 强制整页加载。
   2) 深链 id 必须用真实的 sectionId（`科|册全名|章|节号`），自造短书名会查不到、
      看起来像「深链坏了」，其实是 id 错。 */
const { chromium } = require("/Users/start-h/Documents/Aurora/tools/node_modules/playwright-core");

const CHROME = "/Users/start-h/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const BASE = process.argv[2] || "http://127.0.0.1:8792";

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message).split("\n")[0]));

  const out = { base: BASE, cases: {} };
  let i = 0;
  const go = async (hash) => {
    errs.length = 0;
    await page.goto(`${BASE}/app.html?probe=${++i}${hash}`, { waitUntil: "load" });
    await page.waitForTimeout(700);
    return [...errs];
  };

  // 畸形 hash：不该报错、树照常装配（expandAll 有反应即为装配完成）
  for (const [name, hash] of [["normal", "#"], ["bare-%", "#%"], ["truncated-utf8", "#%E0%A4"]]) {
    const e = await go(hash);
    out.cases[name] = {
      requestedHash: hash,
      actualHash: await page.evaluate(() => location.hash),
      pageErrors: e,
      treeDetails: await page.$$eval("#tree details", (n) => n.length),
      listeners: await page.evaluate(async () => {
        const b = document.getElementById("expandAll");
        if (!b) return "no-btn";
        document.querySelectorAll("#tree details").forEach((d) => (d.open = false));
        b.click();
        await new Promise((r) => setTimeout(r, 150));
        const open = document.querySelectorAll("#tree details[open]").length;
        return open > 0 ? "INSTALLED(" + open + ")" : "MISSING(NO-REACTION)";
      }),
    };
  }

  // 合法深链：改了 try/catch 之后必须仍然生效
  const sid = "物理|人教版高中物理 · 必修第一册（2019）|第一章 运动的描述|1.2";
  {
    const e = await go(`#s=${encodeURIComponent(sid)}`);
    out.cases["#s=<real id>"] = {
      pageErrors: e,
      pane: await page.evaluate(() => (document.querySelector(".pane.on") || {}).id),
      title: await page.evaluate(() => (document.querySelector("#lesson .lesson-title") || {}).innerText),
      fields: await page.$$eval("#lesson .fld", (n) => n.length),
    };
  }
  {
    const e = await go("#lab=statics");
    out.cases["#lab=statics"] = {
      pageErrors: e,
      pane: await page.evaluate(() => (document.querySelector(".pane.on") || {}).id),
      canvas: await page.$$eval("#labHost canvas", (n) => n.length),
    };
  }

  out.verdict =
    out.cases["bare-%"].pageErrors.length === 0 &&
    out.cases["truncated-utf8"].pageErrors.length === 0 &&
    /INSTALLED/.test(out.cases["bare-%"].listeners) &&
    out.cases["#s=<real id>"].pane === "learnPane" &&
    out.cases["#s=<real id>"].fields === 5 &&
    out.cases["#lab=statics"].canvas === 1
      ? "PASS"
      : "FAIL";

  console.log(JSON.stringify(out, null, 1));
  await browser.close();
  process.exit(out.verdict === "PASS" ? 0 : 1);
})();
