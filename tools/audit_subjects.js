// 定版验收：科目切换换树 · 三条深链 · 节深链 · 数学章 KaTeX 真渲染
const { chromium } = require("/Users/start-h/Documents/Aurora/tools/node_modules/playwright-core");
const BASE = process.argv[2] || "http://127.0.0.1:8792";
const CHROME = "/Users/start-h/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

const KATEX = () => {
  const pane = document.getElementById("lesson");
  const txt = pane ? pane.innerText : "";
  return {
    katexNodes: pane ? pane.querySelectorAll(".katex").length : 0,
    rawDollarLeft: (txt.match(/\$/g) || []).length,
    rawLatexLeft: (txt.match(/\\frac|\\sqrt|\\times|\\cdot/g) || []).length,
  };
};

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars"] });
  const errs = [];
  const out = { pass: [], fail: [] };
  const chk = (ok, msg) => (ok ? out.pass : out.fail).push(msg);

  // 1) 科目切换真的换树
  const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto(`${BASE}/app.html`, { waitUntil: "networkidle" });
  await p.waitForTimeout(700);
  const seen = {};
  for (const s of ["数学", "物理", "化学"]) {
    await p.evaluate((x) => [...document.querySelectorAll("#subjTabs button")].find((n) => n.innerText.trim() === x).click(), s);
    await p.waitForTimeout(400);
    seen[s] = await p.evaluate(() => ({
      meta: (document.getElementById("subjMeta") || {}).innerText,
      cluster: (document.querySelector("#tree .tnode-cluster summary") || {}).innerText.split("\n")[0],
    }));
  }
  chk(new Set(Object.values(seen).map((v) => v.cluster)).size === 3, `三科树各不相同: ${JSON.stringify(seen)}`);

  // 2) 切换后第一节能开出该科应有栏数（数学 5 / 物理 5 / 化学 6）+ 标记按钮
  //    上一步循环停在「化学」，故此处按化学断言
  await p.evaluate(() => { const c = document.querySelector("#tree .tnode-cluster"); c.open = true;
    const ch = c.querySelector(".tnode-chap"); if (ch) ch.open = true; c.querySelector(".leaf-item").click(); });
  await p.waitForTimeout(700);
  const phys = await p.evaluate(() => ({
    title: (document.querySelector("#lesson .lesson-title") || {}).innerText,
    fields: [...document.querySelectorAll("#lesson .fld-l")].map((n) => n.innerText),
    markBtn: !!document.getElementById("markLearned"),
  }));
  chk(phys.fields.length >= 5 && phys.markBtn, `当前科首节渲染 ${phys.fields.length} 栏 + 标记按钮: ${JSON.stringify(phys)}`);
  await p.close();

  // 3) 三条 lab 深链（每次全新文档）
  for (const [id, want] of [["statics", "双绳吊装"], ["block", "板块"], ["induction", "电磁感应"]]) {
    const q = await b.newPage({ viewport: { width: 1440, height: 950 } });
    await q.goto(`${BASE}/app.html#lab=${id}`, { waitUntil: "networkidle" });
    await q.waitForTimeout(1500);
    const r = await q.evaluate(() => ({
      pane: (document.querySelector(".pane.on") || {}).id,
      canvas: document.querySelectorAll("#labHost canvas").length,
      tab: (document.querySelector("#labTabs .lt[aria-selected='true']") || {}).innerText || "",
      tutor: document.querySelectorAll("#labHost .tutor").length,
    }));
    chk(r.pane === "labPane" && r.canvas === 1 && r.tab.includes(want),
      `深链 #lab=${id}: pane=${r.pane} canvas=${r.canvas} tab=${r.tab} tutor=${r.tutor}`);
    await q.close();
  }

  // 4) 节深链 + 数学 KaTeX
  const sid = "物理|人教版高中物理 · 必修第一册（2019）|第一章 运动的描述|1.2";
  const q2 = await b.newPage({ viewport: { width: 1440, height: 950 } });
  await q2.goto(`${BASE}/app.html#s=${encodeURIComponent(sid)}`, { waitUntil: "networkidle" });
  await q2.waitForTimeout(1300);
  const dl = await q2.evaluate(() => ({
    pane: (document.querySelector(".pane.on") || {}).id,
    title: (document.querySelector("#lesson .lesson-title") || {}).innerText,
    fields: document.querySelectorAll("#lesson .fld").length,
  }));
  chk(dl.pane === "learnPane" && dl.fields === 5, `深链 #s=节: ${JSON.stringify(dl)}`);
  await q2.close();

  // 5) 数学章（含 $...$ 公式）KaTeX
  const q3 = await b.newPage({ viewport: { width: 1440, height: 950 } });
  await q3.goto(`${BASE}/app.html`, { waitUntil: "networkidle" });
  await q3.waitForTimeout(600);
  const mathRes = await q3.evaluate(async () => {
    const D = window.GEWU_DATA;
    const m = D.subjects.find((s) => s.name === "数学");
    // 找第一个 value 里真正含 $ 公式的节
    let found = null;
    for (const bk of m.books) for (const c of bk.chapters) for (const sec of c.sections)
      if (sec.fields.some((f) => /\$/.test(f.value))) { found = { bk: bk.title, c: c.title, sec }; break; }
    return found ? { book: found.bk, chap: found.c, num: found.sec.num, title: found.sec.title,
      formulaFields: found.sec.fields.filter((f) => /\$/.test(f.value)).map((f) => f.label) } : null;
  });
  let katex = null;
  if (mathRes) {
    await q3.evaluate((r) => {
      const id = ["数学", r.book, r.chap, r.num].join("|");
      location.hash = "s=" + encodeURIComponent(id);
      location.reload();
    }, mathRes);
    await q3.waitForTimeout(1500);
    katex = await q3.evaluate(KATEX);
    katex.title = await q3.evaluate(() => (document.querySelector("#lesson .lesson-title") || {}).innerText);
  }
  chk(katex && katex.katexNodes > 0 && katex.rawDollarLeft === 0,
    `数学公式渲染: ${JSON.stringify(mathRes && { num: mathRes.num, title: mathRes.title, fields: mathRes.formulaFields })} → ${JSON.stringify(katex)}`);
  await q3.close();

  await b.close();
  out.errors = errs;
  console.log(JSON.stringify(out, null, 1));
  if (out.fail.length || errs.length) process.exit(1);
  console.log("\n全绿");
})();
