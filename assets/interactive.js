/* 格物 · 交互引擎（真题演示台）
   来源：analysis/gaokao-physics-khanmigo-replica/index.html 的三个 canvas 物理引擎与引导树，
   端口化改写：实例自持 canvas/控件/引导状态，可挂进任意容器，多实例互不干扰。
   物理口径与原页完全一致（原页 10/10 测试过）；只改装配方式，不改公式。
   暴露：window.GEWU_LAB = { list(), mount(container, id) } */
(function () {
  "use strict";

  /* ───────── 最小 DOM 工具（实例内自用，不污染全局） ───────── */
  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function drawArrow(g, x1, y1, x2, y2, color, width) {
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = width || 2.5;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.lineWidth = 1;
    const th = Math.atan2(y2 - y1, x2 - x1);
    g.beginPath(); g.moveTo(x2, y2);
    g.lineTo(x2 - 10 * Math.cos(th - 0.4), y2 - 10 * Math.sin(th - 0.4));
    g.lineTo(x2 - 10 * Math.cos(th + 0.4), y2 - 10 * Math.sin(th + 0.4));
    g.closePath(); g.fill();
  }

  function grid(g, w, h) {
    g.strokeStyle = "#232a33";
    for (let x = 0; x < w; x += 28) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 28) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }

  function fit(cv) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 600, h = +cv.dataset.h;
    cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, w, h };
  }

  const c = {
    ink: "#ececec", dim: "#8b8b8b", line: "#3b3b3b",
    accent: "#2b8cff", signal: "#00e5ff", badge: "#a020a0"
  };

  /* ═══════════ 通用：引导树渲染器 ═══════════ */
  function makeTutor(box, tree, stats) {
    if (!box) return null;   // 紧凑模式：只装仿真、不挂引导树
    const st = { step: 0, numericDone: false };
    function render() {
      box.innerHTML = "";
      if (st.step < tree.steps.length) {
        const s = tree.steps[st.step];
        const m = el("div", "msg tutor");
        m.appendChild(el("div", "bubble", "<b>导师：</b>" + s.q));
        box.appendChild(m);
        const ol = el("div", "opts");
        s.opts.forEach((o, i) => {
          const b = el("button", "opt", String.fromCharCode(65 + i) + "．" + o.t);
          b.addEventListener("click", () => {
            stats.total++;
            if (o.ok) {
              stats.first++; b.classList.add("ok");
              Array.from(ol.children).forEach((x) => { x.disabled = true; });
              box.appendChild(el("div", "fb ok", "✓ " + o.fb));
              st.step++; setTimeout(render, 320);
            } else {
              b.classList.add("no"); b.disabled = true;
              box.appendChild(el("div", "fb no", "× " + o.fb + " 再想想，或换个选项。"));
            }
          });
          ol.appendChild(b);
        });
        box.appendChild(ol);
        return;
      }
      if (!st.numericDone) {
        const m = el("div", "msg tutor");
        m.appendChild(el("div", "bubble", "思路通了。现在把<b>真题数值</b>算出来（可回看左边的交互图 / 仿真核对）："));
        box.appendChild(m);
        tree.numeric.forEach((n, i) => {
          const row = el("div", "numeric");
          row.appendChild(el("span", null, (i + 1) + ". " + n.label));
          const inp = el("input"); inp.type = "number"; inp.step = "any"; inp.setAttribute("aria-label", n.label);
          row.appendChild(inp);
          row.appendChild(el("span", "unit", n.unit));
          const btn = el("button", "btn small", "校验");
          btn.addEventListener("click", () => {
            const val = parseFloat(inp.value);
            let out = row.querySelector(".sol");
            if (!out) { out = el("div", "sol"); row.appendChild(out); }
            out.textContent = (val !== null && Math.abs(val - n.ans) <= n.tol ? "✓ 正确｜" : "× 再算算｜") + n.sol;
          });
          row.appendChild(btn);
          box.appendChild(row);
        });
        const wrap = el("div", "variant");
        const gen = el("button", "btn small", "生成变式题（同技能 · 随机数，判分公式公开）");
        const slot = el("div", "var-slot");
        wrap.appendChild(gen); wrap.appendChild(slot);
        gen.addEventListener("click", () => {
          const v = tree.variant();
          slot.innerHTML = "";
          slot.appendChild(el("p", "vt", v.text));
          const row = el("div", "numeric");
          const inp = el("input"); inp.type = "number"; inp.step = "any";
          inp.setAttribute("aria-label", "变式作答");
          row.appendChild(inp); row.appendChild(el("span", "unit", v.unit));
          const b = el("button", "btn small", "校验");
          const out = el("div", "sol");
          b.addEventListener("click", () => {
            const val = parseFloat(inp.value);
            out.textContent = (val !== null && Math.abs(val - v.ans) <= v.tol ? "✓ 正确｜" : "× 再算算｜") + v.sol;
          });
          row.appendChild(b); slot.appendChild(row); slot.appendChild(out);
        });
        st.numericDone = true;
      }
    }
    render();
    return st;
  }

  /* ═══════════ ① 静力学：双绳吊装（2024 新课标 24） ═══════════ */
  const TREE_P1 = {
    steps: [
      { q: "重物被「缓慢」竖直下降——这个「缓慢」在物理上意味着什么？", opts: [
        { t: "加速度可忽略，每一时刻都可当作平衡态来分析", ok: 1, fb: "对。缓变过程 = 准静态，任意瞬间三力平衡。" },
        { t: "速度严格等于零", ok: 0, fb: "缓慢下降仍有速度，只是加速度≈0——差别就在这里。" },
        { t: "动能不断减小", ok: 0, fb: "匀速缓降动能不变。抓住「加速度≈0」才是要点。" }] },
      { q: "对结点 O 做受力分析，O 受哪几个力？", opts: [
        { t: "绳 P 拉力、绳 Q 拉力、悬挂重物对它的拉力（大小=重力）", ok: 1, fb: "正确，三力汇交于 O。" },
        { t: "两个拉力和一个支持力", ok: 0, fb: "结点悬空，没有支持力。" },
        { t: "只有两个绳的拉力", ok: 0, fb: "漏了重物通过吊索传下来的力（大小为 G）。" }] },
      { q: "沿哪两个方向正交分解最顺手？", opts: [
        { t: "水平 + 竖直", ok: 1, fb: "对。两个未知量各占一个方程：水平解耦、竖直配重。" },
        { t: "沿 P 绳方向 + 垂直 P 绳方向", ok: 0, fb: "可行但 F_Q 会同时出现在两个方程里，不如正交干净。" },
        { t: "任意方向结果都一样，不用挑", ok: 0, fb: "数学上等价，但「好方向」让两个未知量逐个解耦——这是解题速度的关键。" }] },
      { q: "水平方向的平衡方程应该是（α、β 为与竖直方向夹角）——", opts: [
        { t: "F_P·sinα = F_Q·sinβ", ok: 1, fb: "正是官方解析第一条：0.6F_P = 0.8F_Q。" },
        { t: "F_P·cosα = F_Q·cosβ", ok: 0, fb: "那是把竖直分量拿去配平了——cos 对应竖直（与竖直夹角），别混。" },
        { t: "F_P·tanα = F_Q·tanβ", ok: 0, fb: "tan 是组合量，平衡方程要用正交分量 sin/cos。" }] },
      { q: "联立解出 F_Q，表达式的分母是——", opts: [
        { t: "sin(β−α)", ok: 1, fb: "对：F_Q = G·sinα/sin(β−α)。分母变小拉力就爆炸——这就是交互图里你看到的现象。" },
        { t: "sin(α+β)", ok: 0, fb: "符号错了：两力水平分量相消、竖直分量同侧相减，差角才对。" },
        { t: "cos(β−α)", ok: 0, fb: "三角函数选错：从消元过程出来的是 sin(β−α)。" }] }
    ],
    numeric: [
      { label: "F_Q（用官方近似口径，N）", ans: 900, tol: 8, unit: "N", sol: "F_Q = 420×0.6/0.28 ≈ 900 N" },
      { label: "F_P（N）", ans: 1200, tol: 12, unit: "N", sol: "F_P = F_Q×sinβ/sinα = 900×0.8/0.6 = 1200 N" },
      { label: "缓降 10 m 两绳拉力做功代数和 W（J，带符号）", ans: -4200, tol: 30, unit: "J", sol: "W = −G·h = −420×10 = −4200 J（拉力向上、位移向下，做负功）" }
    ],
    variant: function () {
      const G = [360, 420, 480, 540][Math.floor(Math.random() * 4)];
      return {
        text: "变式：G=" + G + " N，α、β 不变（37°/53°），求 F_Q（官方近似口径，N）。",
        ans: G * 0.6 / 0.28, tol: G * 0.6 / 0.28 * 0.03 + 1, unit: "N",
        sol: "F_Q = G·sinα/sin(β−α) ≈ " + G + "×0.6/0.28 ≈ " + (G * 0.6 / 0.28).toFixed(0) + " N"
      };
    }
  };

  function mountStatics(host, stats, opts) {
    opts = opts || {};
    const S = { alpha: 37 * Math.PI / 180, beta: 53 * Math.PI / 180, G: 420, drag: false };

    const canvas = el("canvas"); canvas.dataset.h = String(opts.height || 420);
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "双绳吊装受力图，可拖动蓝色手柄改变 α 角");

    const ctr = el("div", "controls");
    function slider(label, min, max, val, step, unit, onIn) {
      const lb = el("label");
      lb.appendChild(document.createTextNode(label + " "));
      const inp = el("input"); inp.type = "range"; inp.min = min; inp.max = max;
      inp.step = step; inp.value = val;
      const out = el("span", "val");
      out.textContent = onIn(val);          // 初值立刻可见，不留空标签
      lb.appendChild(inp); lb.appendChild(out);
      inp.addEventListener("input", () => { out.textContent = onIn(+inp.value); paint(); });
      ctr.appendChild(lb);
      return { inp, out, set: (v) => { inp.value = v; out.textContent = onIn(+v); } };
    }
    const sA = slider("α", 12, 50, 37, 0.5, "°", (v) => { S.alpha = v * Math.PI / 180; return v.toFixed(1) + "°"; });
    const sB = slider("β", 42, 70, 53, 0.5, "°", (v) => { S.beta = v * Math.PI / 180; return v.toFixed(1) + "°"; });
    const sG = slider("G", 200, 800, 420, 10, "N", (v) => { S.G = v; return v + " N"; });
    const reset = el("button", "btn small primary", "复位到真题角度");
    reset.addEventListener("click", () => {
      S.alpha = 37 * Math.PI / 180; S.beta = 53 * Math.PI / 180; S.G = 420;
      sA.set(37); sB.set(53); sG.set(420); paint();
    });
    ctr.appendChild(reset);

    const verdict = el("div", "verdict");
    const explore = el("div", "explore",
      "探索任务：把 α 拖到 50° 附近（β=53°）——两绳接近共线，F_Q 发散。这正是 sin(β−α) 出现在分母里的物理含义。");

    function setAFromEvent(e) {
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const cx = r.width * 0.44, cy = +canvas.dataset.h * 0.44;
      let ang = Math.atan2(mx - cx, cy - my);
      ang = Math.max(12 * Math.PI / 180, Math.min(50 * Math.PI / 180, ang));
      S.alpha = ang;
      sA.set((ang * 180 / Math.PI).toFixed(1));
      paint();
    }
    canvas.addEventListener("pointerdown", (e) => {
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const cx = r.width * 0.44, cy = +canvas.dataset.h * 0.44, a = S.alpha;
      const px = cx + Math.sin(a) * 150, py = cy - Math.cos(a) * 150;
      if (Math.hypot(mx - px, my - py) < 26) { S.drag = true; canvas.setPointerCapture(e.pointerId); }
    });
    canvas.addEventListener("pointermove", (e) => { if (S.drag) setAFromEvent(e); });
    canvas.addEventListener("pointerup", () => { S.drag = false; });
    canvas.addEventListener("pointercancel", () => { S.drag = false; });

    // 紧凑模式（落地页 hero）：只出 canvas + 控件 + 结论，不套面板壳与引导树
    if (opts.compact) {
      canvas.dataset.h = String(opts.height || 300);
      verdict.id = "heroVerdict";
      host.appendChild(canvas);
      host.appendChild(ctr);
      host.appendChild(verdict);
      paint();
      const onR = () => paint();
      window.addEventListener("resize", onR);
      return { destroy: () => { window.removeEventListener("resize", onR); } };
    }

    const sim = el("div", "lab-pane");
    sim.appendChild(el("h3", null, "① 静力学 · 双绳吊装 <span>拖动蓝色手柄改 α，系统实时重新平衡</span>"));
    sim.appendChild(canvas); sim.appendChild(ctr); sim.appendChild(verdict); sim.appendChild(explore);
    host.appendChild(sim);

    const tutorBox = el("div", "tutor");
    const tb = el("div", "tutor-body");
    tutorBox.appendChild(el("h3", null, "苏格拉底引导 <span>答对才前进 · 不给直接答案</span>"));
    tutorBox.appendChild(tb);
    host.appendChild(tutorBox);
    makeTutor(tb, TREE_P1, stats);

    function forces() {
      const d = S.beta - S.alpha;
      if (d <= 0.02) return { Fq: Infinity, Fp: Infinity, deg: d };
      const Fq = S.G * Math.sin(S.alpha) / Math.sin(d);
      return { Fq: Fq, Fp: Fq * Math.sin(S.beta) / Math.sin(S.alpha), deg: d };
    }

    function paint() {
      const f = fit(canvas), g = f.g, w = f.w, h = f.h;
      g.clearRect(0, 0, w, h); grid(g, w, h);
      const cx = w * 0.44, cy = h * 0.44, Sc = Math.min(w, h) * 0.0035;
      const F = forces();
      const cap = (v) => Math.min(v, 2600);
      g.strokeStyle = "#5a5a5a"; g.beginPath(); g.arc(cx, cy - 150, 150, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
      g.fillStyle = c.ink; g.beginPath(); g.arc(cx, cy, 5, 0, 7); g.fill();
      const Lg = 60 + S.G * 0.12;
      g.strokeStyle = "#7a7a7a"; g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy + Lg); g.stroke(); g.lineWidth = 1;
      drawArrow(g, cx, cy + Lg, cx, cy + Lg + 46, "#7a7a7a");
      g.fillStyle = c.ink; g.font = "13px sans-serif";
      g.fillText("G=" + S.G + " N", cx + 10, cy + Lg + 30);

      const a = S.alpha, Lp = 150;
      const px = cx + Math.sin(a) * Lp, py = cy - Math.cos(a) * Lp;
      g.strokeStyle = "#5f6b78"; g.beginPath(); g.moveTo(cx, cy); g.lineTo(px, py); g.stroke();
      g.fillStyle = c.accent; g.beginPath(); g.arc(px, py, 9, 0, 7); g.fill();
      g.fillStyle = c.dim; g.fillText("拖我改 α", px + 12, py + 4);

      const fs = Math.min(Sc * 8, 90 / Math.max(F.Fp, 1));
      const vP = 46 + cap(F.Fp) * fs * 0.55, vQ = 46 + cap(F.Fq) * fs * 0.55;
      drawArrow(g, cx, cy, cx + Math.sin(a) * vP, cy - Math.cos(a) * vP, c.accent);
      g.fillStyle = c.accent; g.fillText("F_P", cx + Math.sin(a) * vP + 8, cy - Math.cos(a) * vP);
      const bq = S.beta;
      drawArrow(g, cx, cy, cx - Math.sin(bq) * vQ, cy + Math.cos(bq) * vQ, c.signal);
      g.fillStyle = c.signal; g.fillText("F_Q", cx - Math.sin(bq) * vQ - 40, cy + Math.cos(bq) * vQ);

      g.fillStyle = c.ink; g.font = "14px sans-serif";
      const lines = isFinite(F.Fq)
        ? ["F_Q = G·sinα / sin(β−α) = " + F.Fq.toFixed(0) + " N（精确）",
           "官方近似口径 sin37°=0.6, sin16°≈0.28 → " + (S.G * 0.6 / 0.28).toFixed(0) + " N",
           "F_P = " + F.Fp.toFixed(0) + " N（近似口径 " + (S.G * 0.8 / 0.28).toFixed(0) + " N）"]
        : ["β−α → 0：两绳近乎共线，拉力发散（F→∞）"];
      lines.forEach((t, i) => g.fillText(t, 16, h - 58 + i * 18));

      if (!isFinite(F.Fq)) verdict.innerHTML = "<b>发散警告</b>：α 已贴近 β，绳子近乎共线，拉力发散（F→∞）——真实吊装里这意味着断绳风险。";
      else if (F.deg < 0.35) verdict.innerHTML = "<b>注意</b>：β−α=" + (F.deg * 180 / Math.PI).toFixed(1) + "°，F_Q 精确值已达 <b>" + F.Fq.toFixed(0) + " N</b>，远超重物重量——角度越接近共线，绳越吃力。";
      else verdict.innerHTML = "当前：F_Q = <b>" + F.Fq.toFixed(0) + " N</b>，F_P = <b>" + F.Fp.toFixed(0) + " N</b>（β−α=" + (F.deg * 180 / Math.PI).toFixed(1) + "°）。真题角度（37°/53°）：精确 " + F.Fq.toFixed(0) + "/" + F.Fp.toFixed(0) + " N，官方近似口径 900 / 1200 N。";
    }

    paint();
    const onResize = () => paint();
    window.addEventListener("resize", onResize);
    return { destroy: () => { window.removeEventListener("resize", onResize); } };
  }

  /* ═══════════ ② 板块 + 平抛（2024 新课标 25） ═══════════ */
  const TREE_P2 = {
    steps: [
      { q: "物块滑上静止薄板后，薄板为什么会向前加速？", opts: [
        { t: "物块给薄板一个向前的滑动摩擦力", ok: 1, fb: "对。物块相对板向前滑 → 板受向前摩擦 μmg。" },
        { t: "薄板有重力沿运动方向的分量", ok: 0, fb: "平台水平，重力没有水平分量。" },
        { t: "平台给薄板的摩擦力", ok: 0, fb: "平台光滑且方向也不对——它若粗糙只会是阻力。" }] },
      { q: "平台光滑。系统（物块+薄板）水平方向动量守恒吗？", opts: [
        { t: "守恒——摩擦力是内力，水平不受外力", ok: 1, fb: "正确：mv₀ = mv₁ + mv₂，这是本题第一根支柱。" },
        { t: "不守恒，因为有摩擦", ok: 0, fb: "内力不改变系统总动量——区分内力/外力是这里的全部要点。" },
        { t: "只在前半段守恒", ok: 0, fb: "守恒与否看外力，不看阶段。" }] },
      { q: "相对滑动期间，物块和薄板的加速度各是多少？", opts: [
        { t: "物块 μg（减速）、薄板 μg（加速）——因为质量相等", ok: 1, fb: "正确：摩擦 μmg 对物块是阻力、对板是动力，除以各自质量 m 后大小都是 μg=3 m/s²。" },
        { t: "物块 μg、薄板 2μg", ok: 0, fb: "板只受一个 μmg，别乘二。" },
        { t: "物块 2μg、薄板 μg", ok: 0, fb: "物块也只受一个摩擦力。" }] },
      { q: "「物块恰从薄板右端飞出」用位移怎么表达？", opts: [
        { t: "x物 − x板 = l（相对位移等于板长）", ok: 1, fb: "对。所以物块对地位移 = l + Δl —— 这就是解析里 v₀²−v₁²=2μg(l+Δl) 的来历。" },
        { t: "x物 = l", ok: 0, fb: "漏了板自己也在走——对地位移比板长多出 Δl。" },
        { t: "x板 = l", ok: 0, fb: "板只走了 Δl = l/6。" }] },
      { q: "飞出之后呢？", opts: [
        { t: "物块平抛（水平 v₁），薄板以 v₂ 匀速（平台光滑）", ok: 1, fb: "正确。接下来平抛时间由高度决定，板在这段时间里匀速滑行——「中心恰好到 O」就是用这个时间反推 h。" },
        { t: "两者都继续匀速", ok: 0, fb: "物块离开支撑面后还有重力——是平抛不是匀速直线。" },
        { t: "物块自由落体", ok: 0, fb: "它带着水平速度 v₁ 离开，是平抛。" }] }
    ],
    numeric: [
      { label: "v₀（m/s）", ans: 4, tol: 0.05, unit: "m/s", sol: "v₂²=2μgΔl=1→v₂=1；动量守恒 v₀=v₁+1；动能定理 v₀²−v₁²=2μg(l+Δl)=7 → v₀=4" },
      { label: "t₁（s）", ans: 1 / 3, tol: 0.005, unit: "s", sol: "薄板匀加速 v₂=μgt₁ → t₁=1/3 s" },
      { label: "平台高度 h（m）", ans: 5 / 9, tol: 0.01, unit: "m", sol: "平抛时间 t₂=(l/2−Δl)/v₂=(1/2−1/6)/1=1/3 s → h=½gt₂²=5/9≈0.556 m" }
    ],
    variant: function () {
      const mu = [0.2, 0.25, 0.4][Math.floor(Math.random() * 3)];
      const v0 = [5, 6][Math.floor(Math.random() * 2)];
      let vb = v0, vp = 0, xb = 0, xp = 0, dt = 1e-3;
      for (let i = 0; i < 20000; i++) {
        vb -= mu * 10 * dt; vp += mu * 10 * dt; xb += vb * dt; xp += vp * dt;
        if (xb - xp >= 1) break;
      }
      return {
        text: "变式：μ=" + mu + "、v₀=" + v0 + " m/s（l=1.0 m 不变）。求薄板的最终速度 v₂（m/s）。",
        ans: vp, tol: 0.03, unit: "m/s",
        sol: "物块飞出 → 动量守恒 v₀=v₁+v₂ 且 v₀²−v₁²=2μg(l+Δl)、v₂²=2μgΔl → v₂=" + vp.toFixed(2) + " m/s（对板用动能定理 μgΔl=v₂²/2）"
      };
    }
  };

  function mountBlock(host, stats, opts) {
    opts = opts || {};
    const P = { v0: 4, mu: 0.3, l: 1.0, g: 10, hp: 5 / 9, running: false, t: 0, done: false,
      xb: 0, xp: 0, vb: 4, vp: 0, phase: "slide", vt: [], flyT: 0 };
    const SCALE = 190;
    let raf = null, last = 0;

    const canvas = el("canvas"); canvas.dataset.h = String(opts.height || 360);
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "物块在薄板上滑动、飞出后平抛的运动仿真");

    const ctr = el("div", "controls");
    function slider(label, min, max, val, step, onIn) {
      const lb = el("label");
      lb.appendChild(document.createTextNode(label + " "));
      const inp = el("input"); inp.type = "range"; inp.min = min; inp.max = max; inp.step = step; inp.value = val;
      const out = el("span", "val");
      lb.appendChild(inp); lb.appendChild(out);
      inp.addEventListener("input", () => { out.textContent = onIn(+inp.value); reset(); });
      ctr.appendChild(lb);
      return { inp, out, set: (v) => { inp.value = v; out.textContent = onIn(v); } };
    }
    const sV = slider("v₀", 1, 8, 4, 0.1, (v) => { P.v0 = v; return v.toFixed(1) + " m/s"; });
    const sM = slider("μ", 0.1, 0.6, 0.3, 0.01, (v) => { P.mu = v; return v.toFixed(2); });
    const runB = el("button", "btn small primary", "运行");
    const rsB = el("button", "btn small", "复位");
    ctr.appendChild(runB); ctr.appendChild(rsB);

    const verdict = el("div", "verdict");
    const explore = el("div", "explore",
      "探索任务：把 v₀ 逐渐调低——存在一个临界值，物块在到达右端前与薄板共速、再也飞不出去。找到它。");

    const sim = el("div", "lab-pane");
    sim.appendChild(el("h3", null, "② 板块 + 平抛 <span>调 v₀ / μ 实时重跑，观察飞出条件与「恰好」巧合</span>"));
    sim.appendChild(canvas); sim.appendChild(ctr); sim.appendChild(verdict); sim.appendChild(explore);
    host.appendChild(sim);

    let tb = null;
    if (!opts.compact) {
      const tutorBox = el("div", "tutor");
      tb = el("div", "tutor-body");
      tutorBox.appendChild(el("h3", null, "苏格拉底引导 <span>答对才前进 · 不给直接答案</span>"));
      tutorBox.appendChild(tb);
      host.appendChild(tutorBox);
    }

    function reset() {
      Object.assign(P, { running: false, t: 0, done: false, xb: 0, xp: 0,
        vb: P.v0, vp: 0, phase: "slide", vt: [], flyT: 0 });
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      verdict.textContent = "参数已复位，点「运行」开始。";
      paint();
    }

    function step(dt) {
      if (P.phase === "slide") {
        P.vb -= P.mu * P.g * dt; P.vp += P.mu * P.g * dt;
        P.xb += P.vb * dt; P.xp += P.vp * dt;
        P.vt.push([P.t, P.vb, P.vp]);
        if (P.xb - P.xp >= P.l) {
          P.phase = "fly"; P.flyT = P.t;
          verdict.innerHTML = "物块已从右端飞出：v₁=" + P.vb.toFixed(2) + " m/s，板速 v₂=" + P.vp.toFixed(2) + " m/s，板位移 Δl=" + P.xp.toFixed(3) + " m（真题参考 0.167）。";
        } else if (P.vb <= P.vp) {
          P.phase = "together"; P.vb = P.vp;
          verdict.innerHTML = "<b>未飞出</b>：物块与薄板在到达右端前共速（共同速度 " + P.vp.toFixed(2) + " m/s），此后一起匀速。调高 v₀ 试试。";
          P.running = false; P.done = true;
        }
      } else if (P.phase === "fly") {
        P.xp += P.vp * dt;
        P.vt.push([P.t, P.vb, P.vp]);
        const tFall = Math.sqrt(2 * P.hp / P.g);
        if (P.t >= P.flyT + tFall) {
          P.phase = "land"; P.running = false; P.done = true;
          const off = P.xp - P.l / 2;
          verdict.innerHTML += "<br>物块落地：历时 " + tFall.toFixed(3) + " s，水平位移 " + (P.vb * tFall).toFixed(3) + " m。此刻薄板中心相对边缘 O：" + (off >= 0 ? "已越过 " : "距 O 还有 ") + Math.abs(off).toFixed(3) + " m。真题 v₀=4、μ=0.3 时应恰好到达 O。";
        }
      }
    }

    function paint() {
      const f = fit(canvas), g = f.g, w = f.w, h = f.h;
      g.clearRect(0, 0, w, h);
      const gy = h - 70, ox = 40, edgeX = ox + 2.2 * SCALE;
      g.fillStyle = "#2b2b2b"; g.fillRect(ox, gy - P.hp * SCALE, edgeX - ox, P.hp * SCALE);
      g.strokeStyle = c.line; g.strokeRect(ox, gy - P.hp * SCALE, edgeX - ox, P.hp * SCALE);
      g.fillStyle = c.dim; g.font = "12px sans-serif";
      g.fillText("平台（光滑）", ox + 8, gy - P.hp * SCALE + 16);
      g.fillStyle = c.ink; g.fillText("O", edgeX - 4, gy - P.hp * SCALE - 6);
      g.strokeStyle = c.line; g.beginPath(); g.moveTo(0, gy); g.lineTo(w, gy); g.stroke();
      g.fillStyle = c.dim; g.fillText("地面", w - 44, gy + 16);

      const pl = P.l * SCALE;
      const px = edgeX + P.xp * SCALE - pl, py = gy - P.hp * SCALE;
      g.fillStyle = "#e3a008"; g.fillRect(px, py - 14, pl, 12);
      g.fillStyle = "#8a5a00"; g.beginPath(); g.arc(px + pl / 2, py - 8, 3, 0, 7); g.fill();
      g.fillText("薄板中心", px + pl / 2 - 24, py - 18);

      const bx = edgeX + (P.xb - P.l) * SCALE, byTop = py - 14;
      let bY = byTop - 16, bX = bx;
      if (P.phase === "fly" || P.phase === "land") {
        const tF = Math.min(P.t - P.flyT, Math.sqrt(2 * P.hp / P.g));
        bX = bx + P.vb * tF * SCALE;
        bY = byTop - 16 + 0.5 * P.g * tF * tF * SCALE;
      }
      g.fillStyle = c.accent; g.fillRect(bX, bY, 24, 16);
      if (P.vb > 0.02) {
        drawArrow(g, bX + 12, py - 40, bX + 12 + P.vb * 14, py - 40, c.accent);
        g.fillStyle = c.accent; g.fillText("物块 " + P.vb.toFixed(1), bX + 6, py - 46);
      }
      if (P.vp > 0.02) {
        drawArrow(g, px + pl / 2, py + 8, px + pl / 2 + P.vp * 14, py + 8, c.signal);
        g.fillStyle = c.signal; g.fillText("板 " + P.vp.toFixed(1), px + pl / 2, py + 26);
      }
      // v–t 小图
      const gx = w - 220, gy2 = 24;
      g.fillStyle = "#202020"; g.fillRect(gx, gy2, 200, 90);
      g.strokeStyle = c.line; g.strokeRect(gx, gy2, 200, 90);
      g.fillStyle = c.dim; g.fillText("v–t", gx + 4, gy2 + 12);
      const tmax = Math.max(1.2, P.t);
      const vmax = Math.max(P.v0, 1);
      for (let i = 1; i < P.vt.length; i++) {
        const p0 = P.vt[i - 1], r = P.vt[i];
        g.strokeStyle = c.accent; g.beginPath();
        g.moveTo(gx + 200 * p0[0] / tmax, gy2 + 90 - 90 * p0[1] / vmax);
        g.lineTo(gx + 200 * r[0] / tmax, gy2 + 90 - 90 * r[1] / vmax); g.stroke();
        g.strokeStyle = c.signal; g.beginPath();
        g.moveTo(gx + 200 * p0[0] / tmax, gy2 + 90 - 90 * p0[2] / vmax);
        g.lineTo(gx + 200 * r[0] / tmax, gy2 + 90 - 90 * r[2] / vmax); g.stroke();
      }
      g.fillStyle = c.ink; g.font = "13px sans-serif";
      g.fillText("t=" + P.t.toFixed(2) + " s", 16, 20);
    }

    function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (P.running && !P.done) {
        let rem = dt * 0.9;
        while (rem > 0 && !P.done) { const hh = Math.min(rem, 0.0002); step(hh); rem -= hh; P.t += hh; }
        paint();
      }
      raf = requestAnimationFrame(loop);
    }
    runB.addEventListener("click", () => {
      if (P.done) reset();
      P.running = true;
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
    });
    rsB.addEventListener("click", reset);

    makeTutor(tb, TREE_P2, stats);
    reset();
    const onResize = () => paint();    window.addEventListener("resize", onResize);
    return { destroy: () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    } };
  }

  /* ═══════════ ③ 电磁感应线框（2023 新课标 26） ═══════════ */
  const TREE_P3 = {
    steps: [
      { q: "第 2 问里，线框的上、下两条边有电流吗？", opts: [
        { t: "没有——它们被导轨短路了", ok: 1, fb: "对：导轨沿上下边方向、电阻不计，上下边被短接。切割的只有左/右边。" },
        { t: "有，四条边都有", ok: 0, fb: "被短路的支路两端等电势，没有电流流过。" },
        { t: "取决于 B 的方向", ok: 0, fb: "B 的方向影响电动势极性，不影响短路事实。" }] },
      { q: "安培力 F=B²L²v/R 随速度变化——求速度变化量，最好用什么工具？", opts: [
        { t: "动量定理：对微元时间累积 F·dt", ok: 1, fb: "对。ΣB²L²v/R·dt = B²L²·x/R（v dt = dx）——速度问题变成位移问题，这是本题的钥匙。" },
        { t: "牛顿第二定律硬积分", ok: 0, fb: "思路对但绕远——动量定理一步把 v·dt 换成 dx。" },
        { t: "能量守恒", ok: 0, fb: "热量未知，能量方程多一个未知量。" }] },
      { q: "第 1 问（无导轨，R=4R₀）：从进入到完全穿出（磁场宽 L），安培力冲量共多少？", opts: [
        { t: "进、出各一段：2×B²L³/(4R₀)", ok: 1, fb: "对。两段位移各 L：I=2B²L³/(4R₀)=B²L³/(2R₀)=mv₀−mv₀/2 → v₀=B²L³/(mR₀)。" },
        { t: "只有进入一段 B²L³/(4R₀)", ok: 0, fb: "穿出时是左边切割，同样受安培力——别漏。" },
        { t: "零，因为出磁场时没有电流", ok: 0, fb: "穿出过程中左边在切割，有电流。" }] },
      { q: "第 2 问进入磁场段的回路电阻为什么是 5/3·R₀？", opts: [
        { t: "右边 R₀ 串联「左边 R₀ 与外接 R₁ 的并联」——R₁=2R₀ 时得 5/3·R₀", ok: 1, fb: "正确：R=R₀+R₀R₁/(R₀+R₁)。" },
        { t: "四条边串联再并联 R₁", ok: 0, fb: "上下边被短路，不参与。" },
        { t: "就是 R₁ 本身", ok: 0, fb: "切割边自己的 R₀ 也串在回路里。" }] },
      { q: "完全进入后，为什么电阻变成 5/2·R₀、电动势等效不变？", opts: [
        { t: "左右两边变成两个并联电源（内阻 R₀/2），外路只剩 R₁", ok: 1, fb: "对：R=R₀/2+R₁=5/2·R₀，安培力仍 ∝v，线框在磁场内继续减速直到停在右边界。" },
        { t: "电动势加倍所以力加倍", ok: 0, fb: "两电源并联，端电压不变、总电流由外路决定。" },
        { t: "不再受安培力", ok: 0, fb: "仍有电流流过 R₁，仍受安培力——否则它不会停。" }] }
    ],
    numeric: [
      { label: "第 1 问 v₀（B=L=m=R₀=1 时的数值，m/s）", ans: 1, tol: 0.02, unit: "m/s", sol: "v₀=B²L³/(mR₀)，代入全 1 → 1 m/s；一般式 v₀=B²L³/(mR₀)" },
      { label: "第 2 问 R₁（用 R₀ 的倍数）", ans: 2, tol: 0.01, unit: "×R₀", sol: "R₁=2R₀（由进入段 5/3·R₀ 的并联结构反解）" },
      { label: "R₁ 上总热量 Q（全 1，J）", ans: 3 / 25, tol: 0.005, unit: "J", sol: "Q=3B⁴L⁶/(25mR₀²)=3/25=0.12 J（进入段 2/25 + 场内段 1/25）" }
    ],
    variant: function () {
      const B = [1.5, 2, 2.5][Math.floor(Math.random() * 3)];
      return {
        text: "变式：第 1 问条件（无导轨、磁场宽 L），B=" + B + " T（其余全 1）。求出射速度 v_exit（m/s）。",
        ans: B * B / 2, tol: 0.06, unit: "m/s",
        sol: "v₀=B²L³/(mR₀)=" + B * B + "，两段冲量共 B²L³/(2R₀)=mv₀/2 → v_exit=v₀/2=" + (B * B / 2).toFixed(2) + " m/s"
      };
    }
  };

  function mountInduction(host, stats, opts) {
    opts = opts || {};
    const P = { mode: "A", B: 1, W: 1, v0: 1, L: 1, m: 1, R0: 1, running: false, t: 0, x: -1, v: 1, done: false, phase: "enter", vt: [] };
    const SCALE = 90;
    let raf = null, last = 0;

    const canvas = el("canvas"); canvas.dataset.h = String(opts.height || 380);
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "线框穿越磁场的电磁感应仿真");

    const ctr = el("div", "controls");
    const lbMode = el("label");
    lbMode.appendChild(document.createTextNode("模式 "));
    const sel = el("select");
    [["A", "第 1 问 · 无导轨（磁场宽度 W 可调）"], ["B", "第 2 问 · 导轨 + R₁"]].forEach(([v, t]) => {
      const o = el("option", null, t); o.value = v; sel.appendChild(o);
    });
    lbMode.appendChild(sel); ctr.appendChild(lbMode);

    function slider(label, min, max, val, step, onIn) {
      const lb = el("label");
      lb.appendChild(document.createTextNode(label + " "));
      const inp = el("input"); inp.type = "range"; inp.min = min; inp.max = max; inp.step = step; inp.value = val;
      const out = el("span", "val");
      lb.appendChild(inp); lb.appendChild(out);
      inp.addEventListener("input", () => { out.textContent = onIn(+inp.value); reset(); });
      ctr.appendChild(lb);
      return { inp, out, set: (v) => { inp.value = v; out.textContent = onIn(v); } };
    }
    const sB = slider("B", 0.5, 3, 1, 0.05, (v) => { P.B = v; return v.toFixed(2) + " T"; });
    const sW = slider("W", 0.5, 4, 1, 0.05, (v) => { P.W = v; return v.toFixed(2) + " L"; });
    const runB = el("button", "btn small primary", "运行");
    const exB = el("button", "btn small", "载入真题参数");
    const rsB = el("button", "btn small", "复位");
    ctr.appendChild(runB); ctr.appendChild(exB); ctr.appendChild(rsB);

    const verdict = el("div", "verdict");
    const explore = el("div", "explore",
      "探索任务：切到「第 2 问」模式，扫 W 找出「恰好停在右边界的临界磁场宽度 W*」，再用动量定理（Δv = B²L²·Δx/(mR)）自己推一遍对照。");

    const sim = el("div", "lab-pane");
    sim.appendChild(el("h3", null, "③ 电磁感应线框（压轴） <span>数值积分，物理相位与解析一致</span>"));
    sim.appendChild(canvas); sim.appendChild(ctr); sim.appendChild(verdict); sim.appendChild(explore);
    host.appendChild(sim);

    let tb = null;
    if (!opts.compact) {
      const tutorBox = el("div", "tutor");
      tb = el("div", "tutor-body");
      tutorBox.appendChild(el("h3", null, "苏格拉底引导 <span>答对才前进 · 不给直接答案</span>"));
      tutorBox.appendChild(tb);
      host.appendChild(tutorBox);
    }

    function reset() {
      Object.assign(P, { running: false, t: 0, x: -P.L, v: P.B * P.B * P.L * P.L * P.L / (P.m * P.R0),
        done: false, phase: "enter", vt: [] });
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      verdict.innerHTML = P.mode === "A"
        ? "第 1 问真题条件：W=L、v₀=B²L³/(mR₀)（本页 m=1、R₀=1、L=1，B 滑条改动时 v₀ 自动按该式取值）→ 出射速度恰减半。点「载入真题参数」验证。"
        : "第 2 问：进入段 R=5/3 R₀、完全进入后 R=5/2 R₀。扫 W 找「恰好停在右边界的临界宽度」——v₀=B²L³/mR₀ 时 W*=2.00 L。";
      paint();
    }

    function step(dt) {
      const L = P.L, W = P.W * P.L;
      const front = P.x + L, back = P.x;
      const rightIn = front > 0 && front < W, leftIn = back > 0 && back < W;
      let R = null, cutting = false;
      if (P.mode === "A") {
        cutting = (rightIn !== leftIn);
        if (cutting) R = 4 * P.R0;
      } else {
        if (rightIn || leftIn || (back >= 0 && front <= W)) {
          cutting = true;
          R = (back < 0) ? (5 / 3) * P.R0 : (5 / 2) * P.R0;
        }
      }
      P.phase = cutting ? (back < 0 ? "enter" : (front <= W ? "inside" : "exit"))
                        : ((back >= W || front <= 0) ? "out" : "inside");
      if (cutting && P.v > 0) P.v -= (P.B * P.B * L * L * P.v) / (P.m * R) * dt;
      P.x += P.v * dt; P.t += dt;
      P.vt.push([P.t, P.v]);
      if (P.v <= 0.005) {
        P.v = 0; P.running = false; P.done = true;
        const stop = P.x + P.L, gap = stop / P.L - P.W;
        verdict.innerHTML = "停止：线框前端停在 x=" + (stop / P.L).toFixed(2) + " L，磁场右边界在 " + P.W.toFixed(2) + " L —— "
          + (Math.abs(gap) < 0.05 ? "<b>恰好停在右边界！</b>" + (P.mode === "B" && Math.abs(P.W - 2.0) < 0.03 ? "（真题情境复现：W*=2.00 L）" : "")
            : (gap < 0 ? "提前 " + Math.abs(gap).toFixed(2) + " L 停下（磁场比临界 W* 宽，场内减速段更长）" : "已冲出边界（磁场比临界 W* 窄，没刹住）"));
      } else if (P.phase === "out" && back >= W) {
        P.running = false; P.done = true;
        verdict.innerHTML = "线框已完全离开磁场：出射速度 v=" + P.v.toFixed(3) + " m/s（入射 v₀=" + P.v0.toFixed(2) + "）。";
      }
    }

    function paint() {
      const f = fit(canvas), g = f.g, w = f.w, h = f.h;
      g.clearRect(0, 0, w, h); grid(g, w, h);
      const gy = h * 0.62, x0 = 150, WL = P.W * P.L * SCALE;
      if (P.mode === "B") {
        g.strokeStyle = "#6a6a6a"; g.lineWidth = 3;
        g.beginPath(); g.moveTo(0, gy - 60); g.lineTo(w, gy - 60);
        g.moveTo(0, gy + 60); g.lineTo(w, gy + 60); g.stroke(); g.lineWidth = 1;
        g.fillStyle = c.dim; g.font = "12px sans-serif";
        g.fillText("导轨（短路上下边）+ 外接 R₁", 8, gy - 70);
      }
      g.fillStyle = "rgba(0,229,255,.10)"; g.fillRect(x0, gy - 110, WL, 220);
      g.strokeStyle = c.signal; g.setLineDash([5, 4]); g.strokeRect(x0, gy - 110, WL, 220); g.setLineDash([]);
      g.fillStyle = c.signal; g.font = "12px sans-serif";
      g.fillText("磁场 B（宽 " + P.W.toFixed(2) + " L）", x0 + 6, gy - 118);
      for (let yy = gy - 100; yy < gy + 110; yy += 22) {
        g.fillText("×", x0 + 18, yy);
        g.fillText("×", x0 + 18 + Math.min(WL - 20, 150), yy);
      }
      const fx = x0 + P.x * SCALE, L = P.L * SCALE;
      g.strokeStyle = c.accent; g.lineWidth = 3; g.strokeRect(fx, gy - L / 2, L, L); g.lineWidth = 1;
      g.fillStyle = c.accent; g.font = "13px sans-serif";
      g.fillText("v=" + P.v.toFixed(2) + " m/s", fx, gy - L / 2 - 8);
      g.fillStyle = "#e5484d"; g.fillText("右边界", x0 + WL - 20, gy + 130);

      const gx = w - 230, gy2 = 20;
      g.fillStyle = "#202020"; g.fillRect(gx, gy2, 205, 90);
      g.strokeStyle = c.line; g.strokeRect(gx, gy2, 205, 90);
      g.fillStyle = c.dim; g.fillText("v–t", gx + 4, gy2 + 12);
      const tmax = Math.max(1, P.t), vmax = Math.max(P.v0, 1);
      g.strokeStyle = c.accent; g.beginPath();
      P.vt.forEach((r, i) => {
        const X = gx + 205 * r[0] / tmax, Y = gy2 + 90 - 90 * Math.min(r[1], vmax) / vmax;
        i ? g.lineTo(X, Y) : g.moveTo(X, Y);
      });
      g.stroke();
      g.fillStyle = c.ink;
      g.fillText("x(前端)=" + (P.x + P.L).toFixed(2) + " L / 右边界 " + P.W.toFixed(2) + " L", 16, h - 14);
    }

    function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (P.running && !P.done) {
        let rem = dt * 1.6;
        while (rem > 0 && !P.done) { const hh = Math.min(rem, 0.001); step(hh); rem -= hh; P.t += hh; }
        paint();
      }
      raf = requestAnimationFrame(loop);
    }

    sel.addEventListener("change", () => { P.mode = sel.value; reset(); });
    runB.addEventListener("click", () => {
      if (P.done) reset();
      P.running = true;
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
    });
    rsB.addEventListener("click", reset);
    exB.addEventListener("click", () => {
      if (P.mode === "A") { P.B = 1; P.W = 1; sB.set(1); sW.set(1); }
      else { P.B = 1; sB.set(1); P.W = 2.0; sW.set(2.0); }
      reset(); P.running = true;
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
    });

    makeTutor(tb, TREE_P3, stats);
    reset();
    const onResize = () => paint();
    window.addEventListener("resize", onResize);
    return { destroy: () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    } };
  }

  /* ═══════════ 实验室目录 ═══════════ */
  const LIST = [
    { id: "statics", subject: "物理", title: "双绳吊装（静力学）",
      exam: "2024 年高考新课标卷 第 24 题", mount: mountStatics,
      brief: "绳 P、Q 系于结点 O 悬挂重物。拖动 α 手柄改变夹角，观察 F_Q = G·sinα/sin(β−α) 何时发散。",
      covers: ["共点力的平衡", "力的合成和分解", "牛顿第三定律"] },
    { id: "block", subject: "物理", title: "板块模型 + 平抛（动力学）",
      exam: "2024 年高考新课标卷 第 25 题", mount: mountBlock,
      brief: "物块滑上光滑平台上静止的薄板，从右端飞出后平抛。调 v₀ 与 μ，找「恰好飞出」的临界条件。",
      covers: ["摩擦力", "匀变速直线运动", "抛体运动", "动量与能量"] },
    { id: "induction", subject: "物理", title: "电磁感应线框（压轴）",
      exam: "2023 年高考新课标卷 第 26 题", mount: mountInduction,
      brief: "线框穿越匀强磁场，安培力随速度衰减。扫磁场宽度 W，找「恰好停在右边界」的临界 W*。",
      covers: ["楞次定律 / 法拉第定律", "安培力", "动量定理在电磁学的应用"] }
  ];

  window.GEWU_LAB = {
    list: function () { return LIST.slice(); },
    byId: function (id) { return LIST.filter((x) => x.id === id)[0] || null; },
    mount: function (container, id, stats, opts) {
      const lab = window.GEWU_LAB.byId(id);
      if (!lab || !container) return null;
      container.innerHTML = "";
      return lab.mount(container, stats, opts || {});
    }
  };
})();
