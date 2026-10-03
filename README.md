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

## 三道机器门（全部退出码 0 才算过）

```bash
python3 tools/check_data.py     # 数据层：数字是不是真的
node    tools/render-shots.js   # 内容层：字段齐不齐、交互数值变不变
node    tools/audit_visual.js   # 几何层：压字 / 看不清 / 撑破屏 / 点不着
node    tools/audit_subjects.js # 交互层：切科换树 / 深链 / KaTeX
```

四道门各自负责一个维度，**都过才算验收过**；任一非 0 退出即打回。实测输出见文末「验收实录」。

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
└── tools/                     # 1 个数据构建 + 1 个数据门 + 3 个验收脚本
```

## 踩过的坑（改之前先看）

1. **几何审计的假阳性——折叠节点**。`audit_visual.js` 第一版报了 12 处「文字重叠」，实际是**我自己的 harness 出错**：闭合的 `<details>` 子节点有布局盒但不渲染，于是每个折叠节点的叶子会跟后面所有节点"重叠"（实测 2726 对）。修法是加 `visible()` 过滤（`closest("details:not([open])")` + `checkVisibility()`）。**报错先怀疑 harness，再怀疑产品。**
2. **横向溢出的真值取文档级**。`document.documentElement.scrollWidth - clientWidth` 才算数；逐元素 `getBoundingClientRect` 会把 `left: -9999px` 的 skip-link（`position: absolute`，不产生滚动条）算成溢出。`position: absolute/fixed` 一律跳过。
3. **Mimosa 拦 `path.join(process.env.HOME, ...)`**——被判定为命令注入。写法必须是**硬编码绝对路径字面量**，与 `render-shots.js` 保持一致。
4. **紧凑模式的 return 陷阱**。`opts.compact` 会在函数后半段提前 `return`，**事件监听必须先装**，否则 hero 里的滑杆装了不响应。
5. **科目切换断言的收尾状态**。`audit_subjects.js` 的循环停在「化学」，所以断言当前科首节栏位要写 `>= 5` 而不是 `== 5`（化学 2.3物质的量 是 6 栏）。
6. **中文 .bat 与 heredoc 都别碰**。本项目所有源码经 Write/Edit 提交，不用 Bash 重定向写文件。

## 验收实录（2026-10-03）

```
$ python3 tools/check_data.py
结论：全部 PASS
（册 16 / 章 65 / 簇 29 / 正文 258 / 栏目 42 / 条目 300 / 漏配 0 / 三科主栏齐全）
EXIT=0

$ node tools/audit_visual.js
几何验收：PASS（无重叠 / 对比度达标 / 无横向溢出）
desktop + mobile-landing + mobile-app：overlapCount 0 / docOverflowPx 0 / tinyTargets []
EXIT=0

$ node tools/audit_subjects.js
全绿
（三科树各不相同 / 化学首节 6 栏 / 三条 lab 深链 canvas=1 / #s= 深链 5 栏 /
 数学 8.1 katexNodes=7 rawDollarLeft=0）
EXIT=0

$ node tools/render-shots.js
errors: [] ; 落地页 stats 覆盖 16 册 / 29 簇 / 65 章 / 300 条 / 3 道
hero: 917 N（β−α=16.0°）→ 6148 N（β−α=3.0°），slider 50.0°
EXIT=0
```

---

工作名「格物」待定。数据来自本机知识树，真题来自公开卷面，交互数值是 canvas 现场算出的真值。
