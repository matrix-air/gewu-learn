# 格物 · 高中数理化知识地图与真题实验室

把 `analysis/gaokao-sci-knowledge-tree/教材内容/` 的 **人教 2019 全 16 册逐节要点**，接上 **3 道可拖可算的高考真题**，做成一页能打开就用的产品：知识树点得到每一节，每一节有六栏骨架，每一道真题拖得动、算得出。

不是 PPT，不是文档节选，不是 pitch 页——**零依赖、零构建、`file://` 双击可开**的静态站点。

> **诚实边界（先读这条）**
> - **题量只有 3 道**（2024 新课标 24/25，2023 新课标 26）。这是**引擎样板**，不是题库，不能当刷题产品用。
> - **引导树不是大模型**。苏格拉底式提问按公开解析**人工编排**，离线可跑，不是 LLM 现场生成。
> - **化学的非编号栏目**（整理与提升、实验活动、综合专题）单列为「栏目条」，**不混进正文节计数**——所以化学是 60 正文节 + 42 栏目条，不是 102 正文节。
> - 「格物」是**工作名/待定**，页面已标注**原型演示 · 非已上线商业服务**，不涉及收费。
> - 学习进度与日志**只存本机浏览器**（`localStorage`），不上传任何服务器。
> - 竞品截图是**无头浏览器抓的官网实拍**，版权归各厂商，仅作教学性对比引用。

---

## 怎么跑

```bash
cd ~/Documents/Aurora/analysis/gewu-learn
python3 -m http.server 8792 --bind 127.0.0.1
# 打开 http://127.0.0.1:8792/index.html   落地页（含可玩的 hero 演示台）
# 打开 http://127.0.0.1:8792/app.html     学习台（知识树 + 节级课程页 + 真题实验室）
```

也可以直接双击 `index.html`。数据走 `<script src>`（`assets/curriculum.js` / `assets/summary.js`）而非 `fetch`，所以**不依赖 HTTP 服务，`file://` 也能加载**。

## 页面结构

**`index.html`** — 落地页：`hero`（实时物理演示台 + 滑杆，右侧活数值）→ `#axes` 两条主轴 → `#layers` 三科 × 29 簇 → `#labs` 三道真题入口 → `#vs` 竞品实拍对照 + 诚实声明 → `footer`。

**`app.html`** — 学习台：左侧**知识树**（科 → 簇 → 章 → 节，四层，可折叠）→ 右侧**节级课程页**（六栏骨架）/ **真题实验室**（canvas + 控件 + 引导树）。

深链可直接分享，刷新页面也保持：

| 深链 | 打开什么 |
|---|---|
| `app.html#s=<sectionId>` | 直接打开某一节 |
| `app.html#lab=statics` | 双绳吊装（静力学） |
| `app.html#lab=block` | 板块模型 + 平抛（动力学） |
| `app.html#lab=induction` | 电磁感应线框（压轴） |

## 数据口径

| 口径 | 真值 | 校验者 |
|---|---|---|
| 册 | **16**（数学 5 / 物理 6 / 化学 5） | `tools/check_data.py` |
| 章 | **65**（数学 18 / 物理 27 / 化学 20） | 同上 |
| 簇 | **29**（数学 11 / 物理 8 / 化学 10） | 同上 |
| 逐节条目 | **300** ＝ 正文节 **258** + 化学栏目条 **42** | 同上 |
| 可玩真题 | **3** | `tools/render-shots.js` |
| 章→簇漏配 | **0**（65 章全部有簇） | `tools/check_data.py` |

数学 73 正文节 / 物理 125 正文节 / 化学 60 正文节；数学无「实验要点」栏**属教材事实，不是缺陷**（`check_data.py` 以 NOTE 输出，不计失败）。

## 四道机器门（全部退出码 0 才算过）

```bash
python3 tools/check_data.py     # 数据层：数字是不是真的
node    tools/render-shots.js   # 内容层：字段齐不齐、交互数值变不变
node    tools/audit_visual.js   # 几何层：压字 / 看不清 / 撑破屏 / 点不着
node    tools/audit_subjects.js # 交互层：切科换树 / 深链 / KaTeX
node    tools/probe-hash.js     # 健壮性：畸形 hash 不报错 + 合法深链仍生效（见坑位 8）
```

四道门各自负责一个维度，**都过才算验收过**；任一非 0 退出即打回。实测输出见文末「验收实录」。

`probe-hash.js` 是改 `app.js` 深链段时的回归门（自带 `verdict` 与退出码），不属于日常四门。

前置：`node` 需要 `playwright-core`，脚本按绝对路径 `~/Documents/Aurora/tools/node_modules/playwright-core` 引用，并固定用 Chrome for Testing（`~/Library/Caches/ms-playwright/chromium-1243`）。

## 数据重建

```bash
python3 tools/build_data.py    # 教材 Markdown → data/curriculum.json + assets/curriculum.js
python3 tools/check_data.py    # 重建后必须重跑
```

输入是本机知识树工程：`analysis/gaokao-sci-knowledge-tree/教材内容/{数学,物理,化学}/*.md`（正文）与该目录的 `知识树.html`（29 簇分类 + 章 ★ 权重）。`build_data.py` **只做结构化抽取，不改写任何内容**；章标题对不上知识树的记进 `meta.unmatched`。

## 文件清单

```
gewu-learn/
├── index.html                 # 落地页
├── app.html                   # 学习台
├── data/curriculum.json       # 数据层真源（build_data.py 产物）
├── assets/
│   ├── curriculum.js          # curriculum.json 的浏览器载荷（<script src> 加载，免 CORS）
│   ├── summary.js             # 聚类摘要载荷
│   ├── interactive.js         # 真题实验室引擎 window.GEWU_LAB
│   ├── landing.js             # 落地页渲染（含竞品实拍对照）
│   ├── app.js                 # 学习台渲染（树 / 课程页 / 进度）
│   ├── site.css               # 设计系统（theme-factory Tech Innovation）
│   └── img/                   # 竞品官网实拍 5 张
├── vendor/katex/              # KaTeX 0.16.47 本地内置（含字体），无 CDN
├── favicon.svg
└── tools/
    ├── build_data.py          # 教材 Markdown → data/curriculum.json + assets/curriculum.js
    ├── check_data.py          # 数据门（7 项判据，退出码）
    ├── render-shots.js        # 内容层验收 + 全页/分屏截图
    ├── audit_visual.js        # 几何层验收（重叠/对比度/溢出/触控）
    ├── audit_subjects.js      # 交互层验收（切科/深链/KaTeX）
    ├── probe-hash.js          # 健壮性验收（畸形 hash / 合法深链回归，退出码）
    └── diag-wall.js           # 一次性取证脚本：竞品墙懒加载竞态（保留证据）
```

> `tools/` 一并入库，因为「页面上的数字是真的」这句话要能被复核。但它们是**本机专用**：`playwright-core` 与 Chrome for Testing 按绝对路径引用、`build_data.py` 读本机知识树工程，换台机器直接跑会报路径错——那时把脚本里两个绝对路径改成本机实际位置即可。公网站本身（`index.html` / `app.html` / `assets` / `data` / `vendor`）零依赖，不碰 `tools/`。

## 踩过的坑（改之前先看）

1. **几何审计的假阳性——折叠节点**。`audit_visual.js` 第一版报了 12 处「文字重叠」，实际是**我自己的 harness 出错**：闭合的 `<details>` 子节点有布局盒但不渲染，于是每个折叠节点的叶子会跟后面所有节点"重叠"（实测 2726 对）。修法是加 `visible()` 过滤（`closest("details:not([open])")` + `checkVisibility()`）。**报错先怀疑 harness，再怀疑产品。**
2. **横向溢出的真值取文档级**。`document.documentElement.scrollWidth - clientWidth` 才算数；逐元素 `getBoundingClientRect` 会把 `left: -9999px` 的 skip-link（`position: absolute`，不产生滚动条）算成溢出。`position: absolute/fixed` 一律跳过。
3. **Mimosa 拦 `path.join(process.env.HOME, ...)`**——被判定为命令注入。写法必须是**硬编码绝对路径字面量**，与 `render-shots.js` 保持一致。
4. **紧凑模式的 return 陷阱**。`opts.compact` 会在函数后半段提前 `return`，**事件监听必须先装**，否则 hero 里的滑杆装了不响应。
5. **科目切换断言的收尾状态**。`audit_subjects.js` 的循环停在「化学」，所以断言当前科首节栏位要写 `>= 5` 而不是 `== 5`（化学 2.3物质的量 是 6 栏）。
6. **懒加载图别用固定延时判存活**。竞品墙 5 张图是 `loading=lazy`，`render-shots.js` 原来滚到位后 `waitForTimeout(900)` 就判 `naturalWidth>0`——**本地全过、线上报 2/5 BROKEN 的假阴性**（Pages 首包慢，图还没解码完）。改成 `waitForFunction` 等 `every(img.complete)` 才判定。诊断见 `tools/diag-wall.js`（故意留的取证脚本：真实网络请求无一失败、3.9s 后 5/5 全 ok，证明是竞态不是丢图）。
7. **中文 .bat 与 heredoc 都别碰**。本项目所有源码经 Write/Edit 提交，不用 Bash 重定向写文件；`rsync` 组装发布目录可以，写源码内容不行。
8. **畸形 hash 会让控制台报错**。`#%`（聊天软件/短链常把深链截断成非法百分号序列）在 `decodeURIComponent` 抛 `URIError`。原实现把深链解析放在 `DOMContentLoaded` **最后**，好在异常点之后的代码没有监听器要装了，所以功能没坏——但控制台会红一条，属于不该有的噪音。已用 `try/catch` 吞掉（`app.js` 深链段），回归门 `tools/probe-hash.js`。**这条腿改的坑在 harness**：Playwright 只改 hash 的 `goto` 是**同文档导航**，`DOMContentLoaded` 不会重跑，量到的是上一个页面的状态——我第一次就这么被骗出「搜索无反应」，换成「加唯一 query 强制整页加载」才量到真值。

## 安全口径（HTML 注入面）

页面把课程数据拼进 `innerHTML`，所以逐条查过污点路径：

- **唯一的外部输入是 URL hash**（深链 `#s=` / `#lab=`）。它只被当作**查表键**用（`LABS.some(id===x)` / `IDX.all.some(id===x)`），命中才调 `openLesson`/`mountLab`，**从不写进任何 HTML**。
- 其余全部来自站内静态数据（`curriculum.js` / `landing.js` 的竞品条目是字面量常量），且所有插值都过 `esc()`（`& < > "` 四字符）。**模板串里的 HTML 属性一律双引号**，`esc()` 覆盖 `"` 即足够闭合属性——这是「不转单引号也安全」的前提，改模板时若出现单引号属性（`='...'`）需同步扩 `esc()`。
- 已知未收口：`localStorage` 的 `gewu.progress` 可被同源脚本/用户手动篡改，但只用作布尔判断与计数，不进 HTML。
- 结论只覆盖**前端本页的注入面**；推送前的仓库扫描结论未闭合，不等于项目整体安全。

## 验收实录（2026-10-03）

四道门的脚本都接受一个可选 URL 参数，传线上地址就是对**公网版**验收（同一套判据），本机开发时省略参数走 `127.0.0.1:8792`。下面实录是**对线上跑**的结果。

```
$ python3 tools/check_data.py
结论：全部 PASS
（册 16 / 章 65 / 簇 29 / 正文 258 / 栏目 42 / 条目 300 / 漏配 0 / 三科主栏齐全）
EXIT=0

$ node tools/audit_visual.js https://matrix-air.github.io/gewu-learn/
几何验收：PASS（无重叠 / 对比度达标 / 无横向溢出）
desktop + mobile-landing + mobile-app：overlapCount 0 / docOverflowPx 0 / tinyTargets []
EXIT=0

$ node tools/audit_subjects.js https://matrix-air.github.io/gewu-learn/
全绿
（三科树各不相同 / 数学 5 册 11 簇 18 章 73 正文节 · 物理 6 册 8 簇 27 章 125 节 · 化学 5 册 10 簇 20 章 60 节 + 42 栏目条 /
 化学首节 2.3物质的量 6 栏 / 三条 lab 深链 canvas=1 / #s= 深链 5 栏 /
 数学 8.1 katexNodes=7 rawDollarLeft=0）
EXIT=0

$ node tools/render-shots.js https://matrix-air.github.io/gewu-learn/
errors: [] ; wallCount ['ok:900x473' ×5] ; clusterCount 29 ; labCount 3
stats: 覆盖 16 册 / 知识簇 29 / 章 65 / 逐节要点 300 条 / 可玩真题 3 道 / 机器门 已过
hero: 917 N（β−α=16.0°）→ 6148 N（β−α=3.0°），slider 50.0°
mobileLandingOverflowPx 0 / mobileAppOverflowPx 0
EXIT=0

$ node tools/probe-hash.js https://matrix-air.github.io/gewu-learn/
verdict: PASS
（#% 与 #%E0%A4 均 pageErrors [] 且树照常装配 / #s=<真实 id> learnPane fields=5 /
 #lab=statics labPane canvas=1）
EXIT=0
```

---

## 发布

公网版：**<https://matrix-air.github.io/gewu-learn/>**（仓库 `matrix-air/gewu-learn`，Pages 源 = main 根 + `.nojekyll`，2026-10-03 发布）

```bash
# 更新：改动本地后同步发布目录并推 main
rsync -a --include='/.nojekyll' --exclude='.*' .nojekyll index.html app.html favicon.svg README.md assets data vendor tools /tmp/gewu-publish/
cd /tmp/gewu-publish && git add -A && git commit -m "..." && git push
# 首次建站需手动触发构建（已触发过，后续 push 自动重发）：
# gh api repos/matrix-air/gewu-learn/pages/builds -X POST
```

> **`.nojekyll` 必须显式带上**。原来只写 `--exclude '.*'`，在**已有**的发布目录里没事（rsync 不删目标侧已有文件），但在空目录重建时会漏掉它，下次 `git add -A` 就把删除提交上去、Pages 重新走 Jekyll（潜在故障）。正确写法是 `--include='/.nojekyll'` 放在 `--exclude='.*'` 之前——rsync 规则先匹配者生效。

> 本仓库取代早期同名主题的 `matrix-air/gewu-edu-site`（那是一个**单文件 pitch 页 + 竞品对照墙**）。本仓库是**可用的学习产品**：知识树点得到每一节、节级课程页有六栏骨架、真题拖得动算得出、进度本地留存。旧仓库未删除，但其 README 里的入口不再代表当前形态。

工作名「格物」待定。数据来自本机知识树，真题来自公开卷面，交互数值是 canvas 现场算出的真值。
