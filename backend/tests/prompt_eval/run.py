"""執行 Prompt 測試集。在 backend/ 資料夾執行：

    uv run python -m tests.prompt_eval.run --static    # 不呼叫 API：檢查提示詞與輸出欄位、輸入區塊是否一致
    uv run python -m tests.prompt_eval.run --dry-run   # 不呼叫 API：輸出每個案例的 system／user，可貼到網頁版測試
    uv run python -m tests.prompt_eval.run             # 呼叫 API 跑全部案例（需要 .env 的 OPENAI_API_KEY）
    uv run python -m tests.prompt_eval.run --case C08 --repeat 3
    uv run python -m tests.prompt_eval.run --prompts-dir /tmp/v01/backend/app/ai/prompts --label v0.1

結果寫在 tests/prompt_eval/results/<時間>-<label>/：summary.md（給人看）、raw.jsonl（每次呼叫的完整輸入輸出）。
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from app.ai import prompts as prompt_module
from app.core.config import get_settings

from .cases import CASES
from .harness import Case, RecordingLlm
from .static_checks import render, static_checks

HERE = Path(__file__).parent


def _out_dir(label: str) -> Path:
    path = HERE / "results" / f"{datetime.now():%Y%m%d-%H%M}-{label}"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _dump(value):
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if isinstance(value, dict):
        return {k: _dump(v) for k, v in value.items()}
    if isinstance(value, list | tuple):
        return [_dump(v) for v in value]
    return value


def run_static() -> int:
    results = static_checks()
    failed = [(who, c) for who, c in results if not c.passed]
    for who, c in results:
        print(f"{'✅' if c.passed else '❌'} {who:<18} {c.name}{'' if c.passed else '｜' + c.detail}")
    print(f"\n靜態檢查：{len(results) - len(failed)}/{len(results)} 通過")
    return 1 if failed else 0


def run_dry(cases: list[Case], label: str) -> int:
    out = _out_dir(f"{label}-dryrun")
    for case in cases:
        schema, system, user = render(case)
        (out / f"{case.id}_{case.prompt}.txt").write_text(
            f"# {case.id} {case.title}\n# 輸出格式：app/ai/schemas.py 的 {schema}\n\n"
            f"===== SYSTEM =====\n{system}\n\n===== USER =====\n{user}\n",
            encoding="utf-8",
        )
    print(f"已輸出 {len(cases)} 個案例的提示詞到 {out}")
    return 0


def run_live(cases: list[Case], repeat: int, label: str) -> int:
    from app.ai.llm import get_llm  # 延後匯入：沒有金鑰時 --static / --dry-run 仍可使用

    settings = get_settings()
    llm = get_llm()
    out = _out_dir(label)
    rows: list[str] = []
    total_pass = total = 0
    with (out / "raw.jsonl").open("w", encoding="utf-8") as raw_file:
        for case in cases:
            per_check: dict[str, list[bool]] = {}
            details: dict[str, str] = {}
            latency: list[int] = []
            for attempt in range(1, repeat + 1):
                rec = RecordingLlm(llm)
                try:
                    result = case.run(rec)
                    checks = case.check(rec, result)
                    error = ""
                except Exception as exc:  # noqa: BLE001 - 測試工具：記錄錯誤後繼續下一個案例
                    result, checks, error = None, [], repr(exc)
                    per_check.setdefault("執行沒有錯誤", []).append(False)
                    details["執行沒有錯誤"] = error
                for c in checks:
                    per_check.setdefault(c.name, []).append(c.passed)
                    if not c.passed:
                        details[c.name] = c.detail
                latency.extend(call.latency_ms for call in rec.calls)
                for call in rec.calls:
                    record = {
                        "case": case.id,
                        "attempt": attempt,
                        "label": label,
                        "schema": call.schema,
                        "system": call.system,
                        "user": call.user,
                        "output": _dump(call.output),
                        "latency_ms": call.latency_ms,
                    }
                    raw_file.write(json.dumps(record, ensure_ascii=False) + "\n")
                raw_file.write(
                    json.dumps(
                        {"case": case.id, "attempt": attempt, "result": _dump(result), "error": error},
                        ensure_ascii=False,
                    )
                    + "\n"
                )
            passed = sum(all(v) for v in per_check.values())
            total_pass += passed
            total += len(per_check)
            status = "✅" if passed == len(per_check) else "❌"
            print(f"{status} {case.id} {case.title}：{passed}/{len(per_check)}")
            failed_lines = [
                f"    - ❌ {name}（{sum(v)}/{len(v)} 次通過）：{details.get(name, '')[:150]}"
                for name, v in per_check.items()
                if not all(v)
            ]
            avg = sum(latency) // len(latency) if latency else 0
            rows.append(
                f"| {case.id} | {case.agent} | `{case.prompt}` | {case.type} | {case.title} | "
                f"{passed}/{len(per_check)} | {avg} ms |"
            )
            if failed_lines:
                rows.append("|  |  |  |  | " + "<br>".join(x.strip() for x in failed_lines) + " |  |  |")

    review = "\n".join(f"| {c.id} | {item} |  |  |" for c in cases for item in c.review)
    summary = f"""# Prompt 測試結果：{label}

- 時間：{datetime.now():%Y-%m-%d %H:%M}
- 模型：{settings.openai_model}；temperature：{settings.openai_temperature}（文字 {settings.openai_text_temperature}）
- 提示詞資料夾：{prompt_module._DIR}
- 每個案例執行 {repeat} 次；自動檢查「全部 {repeat} 次都通過」才算通過
- 自動檢查通過：**{total_pass}/{total}**

## 自動檢查

| 案例 | Agent | 提示詞 | 類型 | 情境 | 通過 | 平均延遲 |
|---|---|---|---|---|---|---|
{chr(10).join(rows)}

## 人工評分（0 不符合／1 部分符合／2 符合）

看 raw.jsonl 中對應案例的輸出後填寫。

| 案例 | 項目 | 分數 | 備註 |
|---|---|---|---|
{review}
"""
    (out / "summary.md").write_text(summary, encoding="utf-8")
    print(f"\n自動檢查通過 {total_pass}/{total}，結果在 {out}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Taskline Prompt 測試集")
    parser.add_argument("--static", action="store_true", help="只做不需要 API 的檢查")
    parser.add_argument("--dry-run", action="store_true", help="只輸出提示詞，不呼叫 API")
    parser.add_argument("--case", action="append", help="只跑指定案例，可重複，例如 --case C01 --case C08")
    parser.add_argument("--repeat", type=int, default=1, help="每個案例執行次數（檢查穩定度建議 3）")
    parser.add_argument("--prompts-dir", help="改用其他資料夾的提示詞（例如舊版本），比較改前改後")
    parser.add_argument("--label", default="current", help="結果資料夾名稱，例如 v0.2")
    args = parser.parse_args()

    if args.prompts_dir:
        prompt_module._DIR = Path(args.prompts_dir).resolve()
        prompt_module.load_prompt.cache_clear()

    cases = [c for c in CASES if not args.case or c.id in args.case]
    if not cases:
        print("找不到指定的案例")
        return 1
    if args.static:
        return run_static()
    if args.dry_run:
        return run_dry(cases, args.label)
    return run_live(cases, args.repeat, args.label)


if __name__ == "__main__":
    sys.exit(main())
