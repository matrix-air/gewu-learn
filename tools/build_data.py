#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 教材内容/ 16 册 Markdown 解析成课程数据 JSON。

输入：analysis/gaokao-sci-knowledge-tree/教材内容/{数学,物理,化学}/*.md
      analysis/gaokao-sci-knowledge-tree/知识树.html（29 簇分类 + 章 ★ 权重）
输出：analysis/gewu-learn/data/curriculum.json

契约：
- 每科一书数组，书内 chapter 数组，章内 section 数组
- section.fields 是六栏骨架（各科按学科命名，栏名原样保留）
- 章的 star/cluster 来自 知识树.html，按「章标题」对齐；对不上的记进 meta.unmatched
- 不做任何内容改写；只做结构化抽取
"""
import re
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "gaokao-sci-knowledge-tree" / "教材内容"
TREE = ROOT / "gaokao-sci-knowledge-tree" / "知识树.html"
OUT = pathlib.Path(__file__).resolve().parents[1] / "data" / "curriculum.json"
OUT_JS = pathlib.Path(__file__).resolve().parents[1] / "assets" / "curriculum.js"
OUT_SUM = pathlib.Path(__file__).resolve().parents[1] / "assets" / "summary.js"

# 册次规范：全部收敛到 必一/必二/必三/选必一/选必二/选必三 这一种写法
BOOK_PREFIX = {"必一": "必一", "必二": "必二", "必三": "必三",
               "必修一": "必一", "必修二": "必二", "必修三": "必三",
               "选必一": "选必一", "选必二": "选必二", "选必三": "选必三"}


def canon_book(label):
    """任意册次写法 → 规范短名：'必修第一册' / '必二' / '选择性必修三' → '必一'/'必二'/'选必三'。"""
    s = (label or "").strip()
    m = re.match(r"(选择性必修|选必|必修|必)([一二三四五]|第[一二三四五]册)", s)
    if m:
        head, tail = m.group(1), m.group(2)
        num = tail[1] if tail.startswith("第") else tail
        return ("选必" if head in ("选择性必修", "选必") else "必") + num
    return BOOK_PREFIX.get(s, s)


def norm_title(t):
    """章标题归一化：去空白、全角空格，剥掉末尾括号注记（知识树里会给章加备注后缀）。"""
    s = re.sub(r"[\s\u3000]+", "", t or "")
    s = re.sub(r"[（(][^）)]*[）)]\s*$", "", s)
    return s


def chap_no(title):
    """从章标题取章号：'第一章 物质及其变化' → '第一章'；无则空。"""
    m = re.match(r"^(第[一二三四五六七八九十百]+章)", title or "")
    return m.group(1) if m else ""


def norm_book(book_title):
    """册标题 → 规范册次：'人教版高中化学 · 必修第一册（2019）' → '必一'。"""
    m = BOOK_KEY.search(book_title or "")
    if not m:
        return ""
    return canon_book(m.group(1) + m.group(2))


def book_chap_of(text):
    """从寄居叶正文里提炼 (册, 章)：'…（必一第二章第三节；…）' → ('必一','第二章')。"""
    m = re.search(r"（([^）]*)）", text or "")
    inner = m.group(1) if m else (text or "")
    bm = re.search(r"(必[一二三]|选必[一二三]|必修[一二三])", inner)
    cm = re.search(r"(第[一二三四五六七八九十百]+章)", inner)
    if not (bm and cm):
        return None
    return (canon_book(bm.group(1)), cm.group(1))


def strip_prefix(chap_label):
    """'必一·第三章 函数的概念与性质' → ('必一', '第三章 函数的概念与性质')"""
    if "·" in chap_label:
        pre, rest = chap_label.split("·", 1)
        return canon_book(pre), rest.strip()
    return "", chap_label.strip()

SUBJECT_ORDER = ["数学", "物理", "化学"]
# 册次排序：必修优先，选择性必修按册号
BOOK_KEY = re.compile(r"(必修|选择性必修)(第[一二三四五]册)")
CN_NUM = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5}


def book_sort_key(name):
    m = BOOK_KEY.search(name)
    if not m:
        return (9, 9)
    sel = 1 if m.group(1) == "选择性必修" else 0
    return (sel, CN_NUM.get(m.group(2)[1], 9))


def parse_tree():
    """从 知识树.html 抽 29 簇分类 + 每章 ★ 权重。

    返回 {学科: {"clusterCount":n, "clusters":[{name,q,cnt,ex,chapters:[...]}],
                 "chapters":{归一化章标题: {book, title, star, cluster}}}}。
    按文档顺序线性扫描：簇总结 → 其下若干章总结。
    """
    html = TREE.read_text(encoding="utf-8")
    body = html[html.find('<div class="tree">'):]

    # 学科分段
    subj_marks = [(m.start(), m.group(1)) for m in
                  re.finditer(r'<span class="subj (math|phys|chem)">', body)]
    subj_names = {"math": "数学", "phys": "物理", "chem": "化学"}
    out = {}
    for idx, (pos, key) in enumerate(subj_marks):
        end = subj_marks[idx + 1][0] if idx + 1 < len(subj_marks) else len(body)
        seg = body[pos:end]
        name = subj_names[key]
        clusters = []
        chapters = {}
        chapters_by_key = {}
        lodged_index = {}

        tok = re.compile(
            r'<li(?: class="(?P<ex>ex)")?><details class="c-cluster"[^>]*><summary>'
            r'<span class="cluster"><span class="chip">(?P<chip>[^<]*)</span>'
            r'<span class="q">(?P<q>[^<]*)</span><span class="cnt">(?P<cnt>[^<]*)</span>'
            r'|'
            r'<span class="chap">(?P<label>[^<]*)<span class="star">(?P<star>[^<]*)</span>'
            r'<span class="n">(?P<n>[^<]*)</span>'
            r'|'
            r'<li class="leaf"><i>(?P<lnum>[^<]*)</i>(?P<ltext>[^<]*)</li>')
        cur = None
        in_chap = False   # 是否已进入某个 c-chap 的叶清单
        for m in tok.finditer(seg):
            if m.group("chip"):
                cur = {"name": m.group("chip").strip(), "q": m.group("q").strip(),
                       "cnt": m.group("cnt").strip(), "extra": bool(m.group("ex")),
                       "chapters": [], "lodged": []}
                clusters.append(cur)
                in_chap = False
            elif m.group("label"):
                in_chap = True
                book, title = strip_prefix(m.group("label").strip())
                key = (book, chap_no(title))
                info = {"book": book, "title": title,
                        "star": (m.group("star") or "").strip(),
                        "sections": (m.group("n") or "").strip(),
                        "cluster": cur["name"] if cur else ""}
                chapters[norm_title(title)] = info
                chapters_by_key.setdefault((book, chap_no(title)), []).append(info)

                if cur is not None:
                    cur["chapters"].append({"book": book, "title": title})
            else:
                # 章内的叶由该章的 sections 负责渲染，不在这里重复记；
                # 只有「章之外」的叶才是真·寄居叶（如化学 1.2/1.3/2.3 被拆出来单挂）
                if in_chap:
                    continue
                ref = book_chap_of(m.group("ltext"))
                if cur is not None:
                    cur["lodged"].append({"num": m.group("lnum").strip(),
                                          "text": m.group("ltext").strip(),
                                          "ref": ref})
                    if ref:
                        lodged_index.setdefault(ref, []).append(cur["name"])
        out[name] = {"clusterCount": len(clusters), "clusters": clusters,
                     "chapters": chapters, "byKey": chapters_by_key,
                     "lodged": lodged_index}
    return out


def parse_book(path):
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()

    book_title = path.stem
    chapters = []
    front = []          # 册首条目（绪言/引言）—— 计条目不计章
    cur_chapter = None
    cur_section = None
    in_source = False

    field_re = re.compile(r"^-\s+\*\*(.+?)\*\*[：:]\s*(.*)$")

    for raw in lines:
        line = raw.rstrip()

        if line.startswith("# ") and not line.startswith("## "):
            book_title = line[2:].strip()
            continue

        if line.startswith("## "):
            head = line[3:].strip()
            if head == "来源":
                in_source = True
                cur_chapter = None
                continue
            in_source = False
            star = ""; note = ""
            m = re.search(r"【(.+?)】", head)
            if m:
                raw = m.group(1).strip()
                head = head[: m.start()].strip()
                sm = re.search(r"★+", raw)
                star = sm.group(0) if sm else ""
                note = re.sub(r"★+", "", raw).strip(" 　·，,")
            cur_chapter = {"title": head, "weight": star, "note": note, "sections": []}
            chapters.append(cur_chapter)
            continue
        # 「## 来源」区块里的正文行要跳过；但册首条目（### 绪言/引言）排在来源之后，须放行
        if in_source and not line.startswith("### "):
            continue
        in_source = False

        if line.startswith("### "):
            head = line[4:].strip()
            m = re.match(r"^([\d.]+)\*?\s*(.+)$", head)
            if m:
                num, name, kind = m.group(1), m.group(2).strip(), "section"
            else:
                num, name, kind = "", head, "extra"
            cur_section = {"num": num, "title": name, "kind": kind, "fields": []}
            if cur_chapter is None:
                # 册首条目（绪言/引言）：排在第一个 ## 章之前，归入 front，不占章号
                front.append(cur_section)
            else:
                cur_chapter["sections"].append(cur_section)
            continue

        m = field_re.match(line)
        if m and cur_section is not None:
            cur_section["fields"].append({
                "label": m.group(1).strip(),
                "value": m.group(2).strip(),
            })

    # 清理：删掉没有节的章
    chapters = [c for c in chapters if c["sections"]]
    for c in chapters:
        c["sectionCount"] = sum(1 for s in c["sections"] if s["kind"] == "section")
        c["extraCount"] = sum(1 for s in c["sections"] if s["kind"] == "extra")
    return {"title": book_title, "front": front, "chapters": chapters}


def main():
    tree = parse_tree()
    subjects = []
    total_sections = 0
    total_body = 0
    total_extra = 0
    unmatched = []
    for subj in SUBJECT_ORDER:
        d = SRC / subj
        tinfo = tree.get(subj, {"clusters": [], "chapters": {}})
        tchap = tinfo["chapters"]
        books = []
        for md in sorted(d.glob("*.md"), key=lambda p: book_sort_key(p.stem)):
            b = parse_book(md)
            book_key = norm_book(b["title"])
            for c in b["chapters"]:
                key = norm_title(c["title"])
                hit = tchap.get(key)
                if hit is None:
                    # 主匹配失败 → 按「去章号」比标题（教材内容与知识树标题写法偶有差异）
                    alt = re.sub(r"^第[一二三四五六七八九十]+章", "", key)
                    hit = next((v for k, v in tchap.items()
                                if re.sub(r"^第[一二三四五六七八九十]+章", "", k) == alt), None)
                if hit is None:
                    # 再退：按 (册, 章号) 精确匹配——化学必修一第一章在树里被拆成三片寄居叶，
                    # 没有 chap 节点，只能靠册+章号认领
                    cands = tinfo["byKey"].get((book_key, chap_no(c["title"]))) or []
                    hit = cands[0] if cands else None
                if hit:
                    c["star"] = hit["star"] or c.get("weight", "")
                    c["clusters"] = [hit["cluster"]] if hit.get("cluster") else []
                    c["treeBook"] = hit["book"]
                    c["treeSections"] = hit["sections"]
                else:
                    c["star"] = c.get("weight", "")
                    c["clusters"] = []
                ref = (book_key, chap_no(c["title"]))
                for cl in tinfo["lodged"].get(ref, []):
                    if cl not in c["clusters"]:
                        c["clusters"].append(cl)
                c["cluster"] = c["clusters"][0] if c["clusters"] else ""
                # 章在树里可能没有 chap 节点（如化学必修一第一章被拆成三片寄居叶），
                # 只要最终认到了簇就不算漏
                if not c["clusters"]:
                    unmatched.append(f"{subj}/{b['title'][:16]}/{c['title']}")
            front = b["front"]
            n = sum(len(c["sections"]) for c in b["chapters"]) + len(front)
            nb = sum(c["sectionCount"] for c in b["chapters"]) + sum(
                1 for s in front if s["kind"] == "section")
            ne = sum(c["extraCount"] for c in b["chapters"]) + sum(
                1 for s in front if s["kind"] == "extra")
            b["sectionCount"] = n
            b["bodyCount"] = nb
            b["extraCount"] = ne
            b["chapterCount"] = len(b["chapters"])
            b["frontCount"] = len(front)
            total_sections += n
            total_body += nb
            total_extra += ne
            books.append(b)
        subjects.append({
            "name": subj,
            "clusters": tinfo["clusters"],
            "clusterCount": tinfo["clusterCount"],
            "books": books,
            "chapterCount": sum(b["chapterCount"] for b in books),
            "sectionCount": sum(b["sectionCount"] for b in books),
            "bodyCount": sum(b["bodyCount"] for b in books),
            "extraCount": sum(b["extraCount"] for b in books),
        })

    data = {
        "meta": {
            "source": "人教版 2019 · 教材内容层（教材要点整理，非原文复制）",
            "subjects": len(subjects),
            "chapters": sum(s["chapterCount"] for s in subjects),
            "clusters": sum(s["clusterCount"] for s in subjects),
            "entries": total_sections,
            "bodySections": total_body,
            "extras": total_extra,
            "unmatchedChapters": unmatched,
        },
        "subjects": subjects,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, ensure_ascii=False, indent=1)
    OUT.write_text(payload, encoding="utf-8")
    # 同时产出一份 JS 全局量：页面可直接 <script src> 加载，file:// 打开也零 CORS 问题
    OUT_JS.parent.mkdir(parents=True, exist_ok=True)
    OUT_JS.write_text(
        "/* 自动生成，勿手改 —— 源：tools/build_data.py */\n"
        "window.GEWU_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8")

    # 轻量摘要：落地页只要统计口径与簇名，不背 350KB 全文
    summary = {
        "meta": {k: v for k, v in data["meta"].items() if k != "unmatchedChapters"},
        "subjects": [{
            "name": s["name"], "clusterCount": s["clusterCount"],
            "chapterCount": s["chapterCount"], "sectionCount": s["sectionCount"],
            "bodyCount": s["bodyCount"], "extraCount": s["extraCount"],
            "books": [{"title": b["title"], "chapterCount": b["chapterCount"],
                       "bodyCount": b["bodyCount"], "extraCount": b["extraCount"]}
                      for b in s["books"]],
            "clusters": [{"name": c["name"], "q": c["q"], "cnt": c["cnt"],
                          "chapters": c["chapters"], "lodged": c["lodged"]} for c in s["clusters"]],
        } for s in subjects],
    }
    OUT_SUM.write_text(
        "/* 自动生成，勿手改 —— 源：tools/build_data.py */\n"
        "window.GEWU_SUMMARY = " + json.dumps(summary, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8")

    print(f"写入 {OUT}")
    print(f"写入 {OUT_JS}")
    print(f"写入 {OUT_SUM}")
    print(f"meta: {data['meta']}")
    for s in subjects:
        print(f"  {s['name']}: {len(s['books'])} 册 / {s['chapterCount']} 章 / "
              f"{s['clusterCount']} 簇 / 正文 {s['bodyCount']} 节 + 栏目 {s['extraCount']} 条 "
              f"= {s['sectionCount']} 条")
        for c in s["clusters"]:
            print(f"      簇 {c['name'][:26]:28s} {c['cnt']:>10s}  (章 {len(c['chapters'])})")
    if unmatched:
        print(f"  !! 未能对齐知识树的章 {len(unmatched)}：")
        for u in unmatched:
            print("     -", u)
    else:
        print("  章→簇 对齐：全部命中")

    # 字段名清单（供前端做栏位说明）
    labels = {}
    for s in subjects:
        for b in s["books"]:
            for c in b["chapters"]:
                for sec in c["sections"]:
                    for f in sec["fields"]:
                        labels.setdefault(s["name"], set()).add(f["label"])
    for k, v in labels.items():
        print(f"  栏位[{k}]: {' / '.join(sorted(v))}")


if __name__ == "__main__":
    main()
