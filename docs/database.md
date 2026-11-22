# 資料庫說明

Taskline 後端的資料表總覽、設計規則與新增資料表的步驟。資料表由 Veronica 負責，有疑問或要新增欄位，請在 PR 或群組討論。

- 資料表定義：`backend/app/models/`（SQLAlchemy）
- 遷移檔：`backend/alembic/versions/`（Alembic）
- GitHub 整合的需求規格：[docs/github.md](github.md)

## 目錄

1. [資料表總覽](#1-資料表總覽)
2. [關係圖](#2-關係圖)
3. [共通規則](#3-共通規則)
4. [設計決定](#4-設計決定)
5. [欄位說明](#5-欄位說明)
6. [尚未完成的部分](#6-尚未完成的部分)
7. [新增資料表的步驟](#7-新增資料表的步驟)
8. [本機開發與常用指令](#8-本機開發與常用指令)

---

## 1. 資料表總覽

| 資料表 | 用途 | 對應前端型別 |
|---|---|---|
| `members` | 登入的使用者，一個 GitHub 帳號一筆 | `Member`（帳號部分） |
| `projects` | 專案，包含綁定的 GitHub repo | `Project` |
| `project_members` | 成員與專案的關係，以及每個專案不同的角色、職稱、容量 | `Member`（專案部分） |
| `project_invitations` | 用 GitHub 帳號邀請成員 | `InviteMemberInput` |
| `sprints` | Sprint，包含會議紀錄全文與 AI 待釐清問題 | `Sprint` |
| `documents` | 專案知識庫與 Sprint 會議文件（檔案本身存在 Supabase Storage） | `KnowledgeDoc`、`SprintDoc` |
| `backlog_items` | 延後或跨 Sprint、要帶到之後規劃的事項 | `BacklogItem` |
| `github_installations` | GitHub App 安裝紀錄 | — |
| `github_pull_requests` | PR 狀態快照 | `PullRequest` |
| `github_commits` | 預設 branch 最近 commit 的快取 | — |
| `github_webhook_events` | GitHub webhook 的原始事件 | — |

前端看到的 `Member` 由 `members` 與 `project_members` 組成：帳號資料（GitHub 名稱、頭像）不分專案，角色、職稱、容量每個專案不同。

---

## 2. 關係圖

```
members ─┬─< project_members >── projects ──○ github_installations
         ├─< project_invitations >─┘  │
         └─（建立者、上傳者等紀錄欄位）│
                                      ├─< sprints ─┬─< documents（會議文件）
                                      │            └─○ backlog_items
                                      ├─< documents（知識庫，sprint_id 為空）
                                      ├─< backlog_items
                                      ├─< github_pull_requests ──○ tasks（尚未建立）
                                      └─< github_commits
github_webhook_events（獨立紀錄，以 installation_id、repo_id 對應）

─<  一對多      ○  可為空的關聯
```

一對多的關係，外鍵放在「多」的那一邊。例如一個 Sprint 有多份文件，所以外鍵是 `documents.sprint_id`。

---

## 3. 共通規則

1. **只用 Alembic 建立與修改資料表**。在 `backend/app/models/` 定義，用 `alembic revision --autogenerate` 產生遷移檔；不要在 Supabase 後台手動建表或改欄位。
2. **每張表都啟用 RLS 且不建立 policy**。遷移檔要手動加上 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`（Alembic 不會自動產生）。後端以資料表擁有者連線，不受影響；前端的 publishable key 則完全讀不到這些表，所有存取都必須經過後端的權限檢查。
3. **主鍵**預設為 `uuid`，由資料庫以 `gen_random_uuid()` 產生。例外：GitHub 提供的 id（`github_installations.installation_id`）與 webhook 的 `delivery_id`；`project_members` 使用 `(project_id, member_id)` 複合主鍵。
4. **列舉值用 `text` + `CHECK` 約束**，不用 PostgreSQL enum：之後新增值只需要改約束。可為空的欄位，空值不受 CHECK 限制（例如 `backlog_items.decision` 為空表示尚未決定）。
5. **時間一律 `timestamptz`**（存 UTC）；只需要日期的欄位用 `date`（例如 Sprint 起訖日）。`updated_at` 由後端在更新時寫入。
6. **GitHub 的 id 一律 `bigint`**，而且是比對依據；帳號名稱、repo 名稱都可能被改名，只作為顯示用。
7. **外鍵的刪除行為**：
   - 從屬資料隨上層刪除（`CASCADE`）：專案刪除時，成員關係、邀請、Sprint、文件、PR、commit 一起刪除；Sprint 刪除時，會議文件一起刪除
   - 紀錄類欄位設為空（`SET NULL`）：例如上傳者、連結 repo 的人、延續事項的來源 Sprint
   - 必填的建立者欄位不設刪除行為：有關聯資料時不能刪除該成員（`projects.created_by_member_id`、`project_invitations.invited_by_member_id`）
8. **拆成獨立的表或用 JSONB**：需要單獨查詢的資料拆成獨立的表（例如通知、留言、任務相依）；總是跟主體一起讀寫的清單或物件用 JSONB 或陣列（例如 `projects.default_policy`、`sprints.capacity`）。
9. **命名規則**由 `app/models/base.py` 自動套用：主鍵 `pk_表名`、唯一 `uq_表名_欄位`、索引 `ix_表名_欄位`、CHECK `ck_表名_名稱`、外鍵 `fk_表名_欄位_參照表`。多欄位索引的第一個欄位相同時，名稱會重複，要手動指定完整名稱（例如 `ix_github_pull_requests_project_id_state`）。

---

## 4. 設計決定

| 問題 | 決定 | 原因 |
|---|---|---|
| 專案目前進行中、規劃中的 Sprint 記在哪？ | **只看 `sprints.status`**，不在 `projects` 存 `active_sprint_id`、`planning_sprint_id`；用部分唯一索引保證每個專案最多一個 `active`、一個 `planning` | 同一件事只記一次（single source of truth），避免兩邊不一致。後端查詢 `status` 組出前端需要的 `activeSprintId`、`planningSprintId` |
| 會議紀錄存在哪？ | 文字存在 `sprints.minutes`；上傳的檔案存 Supabase Storage，資訊存在 `documents` | 每個 Sprint 只有一份會議紀錄，AI 拆解時以行號引用，存成完整文字最方便；檔案太大，不適合放進資料庫 |
| 知識庫文件與 Sprint 文件要分開嗎？ | 共用 `documents`，以 `sprint_id` 區分：為空是知識庫，有值是該 Sprint 的文件 | 兩者欄位相同，只差歸屬 |
| 尚未存在的資料表怎麼辦？ | 先建欄位與索引，外鍵等該表建立後用新的遷移補上 | 遷移可以逐份套用與還原，不需要修改已合併的遷移 |
| `projects` 的 `provider`、`repo` 要存嗎？ | 不存：`provider` 目前固定為 GitHub，`repo` 即 `github_repo_full_name` | 避免重複 |
| `projects.github_repo_id` 的唯一約束 | 一般唯一約束 | PostgreSQL 不把空值視為重複，效果等同「不為空時唯一」：一個 repo 只能綁一個專案，未綁 repo 的專案不受限 |
| 前端的 Sprint id | 前端的數字 id 對應 `sprints.number`（專案內流水號），資料表主鍵另用 uuid | 不同專案都有 Sprint 1 |
| 前端顯示用的格式 | 不存，由後端轉換：Sprint 的 `start`、`end`（MM/DD）、文件的 `size`（38 KB） | 存原始值才能排序、計算 |

---

## 5. 欄位說明

標示「必填」的欄位不能為空；沒有寫預設值的必填欄位，新增時一定要給值。

### `members`

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `auth_user_id` | uuid | ✓ | | Supabase Auth 的使用者 id（JWT 的 `sub`），唯一 |
| `github_id` | bigint | ✓ | | GitHub 使用者 id，唯一，比對以這個為準 |
| `github_login` | text | ✓ | | GitHub 帳號名稱，系統內的使用者 ID 與預設顯示名稱 |
| `display_name` | text | | | 使用者自訂的顯示名稱；為空時顯示 `github_login` |
| `email` | text | | | |
| `avatar_url` | text | | | |
| `last_login_at` | timestamptz | | | |
| `created_at`、`updated_at` | timestamptz | ✓ | `now()` | |

索引：`lower(github_login)`（邀請時不分大小寫查詢）。

### `projects`

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `name` | text | ✓ | | |
| `goal` | text | ✓ | `''` | 專案整體目標 |
| `prefix` | text | ✓ | | 專案代碼，例如 `TL` |
| `branch_pattern` | text | ✓ | `''` | branch 命名規則 |
| `sprint_length` | text | ✓ | `'2 週'` | |
| `default_policy` | jsonb | ✓ | `{"mode": "pool", "targets": [], "rule": "any"}` | 預設 Review 策略，格式同前端 `ReviewPolicy` |
| `created_by_member_id` | uuid | ✓ | | → `members.id` |
| `github_link_status` | text | ✓ | `'none'` | `none`、`pending`、`linked`、`revoked` |
| `github_installation_id` | bigint | | | → `github_installations.installation_id`（SET NULL） |
| `github_repo_id` | bigint | | | 唯一 |
| `github_repo_full_name` | text | | | `owner/name` |
| `github_repo_url` | text | | | |
| `github_default_branch` | text | | | |
| `github_repo_private` | boolean | | | |
| `github_linked_by_member_id` | uuid | | | → `members.id`（SET NULL） |
| `github_linked_at`、`github_last_synced_at` | timestamptz | | | |
| `github_sync_error` | text | | | 最後一次同步失敗的原因 |
| `created_at`、`updated_at` | timestamptz | ✓ | `now()` | |

### `project_members`

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `project_id` | uuid | ✓ | | 複合主鍵；→ `projects.id`（CASCADE） |
| `member_id` | uuid | ✓ | | 複合主鍵；→ `members.id`（CASCADE） |
| `role` | text | ✓ | `'Member'` | `Leader`、`Member` |
| `title` | text | ✓ | `''` | 職稱 |
| `domain` | text | | | `FE`、`BE`、`AI`、`QA`、`DS` |
| `tags` | text[] | ✓ | `{}` | 技能標籤 |
| `capacity` | integer | ✓ | `0` | 每個 Sprint 可承接的點數，`>= 0` |
| `joined_at` | timestamptz | ✓ | `now()` | |

每個專案至少要有一位 Leader，由後端檢查。

### `project_invitations`

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `project_id` | uuid | ✓ | | → `projects.id`（CASCADE） |
| `github_login` | text | ✓ | | 被邀請的帳號，**存小寫** |
| `github_id` | bigint | | | 能查到時一起存 |
| `role`、`title`、`domain`、`capacity` | | | 同 `project_members` | 加入後的設定 |
| `status` | text | ✓ | `'pending'` | `pending`、`accepted`、`declined`、`revoked` |
| `invited_by_member_id` | uuid | ✓ | | → `members.id` |
| `accepted_by_member_id` | uuid | | | → `members.id`（SET NULL） |
| `created_at` | timestamptz | ✓ | `now()` | |
| `responded_at` | timestamptz | | | |

部分唯一索引：同一個專案、同一個帳號只能有一筆 `pending` 邀請；拒絕或撤銷後可以重新邀請。

### `sprints`

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `project_id` | uuid | ✓ | | → `projects.id`（CASCADE） |
| `number` | integer | ✓ | | 專案內的 Sprint 編號，對應前端的 `Sprint.id`；專案內唯一 |
| `name` | text | ✓ | | |
| `start_date`、`end_date` | date | ✓ | | `end_date >= start_date` |
| `goal` | text | ✓ | `''` | |
| `status` | text | ✓ | `'planning'` | `planning`、`active`、`closed`；每個專案最多一個 `active`、一個 `planning` |
| `capacity` | jsonb | ✓ | `{}` | `{成員 id: 點數}` |
| `minutes` | text | ✓ | `''` | **會議紀錄全文** |
| `clarify_questions` | jsonb | | | AI 待釐清問題；**空值表示尚未分析**，`[]` 表示分析過但沒有問題 |
| `planning_step` | smallint | ✓ | `1` | 規劃進度 1～5 |
| `summary` | jsonb | | | 結束時的完成統計；空值表示尚未結束 |
| `created_at`、`updated_at` | timestamptz | ✓ | `now()` | |

### `documents`

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `project_id` | uuid | ✓ | | → `projects.id`（CASCADE） |
| `sprint_id` | uuid | | | → `sprints.id`（CASCADE）；**為空表示專案知識庫** |
| `name` | text | ✓ | | 檔名或連結名稱 |
| `kind` | text | ✓ | `''` | 文件類型，例如 PRD、Figma |
| `is_link` | boolean | ✓ | `false` | 外部連結 |
| `storage_path` | text | | | Supabase Storage 的路徑，唯一；連結為空 |
| `url` | text | | | 外部連結網址；檔案為空 |
| `content_type` | text | | | 例如 `application/pdf` |
| `size_bytes` | bigint | | | 檔案大小 |
| `extracted_text` | text | | | 擷取的純文字，給 AI 組裝脈絡與搜尋使用 |
| `index_progress` | integer | ✓ | `0` | 處理進度 0～100 |
| `chunk_count` | integer | ✓ | `0` | |
| `uploaded_by_member_id` | uuid | | | → `members.id`（SET NULL） |
| `created_at` | timestamptz | ✓ | `now()` | |

CHECK：連結一定要有 `url`，檔案一定要有 `storage_path`。

> **注意**：刪除資料列不會刪除 Storage 裡的檔案。後端刪除文件、Sprint 或專案時，要另外刪除對應的檔案。

### `backlog_items`

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `project_id` | uuid | ✓ | | → `projects.id`（CASCADE） |
| `text` | text | ✓ | | 事項內容 |
| `kind` | text | ✓ | | `deferred`（延後）、`multi`（跨多個 Sprint） |
| `from_sprint_id` | uuid | | | 來源 Sprint → `sprints.id`（SET NULL） |
| `task_id` | uuid | | | 相關任務（外鍵待 `tasks` 建立後補上） |
| `used_in_sprint_id` | uuid | | | 已帶入哪個 Sprint 的會議紀錄 → `sprints.id`（SET NULL） |
| `decision` | text | | | `include`、`keep`、`remove`；空值表示尚未決定 |
| `created_at`、`updated_at` | timestamptz | ✓ | `now()` | |

### GitHub 相關資料表

`github_installations`、`github_pull_requests`、`github_commits`、`github_webhook_events` 的欄位與用途，依 [docs/github.md](github.md) 第 3 節的規格建立，這裡不重複列出。與規格不同的地方：

- `github_pull_requests.task_id`：欄位與索引已建立，外鍵等 `tasks` 建立後補上

---

## 6. 尚未完成的部分

### 待補的外鍵

| 欄位 | 參照 | 時機 |
|---|---|---|
| `github_pull_requests.task_id` | `tasks.id`（SET NULL） | `tasks` 建立後 |
| `backlog_items.task_id` | `tasks.id`（SET NULL） | `tasks` 建立後 |

### 規劃中的資料表

| 批次 | 資料表 | 對應前端型別 |
|---|---|---|
| B：規劃草稿 | `planning_drafts`、`planning_chat_messages` | `PlanningDraft`、`PlanningChatMessage` |
| C：正式任務 | `tasks`、`task_dependencies` | `Task`、`Dependency` |
| D：執行與協作 | `execution_plans`、`task_chat_messages`、`task_prompts`、`task_comments`、`issues`、`issue_responses`、`proposals`、`proposal_comments`、`notifications` | `ExecutionPlan`、`ChatMessage`、`PromptState`、`TaskComment`、`Issue`、`Proposal`、`Notification` |
| E：驗收與回顧 | `acceptance_checks`、`acceptance_records`、`retros`、`retro_entries`、`retro_actions` | `AcceptanceCheck`、`AcceptanceRecord`、`Retro` |

---

## 7. 新增資料表的步驟

以下指令都在 `backend/` 執行。

1. **定義 model**：在 `app/models/` 新增檔案，繼承 `Base`。欄位用 `Mapped[型別]` 宣告，可為空的寫 `Mapped[型別 | None]`；預設值用 `server_default`。
2. **登記**：在 `app/models/__init__.py` 匯入並加進 `__all__`（依字母順序）。沒有登記，Alembic 偵測不到。確認方式：

   ```bash
   uv run python -c "from app.models import Base; print(Base.metadata.tables.keys())"
   ```

3. **產生遷移檔**：

   ```bash
   uv run alembic revision --autogenerate -m "create 表名"
   ```

   輸出要有 `Detected added table`。打開遷移檔，確認 `upgrade()` 不是 `pass`。
4. **補上 RLS**：在 `upgrade()` 的 `# ### end Alembic commands ###` 下面加上：

   ```python
   op.execute("ALTER TABLE 表名 ENABLE ROW LEVEL SECURITY")
   ```

5. **整理格式**（Alembic 產生的檔案不符合 CI 規定）：

   ```bash
   uv run ruff check --fix .
   uv run ruff format .
   uv run ruff check .
   ```

6. **套用並驗收**：

   ```bash
   uv run alembic upgrade head
   docker compose exec db psql -U taskline -c "\d 表名"   # 在 repo 根目錄執行
   ```

   確認欄位、索引、約束，以及最後一行 `Policies (row security enabled)`。
7. **測試還原**：`uv run alembic downgrade -1` 後再 `uv run alembic upgrade head`。
8. **發 PR 前**：`uv run pytest` 通過，並更新這份文件。

---

## 8. 本機開發與常用指令

開發資料表時使用本機的 Docker 資料庫，避免影響共用的 Supabase：

```bash
docker compose up -d          # 在 repo 根目錄啟動本機資料庫
```

`backend/.env` 的 `DATABASE_URL` 設為：

```
DATABASE_URL=postgresql+psycopg://taskline:taskline@localhost:5432/taskline
```

遷移檔合併進 `main` 後，成員執行 `./setup.sh` 時會自動套用到 Supabase。**不要在遷移檔合併前把它套用到 Supabase**：其他成員的 `main` 沒有這份遷移檔，Alembic 會找不到版本而失敗。

| 指令 | 用途 |
|---|---|
| `uv run alembic upgrade head` | 套用所有尚未套用的遷移 |
| `uv run alembic downgrade -1` | 還原最後一份遷移 |
| `uv run alembic downgrade base` | 還原全部 |
| `uv run alembic current` | 目前資料庫套用到哪一份 |
| `uv run alembic history` | 列出所有遷移的順序 |
| `uv run alembic heads` | 列出最新的遷移；正常只有一行，出現兩行代表遷移分岔，要先處理 |
| `docker compose exec db psql -U taskline -c "\d 表名"` | 查看資料表結構 |
| `docker compose down -v` | 清空本機資料庫 |