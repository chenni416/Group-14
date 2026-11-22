"""把 AI 稽核紀錄（app/ai/audit.py 寫的 JSON Lines）轉成方便閱讀的 HTML 頁面。

開發環境打開 `GET /api/dev/ai-logs/view` 即可。每個請求一張卡片，依處理順序顯示：
1 前端送來的請求 → 2 每次模型呼叫（提示詞、模型、token、原始回傳）→ 3 程式的捨棄與修正 → 4 回給網頁的內容。
"""

import json
from html import escape
from typing import Any

KIND_LABELS = {
    "dedupe_source_lines": "來源行號重複，已去重",
    "drop_source_lines": "捨棄編造的來源行號",
    "drop_story_dependencies": "捨棄無效的 Story 相依",
    "empty_result": "模型沒有產出可用結果",
    "drop_dependency_cycle": "移除循環相依",
    "drop_unknown_story_tasks": "捨棄 Story 不存在的 Task",
    "snap_story_points": "點數調整到允許值",
    "normalize_branch_slug": "整理 branch 名稱",
    "drop_unknown_task_dependencies": "捨棄無效的 Task 相依",
    "no_assignee": "沒有有效的指派人選",
    "drop_unknown_deferral_ids": "捨棄不存在的延後項目",
    "add_dependent_deferrals": "連帶延後依賴它們的 Task",
    "flag_overload": "超出 capacity，已在理由註明",
    "drop_assignment": "捨棄無效的指派",
    "unassigned_tasks": "模型漏掉的指派",
    "drop_reassignment": "捨棄無效的改派建議",
    "recompute_fits": "程式重算 fits",
    "drop_invalid_questions": "捨棄無效的待釐清問題",
    "truncate_questions": "問題過多，只保留前幾個",
    "drop_dependency": "捨棄無效的相依",
    "adjust_risk": "校正相依風險",
    "clamp_day_offset": "天數超出 Sprint 範圍，已調整",
    "clear_ac_index": "驗收條件編號不存在，已清除",
    "drop_empty_items": "捨棄空白項目",
    "reorder_due_date": "日期順序顛倒，已調整",
    "drop_unknown_ac_index": "捨棄編號不存在的驗收判斷",
    "default_unclear": "模型漏掉的驗收條件，標為 unclear",
    "downgrade_met": "沒有通過的測試，met 降為 unclear",
    "drop_unknown_sources": "捨棄沒有提供過的文件名稱",
}

STYLE = """
:root{--bg:#f6f6f4;--card:#fff;--ink:#1c1c1a;--mute:#6b6b66;--line:#e4e4df;--ok:#1a7f4b;--bad:#b3261e;--warn:#9a6700;--code:#f1f1ee}
@media (prefers-color-scheme:dark){:root{--bg:#161614;--card:#1f1f1c;--ink:#ecece8;--mute:#9a9a93;
--line:#34342f;--ok:#4cc38a;--bad:#ff8a80;--warn:#e3b341;--code:#272723}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 -apple-system,"Segoe UI","Noto Sans TC",sans-serif}
main{max-width:980px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:22px;margin:0 0 4px}
.sub{color:var(--mute);margin:0 0 20px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:0 0 20px}
.head{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin-bottom:10px}
.title{font-weight:600;font-size:17px}
.badge{padding:2px 10px;border-radius:99px;font-size:13px;font-weight:600;border:1px solid currentColor}
.ok{color:var(--ok)}
.bad{color:var(--bad)}
.warn{color:var(--warn)}
.mute{color:var(--mute);font-size:13px}
.stats{display:flex;flex-wrap:wrap;gap:6px 18px;margin:0 0 6px;font-size:14px}
.stats b{font-variant-numeric:tabular-nums}
h3{font-size:14px;margin:18px 0 6px;color:var(--mute);letter-spacing:.04em}
pre{background:var(--code);border-radius:8px;padding:10px 12px;margin:6px 0;overflow:auto;
max-height:420px;white-space:pre-wrap;word-break:break-word;font:13px/1.55 ui-monospace,Consolas,monospace}
details{border:1px solid var(--line);border-radius:10px;padding:8px 12px;margin:8px 0}
summary{cursor:pointer;font-weight:600}
table{border-collapse:collapse;width:100%;font-size:14px}
td,th{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
ul{margin:6px 0;padding-left:20px}
li{margin:4px 0}
.none{color:var(--mute)}
"""


def _pretty(value: Any) -> str:
    """JSON 字串或物件 → 縮排後的文字（中文不跳脫）"""
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            return value
    return json.dumps(value, ensure_ascii=False, indent=2)


def _pre(value: Any) -> str:
    return f"<pre>{escape(_pretty(value))}</pre>"


def _call(call: dict[str, Any]) -> str:
    err = call.get("error")
    meta = (
        f"<div class='stats'><span>模型 <b>{escape(str(call.get('model')))}</b></span>"
        f"<span>temperature <b>{escape(str(call.get('temperature')))}</b></span>"
        f"<span>輸出格式 <b>{escape(str(call.get('schema') or '純文字'))}</b></span>"
        f"<span>token <b>{call.get('prompt_tokens') or '—'}</b> 進 / <b>{call.get('completion_tokens') or '—'}</b> 出"
        f"（共 <b>{call.get('total_tokens') or '—'}</b>）</span>"
        f"<span>耗時 <b>{call.get('duration_ms')}</b> ms</span>"
        f"<span>結束原因 <b>{escape(str(call.get('finish_reason') or '—'))}</b></span></div>"
    )
    out = f"<h3>② 第 {call['seq']} 次呼叫模型</h3>{meta}"
    if err:
        out += f"<p class='bad'>呼叫失敗：{escape(err)}</p>"
    out += f"<details><summary>提示詞（system）{len(call.get('system_prompt') or '')} 字</summary>"
    out += f"<pre>{escape(call.get('system_prompt') or '')}</pre></details>"
    out += "<details><summary>送給模型的資料（user）</summary>"
    out += f"<pre>{escape(call.get('user_message') or '')}</pre></details>"
    if call.get("refusal"):
        out += f"<p class='bad'>模型拒絕：{escape(str(call['refusal']))}</p>"
    if call.get("raw_output") is not None:
        out += f"<details open><summary>模型原始回傳</summary>{_pre(call['raw_output'])}</details>"
    return out


def _adjustments(items: list[dict[str, Any]]) -> str:
    if not items:
        return "<p class='none'>這次沒有捨棄或修正任何內容。</p>"
    rows = "".join(
        f"<tr><td class='warn'>{escape(KIND_LABELS.get(a['kind'], a['kind']))}</td>"
        f"<td>{escape(a['detail'])}</td><td class='mute'>第 {a['after_call']} 次</td></tr>"
        for a in items
    )
    return f"<table><tr><th>類型</th><th>說明</th><th>對應</th></tr>{rows}</table>"


def _card(rec: dict[str, Any]) -> str:
    req, res, tot = rec["request"], rec["response"], rec["totals"]
    ok = res["status"] < 400
    head = (
        f"<div class='head'><span class='title'>{escape(req['method'])} {escape(req['path'])}</span>"
        f"<span class='badge {'ok' if ok else 'bad'}'>{res['status']}</span>"
        f"<span class='mute'>{escape(rec['started_at'].replace('T', ' ')[:19])} UTC　身分 {escape(req['member'])}"
        f"　#{escape(rec['id'])}</span></div>"
        f"<div class='stats'><span>呼叫模型 <b>{tot['calls']}</b> 次</span>"
        f"<span>token 共 <b>{tot['total_tokens']}</b>"
        f"（進 {tot['prompt_tokens']} / 出 {tot['completion_tokens']}）</span>"
        f"<span>總耗時 <b>{rec['duration_ms']}</b> ms</span>"
        f"<span>程式修正 <b>{len(rec['adjustments'])}</b> 項</span></div>"
    )
    body = "<h3>① 前端送來的請求</h3>" + _pre(req.get("body"))
    body += "".join(_call(c) for c in rec["llm_calls"])
    body += "<h3>③ 程式對模型輸出的捨棄與修正</h3>" + _adjustments(rec["adjustments"])
    body += "<h3>④ 回給網頁的內容</h3>" + _pre(res.get("body"))
    if res.get("error"):
        body += f"<p class='bad'>處理時發生例外：{escape(res['error'])}</p>"
    return f"<section class='card'>{head}{body}</section>"


def render_html(records: list[dict[str, Any]]) -> str:
    cards = (
        "".join(_card(r) for r in records)
        or "<p class='none'>還沒有紀錄。呼叫任何會用到 AI 的 API 之後再重新整理。</p>"
    )
    return (
        "<!doctype html><html lang='zh-Hant'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        f"<title>AI 呼叫紀錄</title><style>{STYLE}</style></head><body><main>"
        f"<h1>AI 呼叫紀錄</h1><p class='sub'>最近 {len(records)} 筆，新的在前面。重新整理頁面即可更新。"
        "原始資料：<a href='/api/dev/ai-logs'>/api/dev/ai-logs</a></p>"
        f"{cards}</main></body></html>"
    )
