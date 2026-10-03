#!/usr/bin/env node
/**
 * 几何层验收：文本重叠 / 对比度 / 横向溢出 / 触控尺寸。
 * 与 render-shots.js 的分工：
 *   render-shots.js  —— 内容层（数字对不对、字段齐不齐、交互数值变不变）
 *   audit_visual.js  —— 几何层（有没有压字、看不清、撑破屏、点不着）
 * 两者都过才算验收过。退出码非 0 = 有 FAIL。
 */
const { chromium } = require("/Users/start-h/Documents/Aurora/tools/node_modules/playwright-core");

const BASE = process.argv[2] || "http://127.0.0.1:8792";
const CHROME = "/Users/start-h/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

/* 对比度：WCAG 相对亮度 */
function srgb(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function lum(rgb) { return 0.2126 * srgb(rgb[0]) + 0.7152 * srgb(rgb[1]) + 0.0722 * srgb(rgb[2]); }
function ratio(a, b) {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const IN_PAGE = () => {
  const parse = (s) => {
    const m = (s || "").match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map((x) => parseFloat(x));
    return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
  };
  // 逐级向上找第一个不透明背景
  function bgOf(el) {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.5) return c.rgb;
      n = n.parentElement;
    }
    const c = parse(getComputedStyle(document.body).backgroundColor);
    return c ? c.rgb : [255, 255, 255];
  }

  /* 真实可见判定：closed <details> 的子叶有布局盒但不渲染，必须排除，
     否则每个折叠节点都会跟后面所有节点"重叠"（实测 2726 处假阳性）。 */
  function visible(el) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return false;
    const cd = el.closest("details:not([open])");
    if (cd && !(el.tagName === "SUMMARY" && el.parentElement === cd)) return false;
    if (typeof el.checkVisibility === "function" &&
        !el.checkVisibility({ checkVisibilityCSS: true, contentVisibilityAuto: true })) return false;
    return true;
  }

  /* 1) 文本重叠：只比真实可见的、直接含文本的叶子 */
  const textEls = [...document.querySelectorAll("body *")].filter((el) => {
    if (el.closest("canvas, svg, script, style")) return false;
    if (!visible(el)) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    return [...el.childNodes].some(
      (n) => n.nodeType === 3 && n.textContent.trim().length > 1
    );
  });
  const overlaps = [];
  for (let i = 0; i < textEls.length; i++) {
    const a = textEls[i].getBoundingClientRect();
    for (let j = i + 1; j < textEls.length; j++) {
      const b = textEls[j].getBoundingClientRect();
      if (a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top) continue;
      if (textEls[i].contains(textEls[j]) || textEls[j].contains(textEls[i])) continue;
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 3 && oy > 3) {
        overlaps.push({
          a: (textEls[i].textContent || "").trim().slice(0, 34),
          b: (textEls[j].textContent || "").trim().slice(0, 34),
          px: `${Math.round(ox)}x${Math.round(oy)}`,
        });
      }
    }
  }

  /* 2) 对比度：抽样正文/次要文字 */
  const samples = [];
  const sel = "p, li, h1, h2, h3, h4, a, button, label, .lede, .statline, .dim, .crumb, .scope";
  const seen = new Set();
  for (const el of document.querySelectorAll(sel)) {
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 6) continue;
    const txt = (el.textContent || "").trim();
    if (!txt || seen.has(txt.slice(0, 40))) continue;
    seen.add(txt.slice(0, 40));
    const fg = parse(cs.color);
    if (!fg) continue;
    const fs = parseFloat(cs.fontSize);
    const bold = +cs.fontWeight >= 600;
    const need = (fs >= 24 || (fs >= 18.66 && bold)) ? 3.0 : 4.5;
    samples.push({ t: txt.slice(0, 30), fg: fg.rgb, bg: bgOf(el), fs: Math.round(fs * 10) / 10, need });
  }

  /* 3) 横向溢出（真值=文档级 scrollWidth）+ 触控尺寸
     定位元素（如 skip-link 的 left:-9999px）不产生滚动条，不计入。 */
  const de = document.documentElement;
  const docW = de.clientWidth;
  const docOverflowPx = Math.max(0, de.scrollWidth - de.clientWidth);
  const overflow = [...document.querySelectorAll("body *")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0) return false;
      const cs = getComputedStyle(el);
      if (cs.position === "absolute" || cs.position === "fixed") return false;
      return r.right > docW + 1.5 || r.left < -1.5;
    })
    .slice(0, 8)
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || "").toString().slice(0, 30),
      right: Math.round(el.getBoundingClientRect().right),
      docW,
    }));

  const small = [...document.querySelectorAll("a, button, [role=button], input, summary")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width >= 1 && r.height >= 1 && r.height < 24;
    })
    .slice(0, 10)
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      txt: (el.textContent || "").trim().slice(0, 20),
      h: Math.round(el.getBoundingClientRect().height),
    }));

  return { overlaps: overlaps.slice(0, 12), samples, overflow, small, docW, docOverflowPx };
};

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ["--hide-scrollbars", "--force-device-scale-factor=1"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const fails = [];
  const report = {};

  for (const [name, url] of [["landing", `${BASE}/index.html`], ["app", `${BASE}/app.html`]]) {
    await page.goto(url, { waitUntil: "networkidle" });
    // 触发 lazy 资源与滚动后布局，再回到顶部审计
    await page.evaluate(async () => {
      const h = document.body.scrollHeight;
      for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(600);
    const r = await page.evaluate(IN_PAGE);

    const low = [];
    for (const s of r.samples) {
      const c = ratio(s.fg, s.bg);
      if (c < s.need) low.push({ t: s.t, ratio: Math.round(c * 100) / 100, need: s.need, fs: s.fs });
    }

    report[name] = {
      overlapCount: r.overlaps.length,
      overlaps: r.overlaps,
      contrastSamples: r.samples.length,
      contrastBelow: low.length,
      contrastLow: low.slice(0, 8),
      docOverflowPx: r.docOverflowPx,
      overflowElements: r.overflow.length,
      tinyTargets: r.small,
    };
    if (r.overlaps.length) fails.push(`${name}: ${r.overlaps.length} 处文本重叠`);
    if (low.length) fails.push(`${name}: ${low.length} 处对比度低于 AA`);
    if (r.docOverflowPx > 0 || r.overflow.length) fails.push(`${name}: 横向溢出（文档 ${r.docOverflowPx}px / 元素 ${r.overflow.length} 处）`);
  }

  // 移动端几何
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  for (const [name, url] of [["landing", `${BASE}/index.html`], ["app", `${BASE}/app.html`]]) {
    await m.goto(url, { waitUntil: "networkidle" });
    await m.waitForTimeout(500);
    const r = await m.evaluate(IN_PAGE);
    report[`mobile-${name}`] = {
      overlapCount: r.overlaps.length,
      docOverflowPx: r.docOverflowPx,
      overflowElements: r.overflow.length,
      tiny: r.small.length,
    };
    if (r.overlaps.length) fails.push(`mobile-${name}: ${r.overlaps.length} 处文本重叠`);
    if (r.docOverflowPx > 0 || r.overflow.length) fails.push(`mobile-${name}: 横向溢出（文档 ${r.docOverflowPx}px / 元素 ${r.overflow.length} 处）`);
  }

  await browser.close();
  console.log(JSON.stringify(report, null, 2));
  if (fails.length) { console.error("\nFAIL:\n" + fails.map((f) => " - " + f).join("\n")); process.exit(1); }
  console.log("\n几何验收：PASS（无重叠 / 对比度达标 / 无横向溢出）");
})();