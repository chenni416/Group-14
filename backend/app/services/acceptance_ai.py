"""G5：AI 驗收檢查。

AI 只整理證據與疑點；事實性欄位（測試結果、變更檔案、缺少的交付項目）直接取自 PR 與交付資料，不採信模型。
"""

from app.ai.llm import LlmClient
from app.ai.prompts import load_prompt
from app.ai.schemas import LlmAcceptance
from app.core.errors import ApiError
from app.schemas.acceptance import AcceptanceCheck, AcceptanceItem, GoalMatch
from app.schemas.task import Task
from app.services._render import block, task_text

_TEST_TEXT = {"passed": "測試通過", "failed": "測試失敗", "none": "沒有測試結果"}


def _lines(text: str) -> list[str]:
    cleaned = (line.strip().lstrip("-•").strip() for line in text.splitlines())
    return [line for line in cleaned if line]


def check_delivery(task: Task, llm: LlmClient) -> AcceptanceCheck:
    delivery = task.delivery
    if delivery is None:
        raise ApiError("成員尚未提交交付內容，無法檢查", status=409, code="NO_DELIVERY")
    if not task.acceptance_criteria:
        raise ApiError("這個任務沒有驗收條件，無法檢查", status=409, code="NO_ACCEPTANCE_CRITERIA")

    pr = task.pr
    tests = (pr.tests if pr else None) or "none"
    changed = (pr.changed_files if pr else None) or []
    provided = "\n".join(f"- [{'已提供' if d.provided else '未提供'}] {d.text}" for d in delivery.deliverables)
    delivery_text = (
        f"PR：{delivery.pr_url}\n交付項目：\n{provided}\n測試說明：{delivery.test_note or '（未填）'}\n"
        f"未完成事項：{delivery.unfinished or '（無）'}\n想確認的問題：{delivery.questions or '（無）'}"
    )
    pr_text = (
        f"測試結果：{_TEST_TEXT[tests]}\n變更檔案：{', '.join(changed) or '（無資料）'}\n"
        f"PR 摘要：{(pr.summary if pr else None) or '（無）'}"
    )
    result = llm.generate_json(
        system=load_prompt("acceptance_check"),
        user=block("task_spec", task_text(task))
        + "\n\n"
        + block("delivery", delivery_text)
        + "\n\n"
        + block("pull_request", pr_text),
        schema=LlmAcceptance,
    )

    # 每條驗收條件都要有結果；模型漏掉的標為 unclear，不能預設為通過
    by_index = {i.ac_index: i for i in result.items if 0 <= i.ac_index < len(task.acceptance_criteria)}
    items = [
        AcceptanceItem(
            ac=ac,
            ai=by_index[i].verdict if i in by_index else "unclear",
            evidence=by_index[i].evidence if i in by_index else "AI 沒有針對這條提供判斷，請 Reviewer 自行確認。",
            reviewer=None,
            note="",
        )
        for i, ac in enumerate(task.acceptance_criteria)
    ]
    # 沒有通過的測試結果時，與測試有關的條件不能判為 met
    if tests != "passed":
        for item in items:
            if item.ai == "met" and "測試" in item.ac:
                item.ai = "unclear"
    missing = [d.text for d in delivery.deliverables if not d.provided]
    return AcceptanceCheck(
        task_id=task.id,
        items=items,
        deliverables_complete=not missing,
        missing_deliverables=missing,
        goal_match=[GoalMatch(label=g.label, verdict=g.verdict, detail=g.detail) for g in result.goal_match],
        tests=tests,
        test_summary=_TEST_TEXT[tests] + (f"：{delivery.test_note}" if delivery.test_note else ""),
        unfinished=_lines(delivery.unfinished),
        questions=_lines(delivery.questions),
        changed_files=changed,
        summary=result.summary,
    )
