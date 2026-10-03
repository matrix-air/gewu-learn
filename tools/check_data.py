#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""课程数据层机器门：把「页面上的数字是不是真的」变成退出码。

校验对象：data/curriculum.json
判据（全部必须成立，缺一 exit 1）：
  1. 册数 = 16（数学 5 / 物理 6 / 化学 5）
  2. 章数 = 65（数学 18 / 物理 27 / 化学 20）
  3. 簇数 = 29（数学 11 / 物理 8 / 化学 10）
  4. 正文节 = 258 / 栏目条 = 42 / 总条目 = 300
  5. 每章都有簇归属（cluster 非空）
  6. 每条 section 至少 1 个栏位，且栏位名在该科白名单内
  7. 每科栏位覆盖完整（数学 5 栏 / 物理 6 栏 / 化学 6 主栏）
用法: python3 tools/check_data.py
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "curriculum.json"

EXPECT = {
    "books": {"数学": 5, "物理": 6, "化学": 5},
    "chapters": {"数学": 18, "物理": 27, "化学": 20},
    "clusters": {"数学": 11, "物理": 8, "化学": 10},
    "body": {"数学": 73, "物理": 125, "化学": 60},
    "extra": {"数学": 0, "物理": 0, "化学": 42},
}
TOTAL = {"books": 16, "chapters": 65, "clusters": 29, "body": 258, "extra": 42, "entries": 300}

# 各科主栏白名单（化学含栏目条目的补充栏）
MAIN_FIELDS = {
    "数学": {"定义与对象", "公式与结论", "方法与技能", "教材栏目线索", "高考接口"},
    "物理": {"定义与对象", "公式与规律", "模型与方法", "实验要点", "教材栏目线索", "高考接口"},
    "化学": {"核心概念", "关键方程式", "性质与转化", "实验要点", "教材栏目线索", "高考接口"},
}
EXTRA_FIELDS = {"要点", "流程", "误差分析", "安全", "说明", "栏目线索", "栏目要点"}

fails = []
warns = []


def chk(cond, msg):
    if cond:
        print(f"  PASS  {msg}")
    else:
        print(f"  FAIL  {msg}")
        fails.append(msg)


data = json.loads(DATA.read_text(encoding="utf-8"))
meta = data["meta"]
subs = {s["name"]: s for s in data["subjects"]}

print("格物 · 课程数据层校验（机器门）")
print("=" * 56)

print("[1] 册数")
for name, n in EXPECT["books"].items():
    chk(len(subs[name]["books"]) == n, f"{name} 册数 {len(subs[name]['books'])} == {n}")

print("[2] 章数")
for name, n in EXPECT["chapters"].items():
    got = subs[name]["chapterCount"]
    chk(got == n, f"{name} 章数 {got} == {n}")

print("[3] 簇数")
for name, n in EXPECT["clusters"].items():
    got = subs[name]["clusterCount"]
    chk(got == n, f"{name} 簇数 {got} == {n}")

print("[4] 条目数")
for name in EXPECT["body"]:
    b, e = subs[name]["bodyCount"], subs[name]["extraCount"]
    chk(b == EXPECT["body"][name], f"{name} 正文节 {b} == {EXPECT['body'][name]}")
    chk(e == EXPECT["extra"][name], f"{name} 栏目条 {e} == {EXPECT['extra'][name]}")
chk(meta["entries"] == TOTAL["entries"],
    f"总条目 {meta['entries']} == {TOTAL['entries']}（正文 {meta['bodySections']} + 栏目 {meta['extras']}）")
chk(meta["bodySections"] == TOTAL["body"], f"正文总 {meta['bodySections']} == {TOTAL['body']}")
chk(meta["extras"] == TOTAL["extra"], f"栏目总 {meta['extras']} == {TOTAL['extra']}")
chk(meta["clusters"] == TOTAL["clusters"], f"簇总 {meta['clusters']} == {TOTAL['clusters']}")
chk(not meta.get("unmatchedChapters"), f"章→簇零漏配（未配 {len(meta.get('unmatchedChapters') or [])} 章）")

print("[5] 章必有簇归属")
orphan = []
for name, s in subs.items():
    for b in s["books"]:
        for c in b["chapters"]:
            if not c.get("clusters"):
                orphan.append(f"{name}/{c['title']}")
chk(not orphan, f"全部 {TOTAL['chapters']} 章都有簇（孤儿 {len(orphan)}）")

print("[6] 条目必有栏位 + 栏位名合法")
empt, bad = [], []
for name, s in subs.items():
    allow = MAIN_FIELDS[name] | EXTRA_FIELDS
    for b in s["books"]:
        for c in b["chapters"]:
            for sec in c["sections"]:
                if not sec["fields"]:
                    empt.append(f"{name}/{sec['num']}{sec['title']}")
                for f in sec["fields"]:
                    if f["label"] not in allow:
                        bad.append(f"{name}/{f['label']}")
chk(not empt, f"每条都至少 1 个栏位（空条目 {len(empt)}）")
chk(not bad, f"栏位名全在白名单内（越界 {len(bad)}）")
if bad:
    for x in sorted(set(bad))[:10]:
        print("       -", x)

print("[7] 每科主栏覆盖完整")
for name, s in subs.items():
    seen = set()
    for b in s["books"]:
        for c in b["chapters"]:
            for sec in c["sections"]:
                seen |= {f["label"] for f in sec["fields"]}
    missing = MAIN_FIELDS[name] - seen
    chk(not missing, f"{name} 主栏齐全（缺 {sorted(missing) if missing else '无'}）")

# 数学无「实验要点」栏属于事实（教材层就没有），记为已知差异而非缺陷
if any(f["label"] == "实验要点" for name in ("数学",) for b in subs[name]["books"]
       for c in b["chapters"] for sec in c["sections"] for f in sec["fields"]):
    warns.append("数学出现「实验要点」栏——与既有口径不符，需复核")
print("  NOTE  数学无「实验要点」栏属教材事实（非缺陷）")

print("=" * 56)
if warns:
    for w in warns:
        print("  WARN ", w)
print(f"结论：{'全部 PASS' if not fails else f'{len(fails)} 项 FAIL'}")
sys.exit(1 if fails else 0)
