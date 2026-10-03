/* 格物 · 落地页装配：把 summary.js 的真值渲染成地图/卡片/竞品墙，
   并把 hero 交互台（紧凑模式：只装仿真，不挂引导树）挂起来。 */
(function () {
  "use strict";

  const S = window.GEWU_SUMMARY;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  const CN = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一"];

  /* ── 顶部数字（真值，来自构建产物） ── */
  function paintStats() {
    const m = S.meta;
    document.getElementById("gateLine").textContent = "已过";
    document.title = `格物 · ${m.chapters} 章 ${m.entries} 条逐节要点 · 高考数理化真题实验室`;
  }

  /* ── 每科一张数据卡 ── */
  function paintLayers() {
    const box = document.getElementById("layerCards");
    box.innerHTML = "";
    S.subjects.forEach((s) => {
      const cls = s.name === "数学" ? "math" : s.name === "物理" ? "phys" : "chem";
      const books = s.books.length;
      const extra = s.extraCount ? `${s.bodyCount} 正文节 + ${s.extraCount} 栏目条` : `${s.bodyCount} 正文节`;
      const d = document.createElement("div");
      d.className = "layer " + cls;
      d.innerHTML =
        `<div class="n">${s.chapterCount}<small>章</small> / ${s.sectionCount}<small>条</small></div>` +
        `<div class="lb"><b>${esc(s.name)}</b> · ${books} 册 · ${s.clusterCount} 簇</div>` +
        `<div class="lb">${extra}</div>`;
      box.appendChild(d);
    });
  }

  /* ── 29 簇全量铺开（这就是「全域图式」的样子） ── */
  function paintClusters() {
    const box = document.getElementById("clusterGrid");
    box.innerHTML = "";
    S.subjects.forEach((s) => {
      s.clusters.forEach((c) => {
        const d = document.createElement("div");
        d.className = "cbox";
        const chaps = (c.chapters || []).map((x) => (typeof x === "string" ? x : x.title));
        const lodged = (c.lodged || []).length;
        let ch;
        if (chaps.length) {
          ch = esc(chaps.slice(0, 4).join(" · ")) + (chaps.length > 4 ? ` … 等 ${chaps.length} 章` : "");
          if (lodged) ch += `，另寄居 ${lodged} 节`;
        } else if (lodged) {
          ch = "整节寄居在本簇下，不占章";
        } else {
          ch = "贯穿式簇：不绑定具体章，随各章考查";
        }
        d.innerHTML =
          `<div class="top"><span class="nm">${esc(c.name)}</span><span class="ct">${esc(c.cnt)}</span></div>` +
          `<div class="q">${esc(c.q)}</div>` +
          `<div class="ch">${ch}</div>`;
        box.appendChild(d);
      });
    });
  }

  /* ── 真题实验室卡片（真挂了引擎的才给「打开」） ── */
  function paintLabs() {
    const box = document.getElementById("labGrid");
    box.innerHTML = "";
    window.GEWU_LAB.list().forEach((lab) => {
      const d = document.createElement("div");
      d.className = "labcard";
      d.innerHTML =
        `<h3>${esc(lab.title)}</h3>` +
        `<div class="exam">${esc(lab.exam)}</div>` +
        `<p>${esc(lab.brief)}</p>` +
        `<div class="covers">${lab.covers.map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div>`;
      const go = document.createElement("a");
      go.className = "btn primary small go";
      go.href = "app.html#lab=" + encodeURIComponent(lab.id);
      go.textContent = "在课程页里做这道题";
      d.appendChild(go);
      box.appendChild(d);
    });
  }

  /* ── 竞品墙 ── */
  const RIVALS = [
    { img: "xueersi.jpg", name: "学而思学习机（九章）", price: "硬件 ¥3098+",
      did: "体系课 + 3 亿题库，3D 演示做得很漂亮。",
      gap: "3D 是「看动画」不是「玩参数」——学生动不了手，规律还是被告诉的。", st: "part" },
    { img: "iflytek.jpg", name: "科大讯飞学习机", price: "¥5999–11999",
      did: "板书式 AI 讲题 + 精准学，B2G 渠道独大。",
      gap: "讲题 ≠ 场景；万元定价也在流失家长信任。", st: "part" },
    { img: "nobook.jpg", name: "NOBOOK / 矩道 虚拟实验", price: "B2B · 26000 校",
      did: "仿真引擎成熟，实验场景做得真。",
      gap: "仿真的是「实验」，不是「解题思路」；且没有个性化层。", st: "part" },
    { img: "khanmigo.jpg", name: "Khanmigo（Khan Academy）", price: "$4 / 月",
      did: "Gemini 现场生成可拖拽交互图，学生拖、系统实时反应——可视化的天花板。",
      gap: "无中国考纲、无中文生活语境、无理化实验。", st: "part" },
    { img: "squirrelai.jpg", name: "松鼠 AI（LAM）", price: "智适应",
      did: "知识图谱做得细，最接近「集中化覆盖」。",
      gap: "无场景、无可视化，学生还是在抽象符号里打转。", st: "gap" }
  ];

  function paintWall() {
    const box = document.getElementById("vsWall");
    box.innerHTML = "";
    RIVALS.forEach((r) => {
      const d = document.createElement("figure");
      d.className = "shot";
      d.innerHTML =
        `<img src="assets/img/${r.img}" alt="${esc(r.name)} 官网截图" width="1200" height="760" loading="lazy">` +
        `<figcaption class="cap"><b>${esc(r.name)}</b>` +
        `<span>${esc(r.price)}</span>` +
        `<span>做到：${esc(r.did)}</span>` +
        `<span>没做透：${esc(r.gap)}</span>` +
        `<span class="st ${r.st}">${r.st === "gap" ? "另一条路" : "部分做到"}</span></figcaption>`;
      box.appendChild(d);
    });
  }

  /* ── hero 交互台（紧凑模式：只有图 + 控件 + 结论，无引导树） ── */
  function mountHero() {
    const bench = document.getElementById("heroBench");
    const stage = document.createElement("div");
    stage.id = "heroStage";
    bench.appendChild(stage);
    window.GEWU_LAB.mount(stage, "statics", { first: 0, total: 0 },
      { compact: true, height: 300 });
  }

  document.addEventListener("DOMContentLoaded", () => {
    paintStats();
    paintLayers();
    paintClusters();
    paintLabs();
    paintWall();
    mountHero();
    if (window.renderMathInElement) {
      window.renderMathInElement(document.body, {
        delimiters: [{ left: "$$", right: "$$", display: true },
                     { left: "$", right: "$", display: false }],
        throwOnError: false
      });
    }
  });
})();
