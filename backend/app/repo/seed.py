"""假資料：取自前端 frontend/src/mocks/data（5 位成員、Sprint 2 的 10 張任務、規劃中的 Sprint 3）"""

from app.ai.context import DocSnippet
from app.repo.memory import MemoryStore
from app.schemas.acceptance import DeliverableItem, Delivery
from app.schemas.member import Member
from app.schemas.project import ReviewPolicy
from app.schemas.sprint import Sprint
from app.schemas.task import PullRequest, Task

POOL = ReviewPolicy(mode="pool", targets=[], rule="any")
LEADER = ReviewPolicy(mode="leader", targets=[], rule="any")

SAMPLE_MINUTES = """# Sprint 3 規劃會議（11/09）：對話式 Prompt Studio 與 PR Review 機制
Sprint Goal：讓成員能在任務內與 AI 對話微調 Prompt，並上線彈性 Review 機制

## 討論重點
- 任務詳情要改成左右分割，右邊是可以問專案問題的 AI 對話
- Prompt 要能隨對話更新，保留版本可以還原
- Review 要支援三種模式：Leader 專審、團隊搶單、指定成員
- 看板 In Review 卡片要顯示誰在審、審了多久
- 需要 GitHub PR webhook，PR 開啟時自動進 In Review
- 通知中心：成員可以接受或協商轉移
- E2E 測試涵蓋認領與 Review 流程"""

SPRINT3_GOAL = "讓成員能在任務內與 AI 對話微調 Prompt，並上線彈性 Review 機制"


def make_task(
    id: str, sprint_id: int, title: str, domain: str, story_points: int, assignee_id: str, state: str, **over
) -> Task:
    base = dict(
        id=id,
        sprint_id=sprint_id,
        title=title,
        description=f"{title}。詳細規格見 PRD 對應章節。",
        domain=domain,
        tags=[],
        story_points=story_points,
        story_points_reason="",
        acceptance_criteria=["功能符合 PRD 描述的使用情境", "通過 Code Review 與既有測試"],
        epic="",
        story="",
        origin="human",
        edited=False,
        state=state,
        assignee_id=assignee_id,
        suggested_assignee_id=None,
        suggest_reason="",
        policy=POOL,
        policy_reason="",
        reviewer_id=None,
        approvals=[],
        claimed_at=None,
        review_started_at=None,
        pr=None,
        branch=f"feat/{id.replace('-', '')}",
        negotiation=None,
        source="",
        carry_tag=None,
        multi_sprint=False,
        clarified=False,
        carry=None,
        carry_assignee_id=None,
        carry_points=None,
        carry_status=None,
        depends_on=[],
        return_snapshot=None,
        prev_state=None,
        scope=title,
        out_of_scope="",
        responsibility="",
        deliverables=[],
        plan_confirms=[],
        delivery=None,
    )
    return Task(**{**base, **over})


def _members() -> list[Member]:
    def m(id, name, role, title, domain, tags, capacity):
        return Member(
            id=id,
            name=name,
            email=f"{id}@atlab.tw",
            role=role,
            title=title,
            domain=domain,
            tags=tags,
            capacity=capacity,
        )

    return [
        m("m1", "陳怡君", "Leader", "Frontend Lead", "FE", ["React", "TypeScript", "Tailwind", "Figma"], 8),
        m("m2", "林柏翰", "Member", "Backend Engineer", "BE", ["Python", "FastAPI", "PostgreSQL", "Docker"], 10),
        m("m3", "王思妤", "Member", "AI Engineer", "AI", ["LLM", "RAG", "Python", "LangChain"], 8),
        m("m4", "張家豪", "Member", "QA / DevOps", "QA", ["Playwright", "GitHub Actions", "Docker", "Vitest"], 8),
        m("m5", "李雅婷", "Member", "Product Designer", "DS", ["Figma", "UX Research", "Design System", "React"], 8),
    ]


def _sprint2_tasks() -> list[Task]:
    def pr(n, status="open", **kw):
        return PullRequest(number=n, status=status, url=f"https://github.com/atlab/taskline/pull/{n}", **kw)

    delivery = Delivery(
        pr_url="https://github.com/atlab/taskline/pull/31",
        deliverables=[
            DeliverableItem(text="拆解 Prompt（含 JSON schema）", provided=True),
            DeliverableItem(text="10 筆測試案例與評估結果", provided=False),
        ],
        test_note="用 5 份歷史會議紀錄手動測試，格式皆正確",
        unfinished="- 邊界案例（超長紀錄）尚未處理",
        questions="- 評估集要放在 repo 還是知識庫？",
        submitted_at="2026-11-05",
    )
    return [
        make_task("S-211", 2, "會議紀錄上傳與格式正規化", "BE", 3, "m2", "DONE", reviewer_id="m4", pr=pr(28, "merged")),
        make_task(
            "S-212",
            2,
            "AI 任務拆解 Prompt 設計",
            "AI",
            5,
            "m3",
            "IN_REVIEW",
            policy=LEADER,
            reviewer_id="m1",
            pr=pr(
                31, tests="passed", changed_files=["app/ai/prompts/decompose.md"], summary="新增拆解 Prompt 與 schema"
            ),
            delivery=delivery,
            acceptance_criteria=["輸出符合 Task JSON schema", "附 10 筆測試案例與評估結果", "單元測試通過"],
        ),
        make_task("S-221", 2, "Sprint Planning 雙欄介面", "FE", 3, "m1", "IN_REVIEW", reviewer_id="m4", pr=pr(33)),
        make_task("S-222", 2, "指派推薦演算法服務", "BE", 5, "m2", "IN_PROGRESS", policy=LEADER),
        make_task("S-231", 2, "通知中心 UI 設計稿", "DS", 2, "m5", "IN_REVIEW", pr=pr(34)),
        make_task(
            "S-242", 2, "CI 與 Playwright 測試環境", "QA", 2, "m4", "DONE", reviewer_id="m2", pr=pr(27, "merged")
        ),
        make_task("S-213", 2, "知識庫文件索引 Pipeline", "AI", 3, "m3", "IN_PROGRESS"),
        make_task("S-243", 2, "E2E：登入與專案建立流程", "QA", 2, "m4", "TODO"),
        make_task("S-241", 2, "GitHub OAuth 登入", "BE", 2, "m2", "TODO", policy=LEADER),
        make_task("S-232", 2, "看板卡片元件", "FE", 2, "m1", "IN_REVIEW", reviewer_id="m5", pr=pr(32)),
    ]


def _docs() -> list[DocSnippet]:
    """專案文件（假資料）。RAG 完成前，AI 功能直接帶入這幾份的全文"""
    return [
        DocSnippet(
            "PRD_v2.md",
            "Taskline 讓團隊在 Sprint Planning 後清楚掌握誰負責什麼。任務狀態：To Do、In Progress、In Review、Done。"
            "Review 支援三種模式：Leader 專審、團隊公共池搶單、指定成員（任一人或全員同意）。"
            "AI 產生的內容一律是草稿，需要使用者確認才生效。",
        ),
        DocSnippet(
            "openapi.yaml",
            "POST /api/tasks/{id}/chat 回傳 ChatMessage{id, role, text, sources[], promptAddition}。"
            "GitHub webhook 需驗證 X-Hub-Signature-256（HMAC SHA-256），驗證失敗回傳 401。",
        ),
        DocSnippet(
            "CODING_STANDARD.md", "分支命名 feat/S{編號}-{slug}；每個 PR 需附測試；API 錯誤格式 {code, message}。"
        ),
    ]


def build_seed() -> MemoryStore:
    members = _members()
    capacity = {m.id: m.capacity for m in members}
    sprint2 = Sprint(
        id=2,
        name="Sprint 2",
        start="10/27",
        end="11/07",
        start_date="2026-10-27",
        end_date="2026-11-07",
        goal="完成 AI 拆解與指派推薦的基礎",
        status="active",
        capacity=capacity,
        minutes="",
        docs=[],
        questions=None,
        step=5,
        summary=None,
    )
    sprint3 = Sprint(
        id=3,
        name="Sprint 3",
        start="11/10",
        end="11/21",
        start_date="2026-11-10",
        end_date="2026-11-21",
        goal=SPRINT3_GOAL,
        status="planning",
        capacity=capacity,
        minutes=SAMPLE_MINUTES,
        docs=[],
        questions=None,
        step=2,
        summary=None,
    )
    store = MemoryStore(
        project_goal="讓團隊在每次 Sprint Planning 後，都清楚誰負責什麼、做到哪裡，並能根據實際成果持續調整計畫。",
        members=members,
        sprints={2: sprint2, 3: sprint3},
        tasks={t.id: t for t in _sprint2_tasks()},
        docs=_docs(),
        active_sprint_id=2,
        planning_sprint_id=3,
    )
    return store
