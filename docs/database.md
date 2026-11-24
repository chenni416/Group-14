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
| `tasks` | 任務，包含 AI 拆解的草稿（`AI_DRAFT`、`DRAFT`）與正式任務 | `Task` |
| `task_dependencies` | 前置任務（任務 A 要等任務 B 完成） | `Task.dependsOn`、`Dependency` |
| `execution_plans` | 成員的執行計畫：步驟、檢查點、前置條件 | `ExecutionPlan` |
| `prompt_threads` | 任務的 Living Prompt 版本紀錄 | `PromptState` |
| `task_chat_messages` | Prompt Studio 裡與專案脈絡助理的對話 | `ChatMessage` |
| `task_comments` | 任務留言區 | `TaskComment` |
| `issues`、`issue_responses` | 問題回報（Blocker）與回應 | `Issue` |
| `proposals`、`proposal_comments` | Idea 與改善提案、討論 | `Proposal` |
| `notifications` | 通知 | `Notification` |
| `acceptance_records` | Reviewer 的驗收決定 | `AcceptanceRecord` |
| `retros`、`retro_entries`、`retro_actions` | Sprint 回顧、成員填寫的內容、改善行動 | `Retro` |
| `github_installations` | GitHub App 安裝紀錄 | — |
| `github_pull_requests` | PR 狀態快照 | `PullRequest` |
| `github_commits` | 預設 branch 最近 commit 的快取 | — |
| `github_webhook_events` | GitHub webhook 的原始事件 | — |

共 26 張。另外 `alembic_version` 是 Alembic 記錄遷移進度的表。

前端看到的 `Member` 由 `members` 與 `project_members` 組成：帳號資料（GitHub 名稱、頭像）不分專案，角色、職稱、容量每個專案不同。

---

## 2. 關係圖

```
members ─┬─< project_members >── projects ──○ github_installations
         ├─< project_invitations >─┘  │
         ├─< notifications（收件人）    │
         └─（作者、負責人等紀錄欄位）    │
                                      ├─< sprints ─┬─< tasks ─┬─< task_dependencies（任務之間）
                                      │            │          ├── execution_plans（一對一）
                                      │            │          ├── prompt_threads（一對一）
                                      │            │          ├─< task_chat_messages
                                      │            │          ├─< task_comments
                                      │            │          ├─< issues ─< issue_responses
                                      │            │          ├─< acceptance_records
                                      │            │          ├─○ backlog_items
                                      │            │          └─○ github_pull_requests
                                      │            ├─< proposals ─< proposal_comments
                                      │            ├── retros（一對一）─┬─< retro_entries
                                      │            │                   └─< retro_actions
                                      │            ├─< documents（會議文件）
                                      │            └─○ backlog_items
                                      ├─< documents（知識庫，sprint_id 為空）
                                      ├─< github_pull_requests
                                      └─< github_commits
github_webhook_events（獨立紀錄，以 installation_id、repo_id 對應）

─<  一對多      ──  一對一（主鍵就是外鍵）      ○  可為空的關聯
```

`tasks` 與 `github_pull_requests` 互相參照：PR 屬於哪個任務（`github_pull_requests.task_id`），以及哪個 PR 讓任務自動完成（`tasks.completed_by_pull_request_id`）。

一對多的關係，外鍵放在「多」的那一邊。例如一個 Sprint 有多份文件，所以外鍵是 `documents.sprint_id`。

---

## 3. 共通規則

1. **只用 Alembic 建立與修改資料表**。在 `backend/app/models/` 定義，用 `alembic revision --autogenerate` 產生遷移檔；不要在 Supabase 後台手動建表或改欄位。
2. **每張表都啟用 RLS 且不建立 policy**。遷移檔要手動加上 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`（Alembic 不會自動產生）。後端以資料表擁有者連線，不受影響；前端的 publishable key 則完全讀不到這些表，所有存取都必須經過後端的權限檢查。`alembic_version` 不在任何 model 裡，由遷移檔 `enable rls on alembic_version` 另外啟用。
3. **主鍵**預設為 `uuid`，由資料庫以 `gen_random_uuid()` 產生。例外：GitHub 提供的 id（`github_installations.installation_id`）與 webhook 的 `delivery_id`；`project_members` 使用 `(project_id, member_id)` 複合主鍵。
4. **列舉值用 `text` + `CHECK` 約束**，不用 PostgreSQL enum：之後新增值只需要改約束。可為空的欄位，空值不受 CHECK 限制（例如 `backlog_items.decision` 為空表示尚未決定）。
5. **時間一律 `timestamptz`**（存 UTC）；只需要日期的欄位用 `date`（例如 Sprint 起訖日）。`updated_at` 由後端在更新時寫入。
6. **GitHub 的 id 一律 `bigint`**，而且是比對依據；帳號名稱、repo 名稱都可能被改名，只作為顯示用。
7. **外鍵的刪除行為**：
   - 從屬資料隨上層刪除（`CASCADE`）：專案刪除時，成員關係、邀請、Sprint、任務、文件、PR、commit 一起刪除；Sprint 刪除時，任務與會議文件一起刪除；任務刪除時，相依關係一起刪除
   - 紀錄類欄位設為空（`SET NULL`）：例如負責人、上傳者、留言與回報的作者、連結 repo 的人、延續事項的來源 Sprint、PR 對應的任務；內容保留，只是作者變成空的
   - 成員刪除時，寄給他的通知一起刪除（`notifications.recipient_member_id` 為 `CASCADE`）
   - 必填的建立者欄位不設刪除行為：有關聯資料時不能刪除該成員（`projects.created_by_member_id`、`project_invitations.invited_by_member_id`）
8. **拆成獨立的表或用 JSONB**：需要單獨查詢的資料拆成獨立的表（例如通知、留言、任務相依）；總是跟主體一起讀寫的清單或物件用 JSONB 或陣列（例如 `projects.default_policy`、`sprints.capacity`、`tasks.negotiation`）。
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
| AI 拆解的草稿存在哪？ | **直接存成 `tasks`**，以 `state` 區分：`AI_DRAFT`（AI 產生）、`DRAFT`（Leader 調整過），核准送出後進入正式流程；Story 的編號與標題存在 `tasks.epic`，使用者故事存在 `tasks.story` | 與 AI 流程（`app/repo/memory.py` 的 `MemoryStore`）一致；草稿與正式任務共用同一套欄位與約束，不需要另外的草稿表 |
| 前端的 Task id | 前端的 `Task.id`（例如 `S-321`）對應 `tasks.code`，專案內唯一；資料表主鍵另用 uuid | 任務編號規則見 `docs/github.md` |
| 「未指派」怎麼表示？ | `tasks.assignee_member_id` 為空值；回傳前端時轉成空字串 | 外鍵只能是存在的成員或空值 |
| 任務點數的限制 | 資料庫只檢查 `story_points > 0`；只能選 1、2、3、5、8 的規則由前端與後端處理 | 點數規則可能調整，放在程式裡改起來不需要遷移 |
| 前置任務 | 拆成獨立的 `task_dependencies` | 需要雙向查詢：「A 依賴誰」與「誰依賴 A」 |
| 每個任務只有一份的資料 | `execution_plans`、`prompt_threads` 以 `task_id` 為主鍵（同時是外鍵）；`retros` 以 `sprint_id` 為主鍵 | 資料庫自動保證一個任務只有一份計畫、一個 Sprint 只有一份回顧 |
| Living Prompt 存什麼？ | 只存每個版本的釐清結論（`prompt_threads.clarifications`），完整 Prompt 由「任務規格 + 釐清結論」即時組出 | 與 AI 流程一致；任務規格修改後，所有版本的 Prompt 都會更新 |
| AI 驗收檢查要存嗎？ | 不存，每次即時產生；Reviewer 的最終判斷（含 AI 當時的判斷）存在 `acceptance_records.items` | 與 AI 流程一致，避免保存過時的 AI 結果 |
| 通知的 `ref_id` | 不建外鍵 | 依通知類型指向不同的表（問題回報或提案），外鍵只能指向一張表 |
| 兩張表互相參照時 | 在其中一邊的外鍵加上 `use_alter=True`（`github_pull_requests.task_id`） | 避免 SQLAlchemy 無法決定建表順序的警告 |
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
| `git_integration` | boolean | ✓ | `false` | 是否整合 Git：`true` 時才進行 repo 連結與同步（`github_*` 欄位） |
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
| `task_id` | uuid | | | 相關任務 → `tasks.id`（SET NULL） |
| `used_in_sprint_id` | uuid | | | 已帶入哪個 Sprint 的會議紀錄 → `sprints.id`（SET NULL） |
| `decision` | text | | | `include`、`keep`、`remove`；空值表示尚未決定 |
| `created_at`、`updated_at` | timestamptz | ✓ | `now()` | |

### `tasks`

欄位較多，依用途分組。

**身分**

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `project_id` | uuid | ✓ | | → `projects.id`（CASCADE） |
| `sprint_id` | uuid | ✓ | | → `sprints.id`（CASCADE） |
| `code` | text | ✓ | | 任務編號，例如 `S-321`；專案內唯一，對應前端的 `Task.id` |

**內容**

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `title` | text | ✓ | | |
| `description` | text | ✓ | `''` | AI 技術分析或任務說明 |
| `domain` | text | ✓ | | `FE`、`BE`、`AI`、`QA`、`DS` |
| `tags` | text[] | ✓ | `{}` | |
| `story_points` | integer | ✓ | | `> 0`；目前前端與後端限制為 1、2、3、5、8 |
| `story_points_reason` | text | ✓ | `''` | |
| `acceptance_criteria` | text[] | ✓ | `{}` | 驗收條件 |
| `epic` | text | ✓ | `''` | 所屬 Story 的編號與標題 |
| `story` | text | ✓ | `''` | 使用者故事描述 |
| `source` | text | ✓ | `''` | 來源句：任務來自會議紀錄的哪一句 |
| `scope`、`out_of_scope`、`responsibility` | text | ✓ | `''` | 任務範圍與責任 |
| `deliverables` | text[] | ✓ | `{}` | 預期交付成果 |
| `branch` | text | ✓ | `''` | 例如 `feat/S321-planning-split` |

**規劃**

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `origin` | text | ✓ | `'human'` | `ai`（AI 拆解）、`human`（手動建立） |
| `edited` | boolean | ✓ | `false` | Leader 是否調整過 AI 建議；重新拆解時保留調整過的任務 |
| `clarified` | boolean | ✓ | `false` | 驗收條件已套用待釐清問題的回答 |
| `state` | text | ✓ | `'AI_DRAFT'` | 見下方「任務狀態」 |
| `prev_state` | text | | | 延後前的狀態，用來恢復 |

**指派**

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `assignee_member_id` | uuid | | | 負責人 → `members.id`（SET NULL）；空值表示尚未指派 |
| `suggested_assignee_member_id` | uuid | | | AI 建議的負責人 → `members.id`（SET NULL） |
| `suggest_reason` | text | ✓ | `''` | |
| `negotiation` | jsonb | | | 成員協商退回的內容 `{byId, reason, suggestId, target}` |
| `return_snapshot` | jsonb | | | 協商退回當下的內容，用來比對 Leader 修改了什麼 |

**審查**

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `policy` | jsonb | ✓ | `{"mode": "pool", "targets": [], "rule": "any"}` | Review 策略 |
| `policy_reason` | text | ✓ | `''` | |
| `reviewer_member_id` | uuid | | | 認領審查的人 → `members.id`（SET NULL） |
| `approvals` | uuid[] | ✓ | `{}` | 已同意的審查者 |
| `claimed_at`、`review_started_at` | timestamptz | | | |
| `delivery` | jsonb | | | 成員送審時提交的交付內容 |

**延續到下一輪**

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `carry_tag` | text | | | 由延續事項帶入：`deferred`、`multi` |
| `multi_sprint` | boolean | ✓ | `false` | 需要延續一個 Sprint 以上 |
| `carry` | boolean | | | 上輪未完成任務的決定：`true` 帶入、`false` 延後、空值尚未決定 |
| `carry_assignee_member_id` | uuid | | | 帶入時改派的負責人；空值表示維持原負責人 |
| `carry_points` | integer | | | Leader 重新評估的剩餘點數（`>= 0`）；空值表示沿用原點數 |
| `carry_status` | text | | | 成員的確認：`pending`、`accepted`、`returned` |
| `plan_confirms` | jsonb | ✓ | `[]` | 成員對延後或調整的回覆 |

AI 指派時會計算「上一輪帶入的工作量」：上一輪 `carry = true` 且尚未完成的任務，負責人為 `carry_assignee_member_id`（沒有則用原負責人），點數為 `carry_points`（沒有則用原點數）。

**完成**（`docs/github.md` 3.9）

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `completed_at` | timestamptz | | | |
| `completion_source` | text | | | `review`（系統內審查通過）、`github_merge`（PR 合併自動完成） |
| `completed_by_pull_request_id` | uuid | | | 觸發自動完成的 PR → `github_pull_requests.id`（SET NULL） |
| `created_at`、`updated_at` | timestamptz | ✓ | `now()` | |

前端的 `Task.pr` 由這個任務最新的一筆 `github_pull_requests` 組成，不另外存。

**任務狀態**

| 狀態 | 意思 |
|---|---|
| `AI_DRAFT` | AI 拆解產生的草稿 |
| `DRAFT` | Leader 調整過的草稿 |
| `PENDING_MEMBER` | 已派工，等成員確認接收 |
| `RETURNED` | 成員協商退回，等 Leader 處理 |
| `ASSIGNED` | 成員已接收 |
| `TODO`、`IN_PROGRESS`、`IN_REVIEW`、`DONE` | 看板上的狀態 |
| `DEFERRED` | 延後到之後的 Sprint |

狀態清單定義在 `app/models/task.py` 的 `TASK_STATES`，`state` 與 `prev_state` 的 CHECK 約束都由它產生。

### `task_dependencies`

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `task_id` | uuid | ✓ | | 複合主鍵；這個任務 → `tasks.id`（CASCADE） |
| `depends_on_task_id` | uuid | ✓ | | 複合主鍵；要先完成的任務 → `tasks.id`（CASCADE） |
| `reason` | text | ✓ | `''` | 為什麼需要先完成 |

CHECK：任務不能依賴自己。可以依賴上一個 Sprint 的任務。

### `execution_plans`

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `task_id` | uuid | ✓ | | 主鍵；→ `tasks.id`（CASCADE） |
| `checklist` | jsonb | ✓ | `[]` | 執行步驟 `[{id, text, done, acIndex, dueAt}]` |
| `checkpoints` | jsonb | ✓ | `[]` | 階段檢查點 `[{id, title, dueAt, reachedAt}]` |
| `dep_checks` | jsonb | ✓ | `[]` | 前置條件 `[{id, text, met, source}]` |
| `origin` | text | ✓ | `'ai'` | `ai`、`human` |
| `edited` | boolean | ✓ | `false` | 成員是否調整過 AI 建議 |
| `confirmed_at` | timestamptz | | | 成員確認計畫的時間；空值表示尚未確認 |
| `created_at`、`updated_at` | timestamptz | ✓ | `now()` | |

### `prompt_threads`

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `task_id` | uuid | ✓ | | 主鍵；→ `tasks.id`（CASCADE） |
| `clarifications` | jsonb | ✓ | `[[]]` | 每個版本累積的釐清結論；第 0 版為空（只有任務規格） |
| `cursor` | integer | ✓ | `0` | 目前選取的版本（從 0 開始，`>= 0`） |
| `updated_at` | timestamptz | ✓ | `now()` | |

### `task_chat_messages`

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `task_id` | uuid | ✓ | | → `tasks.id`（CASCADE） |
| `role` | text | ✓ | | `user`、`assistant` |
| `text` | text | ✓ | | |
| `sources` | text[] | | | AI 回答引用的文件 |
| `prompt_addition` | text | | | 這次回答加進 Prompt 的釐清結論 |
| `prompt_version` | integer | | | 加入後的 Prompt 版本 |
| `created_at` | timestamptz | ✓ | `now()` | |

索引：`(task_id, created_at)`。

### `task_comments`

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `task_id` | uuid | ✓ | | → `tasks.id`（CASCADE） |
| `author_member_id` | uuid | | | → `members.id`（SET NULL） |
| `text` | text | ✓ | | |
| `mentions` | uuid[] | ✓ | `{}` | 被 @ 標注的成員 |
| `created_at` | timestamptz | ✓ | `now()` | |

### `issues`

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `task_id` | uuid | ✓ | | → `tasks.id`（CASCADE）；所屬 Sprint 由任務查出 |
| `type` | text | ✓ | | `tech`、`dependency`、`schedule`、`other` |
| `description` | text | ✓ | | |
| `reporter_member_id` | uuid | | | 回報者 → `members.id`（SET NULL） |
| `owner_member_id` | uuid | | | 處理人 → `members.id`（SET NULL） |
| `suggested_owner_member_id` | uuid | | | 系統推薦的處理人 → `members.id`（SET NULL） |
| `owner_reason` | text | ✓ | `''` | 推薦理由 |
| `status` | text | ✓ | `'reported'` | `reported`、`assigned`、`responded`、`resolved`、`replan` |
| `created_at`、`updated_at` | timestamptz | ✓ | `now()` | |

### `issue_responses`

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `issue_id` | uuid | ✓ | | → `issues.id`（CASCADE） |
| `author_member_id` | uuid | | | → `members.id`（SET NULL） |
| `text` | text | ✓ | | |
| `created_at` | timestamptz | ✓ | `now()` | |

### `proposals`

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `sprint_id` | uuid | ✓ | | → `sprints.id`（CASCADE） |
| `task_id` | uuid | | | 相關的任務 → `tasks.id`（SET NULL）；可以沒有 |
| `title` | text | ✓ | | |
| `description` | text | ✓ | `''` | |
| `kind` | text | ✓ | | `idea`、`improve`、`change` |
| `author_member_id` | uuid | | | → `members.id`（SET NULL） |
| `status` | text | ✓ | `'open'` | `open`、`adopted`、`rejected`、`nextSprint` |
| `decision` | text | ✓ | `''` | Leader 的決定理由 |
| `decided_by_member_id` | uuid | | | → `members.id`（SET NULL） |
| `created_at` | timestamptz | ✓ | `now()` | |

### `proposal_comments`

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `proposal_id` | uuid | ✓ | | → `proposals.id`（CASCADE） |
| `author_member_id` | uuid | | | → `members.id`（SET NULL） |
| `text` | text | ✓ | | |
| `created_at` | timestamptz | ✓ | `now()` | |

### `notifications`

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `recipient_member_id` | uuid | ✓ | | 收件人 → `members.id`（CASCADE） |
| `sender_member_id` | uuid | | | 觸發通知的人 → `members.id`（SET NULL） |
| `type` | text | ✓ | | `invite`、`review`、`pool`、`returned`、`info`、`issue`、`proposal`、`plan`、`mention` |
| `task_id` | uuid | | | → `tasks.id`（CASCADE）；提案可以沒有（前端以空字串表示） |
| `ref_id` | uuid | | | 相關的問題回報或提案（不建外鍵） |
| `text` | text | ✓ | | |
| `status` | text | ✓ | `'pending'` | `pending`、`done` |
| `created_at` | timestamptz | ✓ | `now()` | |

索引：`(recipient_member_id, status, created_at)`，用來列出某人的待處理通知。

### `acceptance_records`

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `task_id` | uuid | ✓ | | → `tasks.id`（CASCADE） |
| `items` | jsonb | ✓ | `[]` | 逐條驗收條件的判斷 `[{ac, ai, evidence, reviewer, note}]` |
| `decision` | text | ✓ | | `approved`（通過）、`changes`（退回修改） |
| `reason` | text | ✓ | `''` | |
| `reviewer_member_id` | uuid | | | → `members.id`（SET NULL） |
| `created_at` | timestamptz | ✓ | `now()` | |

成員送審的交付內容存在 `tasks.delivery`。

### `retros`

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `sprint_id` | uuid | ✓ | | 主鍵；→ `sprints.id`（CASCADE） |
| `status` | text | ✓ | `'open'` | `open`、`closed` |
| `created_at` | timestamptz | ✓ | `now()` | |
| `closed_at` | timestamptz | | | |

### `retro_entries`

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `sprint_id` | uuid | ✓ | | → `retros.sprint_id`（CASCADE）：要先開啟回顧才能填寫 |
| `author_member_id` | uuid | | | → `members.id`（SET NULL） |
| `well`、`hard`、`improve` | text | ✓ | `''` | 做得好的地方、遇到的困難、下次改進 |
| `created_at`、`updated_at` | timestamptz | ✓ | `now()` | |

唯一：`(sprint_id, author_member_id)`，每人每個 Sprint 一份。

### `retro_actions`

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `from_sprint_id` | uuid | ✓ | | 在哪個 Sprint 的回顧訂出 → `retros.sprint_id`（CASCADE） |
| `text` | text | ✓ | | |
| `owner_member_id` | uuid | | | 負責人 → `members.id`（SET NULL） |
| `done` | boolean | ✓ | `false` | |
| `used_in_sprint_id` | uuid | | | 已帶入哪個 Sprint 追蹤 → `sprints.id`（SET NULL） |
| `created_at` | timestamptz | ✓ | `now()` | |

### GitHub 相關資料表

`github_installations`、`github_pull_requests`、`github_commits`、`github_webhook_events` 的欄位與用途，依 [docs/github.md](github.md) 第 3 節的規格建立，這裡不重複列出。`github_pull_requests.task_id` 指向 `tasks.id`（SET NULL），由後端依 `task_code` 對應。

---

## 6. 尚未完成的部分

依前端型別與後端 API（`app/schemas/`）規劃的資料表都已建立。尚未處理的部分：

| 項目 | 說明 |
|---|---|
| 讀寫資料表的程式 | 目前沒有程式使用這些資料表：登入、成員、專案、GitHub 的部分由 GitHub 整合實作；AI 規劃與執行流程需要把 `app/repo/memory.py` 的 `MemoryStore` 改為查詢資料表 |
| Story 審核階段的草稿 | 目前只存在前端，重新整理會消失；如果需要保存，再新增資料表 |
| Supabase Storage | 文件的 bucket（`documents`）尚未建立，實作上傳時設定 |

原本規劃但不建立的資料表：`planning_drafts`、`planning_chat_messages`（草稿直接存成 `tasks`，Story 助理的對話不保存）、`acceptance_checks`（AI 驗收檢查即時產生）。

---

## 7. 新增資料表的步驟

以下指令都在 `backend/` 執行。

1. **定義 model**：在 `app/models/` 新增檔案，繼承 `Base`。欄位用 `Mapped[型別]` 宣告，可為空的寫 `Mapped[型別 | None]`；預設值用 `server_default`。如果有欄位叫 `text`，SQLAlchemy 的 `text()` 函式要改名匯入（`from sqlalchemy import text as sql_text`），否則會被欄位名稱蓋掉。
2. **登記**：在 `app/models/__init__.py` 匯入並加進 `__all__`。`ruff check --fix` 會排好 import 的順序，但**不會排 `__all__`**，要自己依字母順序加入。沒有登記，Alembic 偵測不到。確認方式：

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

   CHECK 約束裡很長的文字（例如狀態清單）無法自動換行，在那一行最後加上 `  # noqa: E501`。
6. **套用並驗收**：

   ```bash
   uv run alembic upgrade head
   docker compose exec db psql -U taskline -c "\d 表名"   # 在 repo 根目錄執行
   ```

   確認欄位、索引、約束，以及最後一行 `Policies (row security enabled)`。
7. **測試還原**：`uv run alembic downgrade -1` 後再 `uv run alembic upgrade head`。
8. **發 PR 前**：`uv run pytest` 通過，並更新這份文件。

### 在既有資料表新增欄位

除了 model 與遷移檔，前後端要一起改才會出現在畫面上。以 `projects.git_integration` 為例：

| 順序 | 位置 | 要做的事 |
|---|---|---|
| 1 | `app/models/` ＋ 遷移檔 | model 加上欄位，`alembic revision --autogenerate` 會偵測到 `Detected added column`。既有的表已經啟用 RLS，不用再補 |
| 2 | `app/schemas/` | 回傳給前端的格式（例如 `Project`）加上欄位；可以修改的話，修改用的格式（例如 `UpdateProjectInput`）也加上，型別寫成 `型別 \| None = None`，代表沒傳就不修改 |
| 3 | `app/services/` | 轉成前端格式的函式（`to_schema`）帶上這個欄位；修改的函式加上 `if patch.欄位 is not None:` |
| 4 | `frontend/src/types/` | 前端型別加上同一個欄位（底線改成駝峰，例如 `gitIntegration`） |
| 5 | `frontend/src/mocks/data/` | 示範模式的假資料補上這個欄位，否則型別檢查會報錯 |
| 6 | 畫面元件 | 顯示或修改這個欄位 |
| 7 | `tests/db/` | 補上讀寫這個欄位的測試 |

欄位要有預設值（`server_default`），已經存在的資料才會自動得到這個值；必填欄位沒有預設值時，遷移會在已有資料的表上失敗。

---

## 8. 本機開發與常用指令

開發資料表時使用本機的 Docker 資料庫，避免影響共用的 Supabase：

```bash
docker compose up -d          # 在 repo 根目錄啟動本機資料庫
```

`backend/.env` 的 `DATABASE_URL` 設為：

```
DATABASE_URL=postgresql+psycopg://taskline:taskline@localhost:5433/taskline
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