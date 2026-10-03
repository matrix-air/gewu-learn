/* 格物 · 学习台装配
   左：知识树（科 → 簇 → 章 → 节，含寄居节）
   右：知识地图 / 逐节课程页 / 真题实验室
   进度：localStorage（键前缀 gewu.），不上传 */
(function () {
  "use strict";

  const DATA = window.GEWU_DATA;
  const SUBJECTS = DATA.subjects;
  const LABS = window.GEWU_LAB.list();

  /* ───────── 工具 ───────── */
  const $ = (id) => document.getElementById(id);
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  // 册标题 → 规范短名（与构建脚本一致）：必一 / 必二 / 必三 / 选必一 …
  function canonBook(title) {
    const m = (title || "").match(/(选择性必修|必修)(第[一二三四五]册)/);
    if (!m) return "";
    return (m[1] === "选择性必修" ? "选必" : "必") + m[2][1];
  }
  // 章号：'第一章 运动的描述' → '第一章'
  function chapNo(t) {
    const m = (t || "").match(/^(第[一二三四五六七八九十百]+章)/);
    return m ? m[1] : "";
  }
  function sectionId(subj, book, chap, sec) {
    return [subj, book, chap, sec.num || sec.title].join("|");
  }

  /* ───────── 索引：把 curriculum 拍平成可查表 ───────── */
  const IDX = { bySubject: {}, all: [] };

  SUBJECTS.forEach((s) => {
    const books = s.books;
    const clusters = s.clusters.map((c) => ({
      name: c.name, q: c.q, cnt: c.cnt, lodged: c.lodged || [],
      chapters: [],   // {book, title, chapObj, sections}
    }));

    // 章 → 实际章对象（按 册短名+章号 定位，与构建脚本同一套键）
    const chapLookup = {};
    books.forEach((b) => {
      b.chapters.forEach((c) => { chapLookup[canonBook(b.title) + "|" + chapNo(c.title)] = { book: b, chap: c }; });
    });

    // 每个章只挂进它的第一个簇；后续簇用「引用章」标注，避免同一章重复铺开
    const claimed = {};
    clusters.forEach((cl) => {
      const src = s.clusters.find((x) => x.name === cl.name);
      (src.chapters || []).forEach((ch) => {
        const key = ch.book + "|" + chapNo(ch.title);
        const hit = chapLookup[key];
        if (!hit) return;
        const cid = canonBook(hit.book.title) + "|" + hit.chap.title;
        if (claimed[cid]) { cl.refChapters = (cl.refChapters || []).concat([ch.title]); return; }
        claimed[cid] = true;
        cl.chapters.push({ book: hit.book, chap: hit.chap, bookShort: ch.book });
      });
    });

    // 寄居节：把 (册,章号,节号) 解析成真实 section 对象
    clusters.forEach((cl) => {
      cl.lodgedResolved = cl.lodged.map((lg) => {
        const ref = lg.ref;   // ['必一','第二章'] 或 null
        if (!ref) return null;
        const hit = chapLookup[ref[0] + "|" + ref[1]];
        if (!hit) return null;
        const sec = hit.chap.sections.find((x) => x.num === lg.num);
        if (!sec) return null;
        return { book: hit.book, chap: hit.chap, sec: sec, num: lg.num, text: lg.text };
      }).filter(Boolean);
    });

    IDX.bySubject[s.name] = { meta: s, clusters: clusters };

    // 全量节榜单（供搜索与进度分母）
    books.forEach((b) => {
      const bs = canonBook(b.title);
      const walk = (list, chapTitle) => list.forEach((sec) => {
        IDX.all.push({
          subject: s.name, book: b.title, bookShort: bs, chapter: chapTitle,
          num: sec.num, title: sec.title, kind: sec.kind, sec: sec,
          id: sectionId(s.name, b.title, chapTitle, sec),
        });
      });
      b.chapters.forEach((c) => walk(c.sections, c.title));
      (b.front || []).forEach((sec) => {
        IDX.all.push({
          subject: s.name, book: b.title, bookShort: bs, chapter: "册首",
          num: sec.num, title: sec.title, kind: "extra", sec: sec,
          id: sectionId(s.name, b.title, "册首", sec),
        });
      });
    });
  });

  const TOTAL_SECTIONS = IDX.all.length;   // 应等于 300（正文 258 + 栏目 42）

  /* ───────── 进度（localStorage） ───────── */
  const PKEY = "gewu.progress";
  const LKEY = "gewu.last";
  let learned = {};
  try { learned = JSON.parse(localStorage.getItem(PKEY) || "{}") || {}; } catch (e) { learned = {}; }

  function saveProgress() {
    try { localStorage.setItem(PKEY, JSON.stringify(learned)); } catch (e) { /* 隐私模式忽略 */ }
  }
  function learnedCount() { return Object.keys(learned).length; }
  function paintProgress() {
    const n = learnedCount();
    const pct = TOTAL_SECTIONS ? Math.round((n / TOTAL_SECTIONS) * 100) : 0;
    const b = $("progressBadge");
    if (b) b.textContent = `已学 ${n} / ${TOTAL_SECTIONS} 节`;
    const l = $("progLabel"), p = $("progPct"), bar = $("progBar");
    if (l) l.textContent = `${n} / ${TOTAL_SECTIONS}`;
    if (p) p.textContent = pct + "%";
    if (bar) bar.style.width = pct + "%";
  }

  /* ───────── 左树 ───────── */
  let curSubject = "物理";

  function paintSubjectTabs() {
    const box = $("subjTabs");
    box.innerHTML = "";
    SUBJECTS.forEach((s) => {
      const b = el("button", "tab", esc(s.name));
      b.dataset.s = s.name;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(s.name === curSubject));
      b.addEventListener("click", () => { curSubject = s.name; renderAll(); });
      box.appendChild(b);
    });
    const s = SUBJECTS.find((x) => x.name === curSubject);
    $("subjMeta").innerHTML =
      `${s.books.length} 册 · ${s.clusterCount} 簇 · ${s.chapterCount} 章 · ` +
      `${s.bodyCount} 正文节` + (s.extraCount ? ` + ${s.extraCount} 栏目条` : "");
  }

  function leafButton(rec) {
    const b = el("button", "leaf-item" + (rec.kind === "extra" ? " extra" : ""));
    b.dataset.id = rec.id;
    b.dataset.q = (rec.num + " " + rec.title + " " + rec.chapter + " " + rec.book).toLowerCase();
    b.innerHTML = (rec.num ? `<span class="num">${esc(rec.num)}</span>` : "") + esc(rec.title);
    if (learned[rec.id]) b.classList.add("done");
    b.addEventListener("click", () => openLesson(rec.id));
    return b;
  }

  function findRec(subject, bookTitle, chapTitle, num, title) {
    return IDX.all.find((r) => r.subject === subject && r.book === bookTitle &&
      r.chapter === chapTitle && (num ? r.num === num : r.title === title));
  }

  function renderTree() {
    const box = $("tree");
    box.innerHTML = "";
    const pack = IDX.bySubject[curSubject];

    pack.clusters.forEach((cl, ci) => {
      const d = el("details", "tnode-cluster");
      d.dataset.q = (cl.name + " " + cl.q + " " + (cl.cnt || "")).toLowerCase();
      if (ci === 0) d.open = true;

      const sum = el("summary");
      sum.innerHTML = `<span>${esc(cl.name)}</span><span class="cl-meta">${esc(cl.cnt || "")}</span>`;
      d.appendChild(sum);
      if (cl.q) d.appendChild(el("div", "cl-q", esc(cl.q)));

      // 章
      cl.chapters.forEach((cw) => {
        const cd = el("details", "tnode-chap");
        const star = cw.chap.star ? `<span class="st">${esc(cw.chap.star)}</span>` : "";
        const cs = el("summary");
        cs.innerHTML = `<span>${esc(cw.bookShort)} · ${esc(cw.chap.title)}</span>${star}`;
        cd.dataset.q = (cw.chap.title + " " + cw.book.title).toLowerCase();
        cd.appendChild(cs);
        const lst = el("div", "leaf-list");
        cw.chap.sections.forEach((sec) => {
          const rec = findRec(curSubject, cw.book.title, cw.chap.title, sec.num, sec.title);
          if (rec) lst.appendChild(leafButton(rec));
        });
        cd.appendChild(lst);
        d.appendChild(cd);
      });

      // 寄居节（整节挂在簇下、不占章）
      cl.lodgedResolved.forEach((lg) => {
        const lst = el("div", "leaf-list");
        const rec = findRec(curSubject, lg.book.title, lg.chap.title, lg.sec.num, lg.sec.title);
        if (rec) lst.appendChild(leafButton(rec));
        if (lst.children.length) d.appendChild(lst);
      });

      // 引用章（该章已铺在别的簇下）
      if (cl.refChapters && cl.refChapters.length) {
        d.appendChild(el("div", "cl-q", "交叉：" + esc(cl.refChapters.join(" · "))));
      }

      box.appendChild(d);
    });
  }

  /* ───────── 搜索 ───────── */
  function applySearch(q) {
    const query = (q || "").trim().toLowerCase();
    const box = $("tree");
    const hint = $("qHint");
    if (!query) {
      box.querySelectorAll(".tnode-cluster, .tnode-chap, .leaf-item").forEach((n) => { n.hidden = false; });
      box.querySelectorAll("details").forEach((n) => { n.open = false; });
      const first = box.querySelector(".tnode-cluster"); if (first) first.open = true;
      hint.textContent = "输入关键字，左树只留命中项";
      return;
    }
    let leafHits = 0;
    box.querySelectorAll(".leaf-item").forEach((n) => {
      const ok = (n.dataset.q || "").includes(query);
      n.hidden = !ok; if (ok) leafHits++;
    });
    box.querySelectorAll(".tnode-chap").forEach((n) => {
      const hasLeaf = Array.from(n.querySelectorAll(".leaf-item")).some((x) => !x.hidden);
      const self = (n.dataset.q || "").includes(query);
      n.hidden = !(hasLeaf || self);
      if (!n.hidden) n.open = true;
    });
    box.querySelectorAll(".tnode-cluster").forEach((n) => {
      const hasKid = Array.from(n.querySelectorAll(".tnode-chap")).some((x) => !x.hidden);
      const hasLeaf = Array.from(n.querySelectorAll(".leaf-item")).some((x) => !x.hidden);
      const self = (n.dataset.q || "").includes(query);
      n.hidden = !(hasKid || hasLeaf || self);
      if (!n.hidden) n.open = true;
    });
    hint.textContent = `命中 ${leafHits} 节`;
  }

  /* ───────── 右：课程页 ───────── */
  let curLessonId = null;

  function subjectCls(s) { return s === "数学" ? "math" : s === "物理" ? "phys" : "chem"; }

  function openLesson(id) {
    const rec = IDX.all.find((r) => r.id === id);
    if (!rec) return;
    curLessonId = id;
    try { localStorage.setItem(LKEY, id); } catch (e) { /* ignore */ }

    const pane = $("lesson");
    const isHL = rec.sec.fields.some((f) => f.label === "高考接口");
    const starChip = rec.sec.fields.find((f) => f.label === "高考接口");

    pane.innerHTML = "";
    const head = el("div", "lesson-head");
    head.innerHTML =
      `<div class="lesson-title">` +
      (rec.num ? `<span class="lesson-num">${esc(rec.num)}</span>` : "") +
      `${esc(rec.title)}</div>` +
      `<div class="lesson-meta">` +
      `<span class="chip ${subjectCls(rec.subject)}">${esc(rec.subject)}</span>` +
      `<span class="chip">${esc(rec.book.replace(/（2019）/, ""))}</span>` +
      `<span class="chip">${esc(rec.chapter)}</span>` +
      (rec.kind === "extra" ? `<span class="chip">栏目</span>` : "") +
      `<span class="srcline">来源：${esc(DATA.meta.source)}</span>` +
      `</div>`;
    pane.appendChild(head);

    if (!rec.sec.fields.length) {
      pane.appendChild(el("div", "empty", "这一条暂无要点（构建层未抽取到栏位）。"));
    } else {
      const box = el("div", "fields");
      rec.sec.fields.forEach((f) => {
        const isInterface = f.label === "高考接口";
        const d = el("div", "fld" + (isInterface ? " hl" : ""));
        d.innerHTML = `<div class="fld-l">${esc(f.label)}</div><div class="fld-v">${esc(f.value)}</div>`;
        box.appendChild(d);
      });
      pane.appendChild(box);
    }

    // 操作区
    const act = el("div", "lesson-actions");
    const mk = el("button", "btn primary", learned[rec.id] ? "✓ 已学（点击取消）" : "标记为已学");
    mk.id = "markLearned";
    mk.addEventListener("click", () => {
      if (learned[rec.id]) delete learned[rec.id]; else learned[rec.id] = new Date().toISOString();
      saveProgress(); paintProgress(); refreshLeafMarks();
      mk.textContent = learned[rec.id] ? "✓ 已学（点击取消）" : "标记为已学";
    });
    act.appendChild(mk);

    // 上一节 / 下一节
    const pos = IDX.all.findIndex((r) => r.id === rec.id);
    const prev = IDX.all.slice(0, pos).reverse().find((r) => r.subject === rec.subject);
    const next = IDX.all.slice(pos + 1).find((r) => r.subject === rec.subject);
    if (prev) {
      const p = el("button", "btn", "← " + (prev.num ? prev.num + " " : "") + esc(prev.title));
      p.addEventListener("click", () => openLesson(prev.id));
      act.appendChild(p);
    }
    if (next) {
      const n = el("button", "btn", (next.num ? next.num + " " : "") + esc(next.title) + " →");
      n.addEventListener("click", () => openLesson(next.id));
      act.appendChild(n);
    }
    act.appendChild(el("span", "note",
      `本科共 ${IDX.all.filter((r) => r.subject === rec.subject).length} 条 · ${esc(rec.bookShort)} · ${esc(rec.chapter)}`));
    pane.appendChild(act);

    $("crust").innerHTML = `逐节学习 · <b>${esc(rec.subject)}</b> · ${esc(rec.chapter)}`;
    showView("learn");
    highlightTree(rec.id);
    if (window.renderMathInElement) {
      window.renderMathInElement(pane, {
        delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }],
        throwOnError: false,
      });
    }
  }

  function refreshLeafMarks() {
    document.querySelectorAll("#tree .leaf-item").forEach((n) => {
      n.classList.toggle("done", !!learned[n.dataset.id]);
    });
  }

  function highlightTree(id) {
    document.querySelectorAll("#tree .leaf-item").forEach((n) => {
      n.setAttribute("aria-current", String(n.dataset.id === id));
    });
    const cur = document.querySelector('#tree .leaf-item[aria-current="true"]');
    if (cur) {
      const d = cur.closest("details");
      let p = d;
      while (p) { if (p.tagName === "DETAILS") p.open = true; p = p.parentElement ? p.parentElement.closest("details") : null; }
      cur.scrollIntoView({ block: "nearest" });
    }
  }

  /* ───────── 视图切换 ───────── */
  function showView(name) {
    ["map", "learn", "lab"].forEach((v) => {
      const p = $(v + "Pane"); if (p) p.classList.toggle("on", v === name);
    });
    document.querySelectorAll("#viewTabs a").forEach((a) => {
      a.setAttribute("aria-current", String(a.dataset.view === name));
    });
    if (name === "map") $("crust").innerHTML = "知识地图";
    if (name === "lab") $("crust").innerHTML = "真题实验室";
  }

  /* ───────── 知识地图 pane ───────── */
  function paintOverview() {
    const box = $("ovGrid");
    box.innerHTML = "";
    SUBJECTS.forEach((s) => {
      const d = el("div", "ov " + subjectCls(s.name));
      const mine = IDX.all.filter((r) => r.subject === s.name);
      const done = mine.filter((r) => learned[r.id]).length;
      const pct = mine.length ? Math.round(done / mine.length * 100) : 0;
      d.innerHTML =
        `<div class="big">${s.sectionCount}<small>条</small></div>` +
        `<div class="lb"><b>${esc(s.name)}</b> · ${s.books.length} 册 · ${s.clusterCount} 簇 · ${s.chapterCount} 章</div>` +
        `<div class="lb">${s.bodyCount} 正文节${s.extraCount ? ` + ${s.extraCount} 栏目条` : ""} · 已学 ${done}（${pct}%）</div>` +
        `<div class="bar-wrap"><div class="bar" style="width:${pct}%"></div></div>`;
      box.appendChild(d);
    });
    const tot = el("div", "ov");
    tot.innerHTML =
      `<div class="big">${DATA.meta.entries}<small>条</small></div>` +
      `<div class="lb"><b>合计</b> · 16 册 · ${DATA.meta.clusters} 簇 · ${DATA.meta.chapters} 章</div>` +
      `<div class="lb">正文 ${DATA.meta.bodySections} + 栏目 ${DATA.meta.extras} · 已学 ${learnedCount()}</div>`;
    box.appendChild(tot);
  }

  function paintFieldMap() {
    const box = $("fieldMap");
    box.innerHTML = "";
    const bySubj = {};
    SUBJECTS.forEach((s) => {
      const set = new Set();
      s.books.forEach((b) => b.chapters.forEach((c) => c.sections.forEach((sec) =>
        sec.fields.forEach((f) => set.add(f.label)))));
      bySubj[s.name] = Array.from(set);
    });
    const MAIN = {
      "数学": ["定义与对象", "公式与结论", "方法与技能", "教材栏目线索", "高考接口"],
      "物理": ["定义与对象", "公式与规律", "模型与方法", "实验要点", "教材栏目线索", "高考接口"],
      "化学": ["核心概念", "关键方程式", "性质与转化", "实验要点", "教材栏目线索", "高考接口"],
    };
    SUBJECTS.forEach((s) => {
      const extra = bySubj[s.name].filter((x) => !MAIN[s.name].includes(x));
      const d = el("div");
      d.innerHTML = `<b>${esc(s.name)} · ${MAIN[s.name].length} 主栏</b>` +
        MAIN[s.name].map(esc).join(" → ") +
        (extra.length ? `<br><span style="color:var(--dim)">栏目条目另用：${extra.map(esc).join(" / ")}</span>` : "");
      box.appendChild(d);
    });
    const note = el("div");
    note.innerHTML = `<b>机器门</b>校验册数 / 章数 / 簇数 / 正文节 / 栏目条 / 章→簇归属 / 栏位完整性，` +
      `缺一项退出码 1（<code>tools/check_data.py</code>）。当前数据：${DATA.meta.chapters} 章 · ` +
      `${DATA.meta.clusters} 簇 · ${DATA.meta.entries} 条，全部通过。`;
    box.appendChild(note);
  }

  /* ───────── 实验室 pane ───────── */
  let labMounted = null;

  function paintLabTabs() {
    const box = $("labTabs");
    box.innerHTML = "";
    LABS.forEach((lab) => {
      const b = el("button", "lt", esc(lab.title));
      b.setAttribute("role", "tab");
      b.dataset.lab = lab.id;
      b.addEventListener("click", () => mountLab(lab.id));
      box.appendChild(b);
    });
  }

  function mountLab(id) {
    document.querySelectorAll("#labTabs .lt").forEach((n) => {
      n.setAttribute("aria-selected", String(n.dataset.lab === id));
    });
    if (labMounted && labMounted.destroy) labMounted.destroy();
    const host = $("labHost");
    labMounted = window.GEWU_LAB.mount(host, id, { first: 0, total: 0 }, {});
    const lab = LABS.find((x) => x.id === id);
    $("crust").innerHTML = `真题实验室 · <b>${esc(lab.exam)}</b>`;
    showView("lab");
  }

  /* ───────── 装配 ───────── */
  function renderAll() {
    paintSubjectTabs();
    renderTree();
    applySearch($("q").value);
    refreshLeafMarks();
    paintOverview();
    paintProgress();
    const last = (() => { try { return localStorage.getItem(LKEY); } catch (e) { return null; } })();
    if (last && IDX.all.some((r) => r.id === last)) {
      const keep = last;
      // 恢复上次打开的节（不切换视图，避免一进来就跳走）
      const rec = IDX.all.find((r) => r.id === keep);
      if (rec && rec.subject !== curSubject) { curSubject = rec.subject; paintSubjectTabs(); renderTree(); applySearch($("q").value); refreshLeafMarks(); }
      openLesson(keep);
      showView("map");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    paintFieldMap();
    renderAll();
    paintLabTabs();

    $("q").addEventListener("input", () => applySearch($("q").value));
    $("expandAll").addEventListener("click", () => {
      document.querySelectorAll("#tree details").forEach((d) => { d.open = true; });
    });
    $("collapseAll").addEventListener("click", () => {
      document.querySelectorAll("#tree details").forEach((d) => { d.open = false; });
    });
    $("clearProgress").addEventListener("click", () => {
      learned = {};
      saveProgress(); paintProgress(); paintOverview(); refreshLeafMarks();
      const mk = $("markLearned");
      if (mk) mk.textContent = "标记为已学";
    });

    document.querySelectorAll("#viewTabs a").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const v = a.dataset.view;
        if (v === "lab" && !document.querySelector("#labTabs .lt[aria-selected='true']")) {
          mountLab(LABS[0].id);
        } else showView(v);
        if (v === "map") paintOverview();
      });
    });

    // 深链：#lab=<id>  或  #s=<sectionId>
    const h = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (h.startsWith("lab=")) {
      const id = h.slice(4);
      if (LABS.some((x) => x.id === id)) mountLab(id);
    } else if (h.startsWith("s=")) {
      const id = h.slice(2);
      if (IDX.all.some((r) => r.id === id)) openLesson(id);
    }
  });
})();
