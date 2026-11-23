"""假資料：取自前端 frontend/src/mocks/data（5 位成員、Sprint 2 的 10 張任務、規劃中的 Sprint 3）"""

from datetime import UTC, datetime, timedelta

from app.ai.context import DocSnippet
from app.repo.memory import MemoryStore
from app.schemas.acceptance import DeliverableItem, Delivery
from app.schemas.collab import Notification
from app.schemas.member import Member
from app.schemas.project import KnowledgeDoc, Organization, Project, ReviewPolicy, Team
from app.schemas.sprint import BacklogItem, Sprint
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


def _knowledge_docs() -> list[KnowledgeDoc]:
    def d(id, name, kind, size, chunks, is_link=False):
        return KnowledgeDoc(id=id, name=name, kind=kind, size=size, progress=100, chunks=chunks, is_link=is_link)

    return [
        d("d1", "PRD_v2.md", "PRD", "38 KB", 42),
        d("d2", "系統架構圖.png", "架構圖", "1.2 MB", 6),
        d("d3", "openapi.yaml", "API 規格", "64 KB", 58),
        d("d4", "CODING_STANDARDS.md", "Coding Standards", "12 KB", 15),
        d("d5", "README.md", "README", "8 KB", 9),
        d("d6", "Figma · Taskline UI Kit v2", "Figma", "連結", 24, True),
    ]


def _backlog() -> list[BacklogItem]:
    return [
        BacklogItem(
            id="b1",
            text="Email 推播提醒：指派與審查事件寄信通知",
            from_sprint="Sprint 2",
            kind="deferred",
            task_id=None,
            used_in_sprint_id=None,
            decision=None,
        ),
        BacklogItem(
            id="b2",
            text="AI 拆解準確率評估：建立標註資料集並每個 Sprint 追蹤",
            from_sprint="Sprint 1",
            kind="multi",
            task_id=None,
            used_in_sprint_id=None,
            decision=None,
        ),
    ]


def _notifications() -> list[Notification]:
    now = datetime.now(UTC)

    def n(i, to_id, type, task_id, from_id, text, hours, status="pending"):
        created = (now - timedelta(hours=hours)).isoformat(timespec="seconds")
        return Notification(
            id=f"n{i}",
            to_id=to_id,
            from_id=from_id,
            type=type,
            task_id=task_id,
            text=text,
            created_at=created,
            status=status,
        )

    pool = "PR #34 已開啟，任何有空的成員都可以領取審查"
    return [
        n(1, "m1", "review", "S-212", "m3", "請你以 Leader 身分審查此任務的 PR #31", 3),
        *[n(2 + i, to, "pool", "S-231", "m5", pool, 1) for i, to in enumerate(["m1", "m2", "m3", "m4"])],
        n(6, "m4", "review", "S-232", "m1", "請你審查 PR #32（指定成員，需全員同意）", 6),
        n(7, "m4", "info", "S-221", "m1", "你已領取此任務的審查", 2),
    ]


def build_seed(planning_sprint: bool = True) -> MemoryStore:
    """planning_sprint=False：不預建規劃中的 Sprint 3，從畫面的「建立 Sprint」開始（同前端 mock 的起點）"""
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
        sprints={2: sprint2, 3: sprint3} if planning_sprint else {2: sprint2},
        tasks={t.id: t for t in _sprint2_tasks()},
        docs=_docs(),
        active_sprint_id=2,
        planning_sprint_id=3 if planning_sprint else None,
        org=Organization(
            name="NYCU ATLAB",
            slug="atlab",
            plan="Team",
            teams=[
                Team(name="第 3 組 · Taskline", member_count=5, current=True),
                Team(name="第 1 組 · 校園二手平台", member_count=4, current=False),
                Team(name="第 5 組 · 課程評價爬蟲", member_count=4, current=False),
            ],
        ),
        project=Project(
            name="Taskline — 會議到交付平台",
            goal="讓團隊在每次 Sprint Planning 後，都清楚誰負責什麼、做到哪裡，並能根據實際成果持續調整計畫。",
            prefix="TL",
            provider="GitHub",
            repo="github.com/atlab/taskline",
            branch_pattern="feature/{prefix}-{id}-{slug}",
            sprint_length="2 週",
            default_policy=POOL,
            active_sprint_id=2,
            planning_sprint_id=3 if planning_sprint else None,
        ),
        knowledge_docs=_knowledge_docs(),
        notifications=_notifications(),
        backlog=_backlog(),
    )
    return store
