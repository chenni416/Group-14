# GitHub 整合：資料表需求規格

給負責資料表的成員：這份文件列出 **GitHub 登入、專案建立與成員邀請、repo 綁定、讀取專案進度** 需要的所有資料表與欄位。
GitHub 整合的程式會等這些資料表完成後再實作，所以請盡量一次建齊，避免之後補欄位。

- 欄位名稱已依後端慣例使用 snake_case；API 會自動轉成前端使用的 camelCase
- 和其他功能共用的資料表（`members`、`projects`、`tasks`）只列出 GitHub 整合需要的欄位，其他欄位由負責人依 `frontend/src/types` 補上
- 有疑問或想調整的地方，直接在這份文件留言或在 PR 討論

## 實作進度

| 階段 | 內容 | 狀態 |
|---|---|---|
| 1 | 登入建立成員、同步 GitHub 資料、修改顯示名稱 | 完成 |
| 2 | 建立專案、切換目前的專案 | 完成（#22） |
| 2-1 | 新使用者歡迎頁、沒有專案時的空白狀態、建立專案與加入專案頁、刪除專案、移除成員 | 完成（`feat/new-user-welcome`） |
| 2-2 | 成員邀請（邀請碼＋Leader 同意、指定 GitHub 帳號） | 完成，設計見[第 7 節](#7-成員邀請的設計) |
| 3 | 安裝 GitHub App、連結 repo（建立專案時填寫 repo、專案設定重新連結） | 完成（`feat/github-repo-connect`），流程見[第 8 節](#8-連結-repo-的流程) |
| 4 | 同步 PR／審查／CI／commit、PR 合併自動完成任務、進度顯示 | 尚未開始 |
| 5 | 以實際 repo 端對端測試 | 尚未開始 |

## 目錄

1. [功能流程與資料表的關係](#1-功能流程與資料表的關係)
2. [資料表總覽](#2-資料表總覽)
3. [欄位規格](#3-欄位規格)
4. [共通規則](#4-共通規則)
5. [建立順序與驗收方式](#5-建立順序與驗收方式)
6. [已確認的決定](#6-已確認的決定)

---

## 1. 功能流程與資料表的關係

```
① 使用者以 GitHub 登入（Supabase Auth）
     └─ 第一次登入時建立 members

② 使用者建立專案，成為 Leader
     └─ projects、project_members（role = Leader）

③ Leader 用 GitHub 帳號邀請成員；被邀請的人登入後加入專案
     └─ project_invitations → project_members

④ Leader 連結 repo：安裝 GitHub App → 回到系統 → 選擇 repo
     └─ github_installations；projects 寫入 repo 資訊

⑤ 系統讀取 repo 的 PR、審查、CI、commit，依 branch 名稱對應到任務
     └─ github_pull_requests、github_commits（快取）

⑥ PR 合併到預設 branch 時，對應的任務自動改為完成（DONE）
     └─ tasks 寫入完成時間與來源；github_pull_requests 記錄合併資訊

⑦ GitHub 透過 webhook 通知 PR 變動（部署後才會啟用）
     └─ github_webhook_events
```

**branch 命名規則**（前端 `lib/planning.ts` 的 `branchName`）：`{prefix}/S{數字}-{slug}`

| branch | 對應任務 |
|---|---|
| `feat/S221-planning-split` | `S-221` |
| `fix/S3011-login-error` | `S-3011` |
| `docs/readme` | 無（標記為未對應任務） |

`prefix` 為 `feat`、`fix`、`test`、`refactor`、`chore` 其中之一。

**PR 合併後自動完成任務**：

- 條件：PR 合併到專案的預設 branch（`projects.github_default_branch`，通常是 `main`），且 PR 已對應到任務
- 結果：任務狀態改為 `DONE`，記錄完成時間、來源（`github_merge`）與觸發的 PR，並通知 Leader 與負責人
- 合併前的審查在 GitHub 上完成（repo 可設定合併前需要審查通過），所以合併即代表審查通過
- 不會自動完成的情況：合併到其他 branch、PR 關閉但沒有合併、任務已經是 `DONE` 或 `DEFERRED`
- 同一個任務有多個 PR 時，第一個合併的 PR 就會完成任務；之後合併的 PR 只更新 PR 狀態
- 完成後若需要重新開啟，由 Leader 在系統內手動改回，系統不會因為後續的 GitHub 事件改回狀態

---

## 2. 資料表總覽

| 資料表 | 用途 | 優先順序 | 備註 |
|---|---|---|---|
| `members` | 登入的使用者（一個 GitHub 帳號一筆） | 必要 | 與其他功能共用 |
| `projects` | 專案；包含綁定的 repo | 必要 | 與其他功能共用，GitHub 欄位見下方 |
| `project_members` | 成員與專案的關係、角色與專案內設定 | 必要 | 與其他功能共用 |
| `project_invitations` | 用 GitHub 帳號邀請成員 | 必要 | |
| `github_installations` | GitHub App 安裝紀錄 | 必要 | |
| `github_pull_requests` | PR 狀態快照 | 必要 | |
| `github_commits` | 最近 commit 的快取 | 建議 | 第一版也可以每次即時讀取，不建這張 |
| `github_webhook_events` | webhook 原始事件 | 必要（可晚一點建） | 部署後啟用 webhook 時使用 |
| `tasks` | 任務 | 其他成員負責 | 只需要確認有 `code` 欄位，見 3.9 |

關係圖：

```
members ─┬─< project_members >── projects ──○ github_installations
         ├─< project_invitations >─┘  │
         └─ (installed_by)            ├─< github_pull_requests >──○ tasks
                                      └─< github_commits
github_webhook_events（獨立紀錄，以 installation_id、repo_id 對應）

─<  一對多      ○  可為空的關聯
```

---

## 3. 欄位規格

型別使用 PostgreSQL。`timestamptz` 一律存 UTC；「預設」欄位沒有寫的代表沒有預設值。

### 3.1 `members`：登入的使用者

一個 GitHub 帳號對應一筆，第一次登入時由後端建立，之後每次登入更新 GitHub 帳號名稱、頭像、email。
**專案內的角色、職稱、容量不放這裡**，放在 `project_members`（同一個人在不同專案可能是不同角色）。

**名稱規則**：系統內一律以 GitHub 帳號名稱（`github_login`）作為使用者的 ID 與預設顯示名稱。
使用者可以在設定頁修改顯示名稱，存在 `display_name`；畫面顯示 `display_name`，沒有設定時顯示 `github_login`。
每次登入只會更新 `github_login`，不會覆蓋使用者自己改過的 `display_name`。

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `auth_user_id` | uuid | ✓ | | Supabase Auth 的使用者 id（JWT 的 `sub`），**唯一** |
| `github_id` | bigint | ✓ | | GitHub 使用者 id（`user_metadata.provider_id`），**唯一**。帳號改名也不會變，比對以這個為準 |
| `github_login` | text | ✓ | | GitHub 帳號名稱（`user_metadata.user_name`），作為系統內的使用者 ID 與預設顯示名稱；在 GitHub 改名後，下次登入時更新 |
| `display_name` | text | | | 使用者在設定頁自訂的顯示名稱；為空時顯示 `github_login` |
| `email` | text | | | 可能為空 |
| `avatar_url` | text | | | GitHub 頭像網址 |
| `last_login_at` | timestamptz | | | |
| `created_at` | timestamptz | ✓ | `now()` | |
| `updated_at` | timestamptz | ✓ | `now()` | |

索引與約束：
- `UNIQUE (auth_user_id)`、`UNIQUE (github_id)`
- `lower(github_login)` 建索引（邀請時用帳號名稱查詢，不分大小寫）

> 不建議對 Supabase 的 `auth.users` 建外鍵：它在另一個 schema，Alembic 不管理，用唯一欄位對應即可。

### 3.2 `projects`：專案（GitHub 相關欄位）

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `name` | text | ✓ | | 專案名稱 |
| `created_by_member_id` | uuid | ✓ | | FK → `members.id`，建立專案的人 |
| `github_link_status` | text | ✓ | `'none'` | repo 連結狀態，見下表 |
| `github_installation_id` | bigint | | | FK → `github_installations.installation_id`，`ON DELETE SET NULL` |
| `github_repo_id` | bigint | | | GitHub repo id，改名或轉移都不會變，**同步資料以這個為準** |
| `github_repo_full_name` | text | | | `owner/name`，例如 `chenni416/Group-14`；改名時由系統更新 |
| `github_repo_url` | text | | | `https://github.com/owner/name` |
| `github_default_branch` | text | | | 例如 `main` |
| `github_repo_private` | boolean | | | |
| `github_linked_by_member_id` | uuid | | | FK → `members.id`，誰連結的 |
| `github_linked_at` | timestamptz | | | |
| `github_last_synced_at` | timestamptz | | | 最後一次成功同步 PR 的時間 |
| `github_sync_error` | text | | | 最後一次同步失敗的原因，成功時清空 |
| `created_at` | timestamptz | ✓ | `now()` | |
| `updated_at` | timestamptz | ✓ | `now()` | |

`github_link_status` 的值（`CHECK` 約束）：

| 值 | 說明 |
|---|---|
| `none` | 尚未連結 |
| `pending` | 已送出安裝請求，等待 repo 擁有者在 GitHub 核准 |
| `linked` | 已連結，可以讀取進度 |
| `revoked` | App 被移除、權限被收回或 repo 被刪除，需要重新連結 |

索引與約束：
- `UNIQUE (github_repo_id)`（`github_repo_id` 不為空時），**一個 repo 只能綁一個專案**，見[第 6 節](#6-已確認的決定)
- `github_installation_id` 建索引（App 被移除時要找出受影響的專案）

> 其他欄位（`goal`、`prefix`、`sprint_length`、`default_policy`、`active_sprint_id` 等）依 `frontend/src/types/project.ts` 由負責人補上。
> 前端的 `Project.repo` 對應 `github_repo_full_name`；`Project.provider` 目前固定為 `GitHub`。

### 3.3 `project_members`：專案成員

對應前端 `Member` 型別中「每個專案不同」的部分。前端看到的 `Member` 由 `members` + `project_members` 組成。

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `project_id` | uuid | ✓ | | FK → `projects.id`，`ON DELETE CASCADE` |
| `member_id` | uuid | ✓ | | FK → `members.id`，`ON DELETE CASCADE` |
| `role` | text | ✓ | `'Member'` | `Leader` 或 `Member`（`CHECK`） |
| `title` | text | ✓ | `''` | 職稱，例如 Backend Engineer |
| `domain` | text | | | `FE`、`BE`、`AI`、`QA`、`DS`（`CHECK`，可為空） |
| `tags` | text[] | ✓ | `'{}'` | 技能標籤 |
| `capacity` | integer | ✓ | `0` | 每個 Sprint 可承接的 Story Points，`>= 0` |
| `joined_at` | timestamptz | ✓ | `now()` | |

索引與約束：
- 主鍵 `(project_id, member_id)`
- `member_id` 建索引（查詢某人參與的所有專案）

> 每個專案至少要有一位 Leader，由後端在移除成員或變更角色時檢查，不需要用資料庫約束。

### 3.4 `project_invitations`：成員邀請

Leader 用 GitHub 帳號名稱邀請。被邀請的人用 GitHub 登入後，系統比對帳號並讓他接受邀請。

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `project_id` | uuid | ✓ | | FK → `projects.id`，`ON DELETE CASCADE` |
| `github_login` | text | ✓ | | 被邀請的 GitHub 帳號名稱，**存小寫**（比對時不分大小寫） |
| `github_id` | bigint | | | 邀請時若能查到 GitHub id 就一起存，比對更準確 |
| `role` | text | ✓ | `'Member'` | 加入後的角色（`Leader` 或 `Member`） |
| `title` | text | ✓ | `''` | 加入後的職稱，可由 Leader 預先填寫 |
| `domain` | text | | | 加入後的領域 |
| `capacity` | integer | ✓ | `0` | 加入後的容量 |
| `status` | text | ✓ | `'pending'` | `pending`、`accepted`、`declined`、`revoked`（`CHECK`） |
| `invited_by_member_id` | uuid | ✓ | | FK → `members.id` |
| `accepted_by_member_id` | uuid | | | FK → `members.id`，實際接受的人 |
| `created_at` | timestamptz | ✓ | `now()` | |
| `responded_at` | timestamptz | | | 接受、拒絕或撤銷的時間 |

索引與約束：
- `UNIQUE (project_id, github_login)` 限定 `status = 'pending'`（部分唯一索引），同一個帳號不能重複邀請
- `github_login` 建索引（登入時查詢自己有沒有待接受的邀請）

### 3.5 `github_installations`：GitHub App 安裝紀錄

Leader 把 GitHub App 安裝到帳號或組織時建立。一個安裝可以授權多個 repo，也可以被多個專案使用。

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `installation_id` | bigint | ✓ | | 主鍵，GitHub 提供的安裝 id |
| `account_id` | bigint | ✓ | | 安裝到的 GitHub 帳號或組織 id |
| `account_login` | text | ✓ | | 帳號或組織名稱，例如 `chenni416` |
| `account_type` | text | ✓ | | `User` 或 `Organization`（`CHECK`） |
| `account_avatar_url` | text | | | |
| `repository_selection` | text | ✓ | | `all`（全部 repo）或 `selected`（指定 repo）（`CHECK`） |
| `status` | text | ✓ | `'active'` | `active`、`suspended`、`deleted`（`CHECK`） |
| `installed_by_member_id` | uuid | | | FK → `members.id`，`ON DELETE SET NULL`；透過核准請求安裝時可能不是系統內的成員 |
| `suspended_at` | timestamptz | | | |
| `deleted_at` | timestamptz | | | App 被移除時記錄，不刪除資料列 |
| `created_at` | timestamptz | ✓ | `now()` | |
| `updated_at` | timestamptz | ✓ | `now()` | |

索引：`account_id`。

> 不需要存 installation token：token 一小時就會過期，由後端用 private key 隨時換新的，只放在記憶體。
> 已授權的 repo 清單也不存：需要時即時向 GitHub 查詢。

### 3.6 `github_pull_requests`：PR 狀態快照

同步時寫入或更新（以 `github_id` 為準 upsert），畫面顯示進度時讀這張表，不用每次呼叫 GitHub。
對應前端 `Task.pr`（`frontend/src/types/task.ts` 的 `PullRequest`）。

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `project_id` | uuid | ✓ | | FK → `projects.id`，`ON DELETE CASCADE` |
| `github_id` | bigint | ✓ | | GitHub 的 PR id，**唯一** |
| `repo_id` | bigint | ✓ | | 所屬 repo 的 GitHub id |
| `number` | integer | ✓ | | PR 編號，例如 `#33` |
| `title` | text | ✓ | | |
| `url` | text | ✓ | | PR 網址 |
| `author_login` | text | ✓ | | 開 PR 的人 |
| `author_github_id` | bigint | | | 開 PR 的人的 GitHub id，用來對應 `members.github_id` |
| `head_branch` | text | ✓ | | 來源 branch，例如 `feat/S221-planning-split` |
| `base_branch` | text | ✓ | | 目標 branch，例如 `main` |
| `head_sha` | text | ✓ | | 最新 commit，用來查 CI 結果 |
| `state` | text | ✓ | | `open`、`closed`、`merged`（`CHECK`） |
| `draft` | boolean | ✓ | `false` | 是否為草稿 PR |
| `review_state` | text | ✓ | `'none'` | `none`、`approved`、`changes_requested`、`commented`（`CHECK`），取每位審查者最新的結果彙整 |
| `requested_reviewers` | text[] | ✓ | `'{}'` | 被要求審查的 GitHub 帳號 |
| `checks_state` | text | ✓ | `'none'` | CI 結果：`none`、`pending`、`passed`、`failed`（`CHECK`），對應前端 `PullRequest.tests` |
| `changed_files` | integer | ✓ | `0` | |
| `additions` | integer | ✓ | `0` | |
| `deletions` | integer | ✓ | `0` | |
| `task_code` | text | | | 從 `head_branch` 解析出的任務編號，例如 `S-221`；解析不到時為空 |
| `task_id` | uuid | | | FK → `tasks.id`，`ON DELETE SET NULL`；任務表完成後由後端依 `task_code` 對應 |
| `opened_at` | timestamptz | ✓ | | PR 建立時間 |
| `merged_at` | timestamptz | | | |
| `merged_by_login` | text | | | 按下合併的 GitHub 帳號 |
| `merged_by_github_id` | bigint | | | 對應 `members.github_id` |
| `merge_commit_sha` | text | | | 合併產生的 commit |
| `completed_task` | boolean | ✓ | `false` | 這個 PR 的合併是否觸發了任務自動完成；避免同一事件重複處理 |
| `closed_at` | timestamptz | | | |
| `github_updated_at` | timestamptz | ✓ | | GitHub 上的最後更新時間，用來判斷要不要更新 |
| `synced_at` | timestamptz | ✓ | `now()` | 最後一次寫入這筆資料的時間 |

索引與約束：
- `UNIQUE (github_id)`、`UNIQUE (repo_id, number)`
- `(project_id, state)`：畫面依狀態分類
- `(project_id, task_code)`：依任務查詢 PR
- `task_id`

### 3.7 `github_commits`：最近 commit 的快取（建議）

顯示專案最近動態用，只需要保留預設 branch 最近一段時間（例如 90 天或最近 500 筆）。第一版也可以不建這張，改為每次即時讀取。

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `project_id` | uuid | ✓ | | FK → `projects.id`，`ON DELETE CASCADE` |
| `repo_id` | bigint | ✓ | | |
| `sha` | text | ✓ | | commit SHA |
| `branch` | text | ✓ | | 讀取時所在的 branch（預設 branch） |
| `message` | text | ✓ | | commit 訊息第一行 |
| `author_login` | text | | | GitHub 帳號；作者沒有綁定 GitHub 時為空 |
| `author_name` | text | ✓ | | git 設定的作者名稱 |
| `author_github_id` | bigint | | | 對應 `members.github_id` |
| `url` | text | ✓ | | |
| `pull_request_number` | integer | | | 由 PR 合併產生時記錄 |
| `task_code` | text | | | 從 commit 訊息或所屬 PR 解析的任務編號 |
| `committed_at` | timestamptz | ✓ | | |
| `synced_at` | timestamptz | ✓ | `now()` | |

索引與約束：
- `UNIQUE (repo_id, sha)`
- `(project_id, committed_at DESC)`

### 3.8 `github_webhook_events`：webhook 原始事件

GitHub 每次通知都先寫入這張表再處理：可以用 `delivery_id` 避免重複處理，也方便除錯與重新處理。部署後啟用 webhook 時才會使用，可以晚一點建。

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `delivery_id` | text | ✓ | | 主鍵，`X-GitHub-Delivery` 標頭 |
| `event` | text | ✓ | | `X-GitHub-Event`，例如 `pull_request` |
| `action` | text | | | payload 的 `action`，例如 `opened`、`closed` |
| `installation_id` | bigint | | | |
| `repo_id` | bigint | | | |
| `payload` | jsonb | ✓ | | 完整內容 |
| `status` | text | ✓ | `'received'` | `received`、`processed`、`ignored`、`failed`（`CHECK`） |
| `error` | text | | | 處理失敗的原因 |
| `received_at` | timestamptz | ✓ | `now()` | |
| `processed_at` | timestamptz | | | |

索引：`received_at`、`(status, received_at)`。保留 30 天，之後由排程刪除。

### 3.9 `tasks`（其他成員負責）

GitHub 整合只需要確認任務表有以下欄位，用來把 PR 對應到任務：

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | uuid | 主鍵，`github_pull_requests.task_id` 會參照 |
| `project_id` | uuid | 所屬專案 |
| `code` | text | 任務編號，例如 `S-221`；**同一個專案內唯一**（`UNIQUE (project_id, code)`） |
| `branch` | text | 規劃時產生的 branch 名稱，例如 `feat/S221-planning-split` |
| `state` | text | 任務狀態（`TODO`、`IN_PROGRESS`、`IN_REVIEW`、`DONE` 等，見 `frontend/src/types/task.ts`）；PR 合併時改為 `DONE` |
| `completed_at` | timestamptz | 完成時間；可為空 |
| `completion_source` | text | 完成的方式：`review`（系統內審查通過）或 `github_merge`（PR 合併自動完成）（`CHECK`，可為空） |
| `completed_by_pull_request_id` | uuid | FK → `github_pull_requests.id`，`ON DELETE SET NULL`；自動完成時是哪個 PR 觸發的 |

前端 `Task.pr` 會由「這個任務最新的一筆 `github_pull_requests`」組成，不需要在任務表另外存 PR 欄位。

> `tasks.completed_by_pull_request_id` 與 `github_pull_requests.task_id` 互相參照，建立時先建兩張表，再用另一個遷移加上其中一邊的外鍵。

---

## 4. 共通規則

1. **只用 Alembic 建立與修改**：在 `backend/app/models/` 定義資料表，用 `uv run alembic revision --autogenerate` 產生遷移檔；不要在 Supabase 後台手動建表或改欄位
2. **每張表都啟用 RLS 且不建立 policy**：遷移檔加上 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`。後端以資料表擁有者連線，不受影響；前端的 publishable key 則完全讀不到這些表
3. **列舉值用 `text` + `CHECK` 約束**，不用 PostgreSQL enum：之後新增值只需要改約束，遷移比較簡單
4. **時間一律 `timestamptz`**，`updated_at` 由後端在更新時寫入
5. **GitHub 的 id 一律存 `bigint`**：GitHub 的 id 會超過 `integer` 範圍
6. **GitHub 的 id 是比對依據**，帳號名稱、repo 名稱都可能被改名，只作為顯示用
7. **外鍵刪除行為**依各表說明：專案刪除時，成員關係、邀請、PR、commit 一起刪除；成員刪除時，紀錄類欄位設為空

---

## 5. 建立順序與驗收方式

**建議的遷移順序**（後面的表會參照前面的表）：

1. `members`
2. `github_installations`
3. `projects`
4. `project_members`、`project_invitations`
5. `github_pull_requests`（`task_id` 外鍵可等 `tasks` 建好後再加）
6. `github_commits`、`github_webhook_events`

**完成後請確認**：

- [ ] `uv run alembic upgrade head` 可以在乾淨的資料庫從頭建立所有表
- [ ] `uv run alembic downgrade base` 可以完整還原
- [ ] 每張表都已啟用 RLS（Supabase 後台 Table Editor 顯示 RLS enabled）
- [ ] 所有唯一約束與索引都已建立（特別是 `members.github_id`、`projects.github_repo_id`、`github_pull_requests.github_id`）
- [ ] `backend/app/models/` 有對應的 SQLAlchemy model，並在 `app/models/__init__.py` 匯入
- [ ] 更新 `docs/api.md` 或在 PR 說明列出新增的資料表

完成後通知負責 GitHub 整合的成員，開始實作登入建立成員、專案建立與邀請、repo 綁定與進度同步。

---

## 6. 已確認的決定

以下決定已確認：

| 問題 | 決定 | 影響的欄位 |
|---|---|---|
| 一個 repo 可以綁到多個專案嗎？ | **不行**，一個 repo 只對應一個專案，避免同一個 PR 出現在多個專案 | `projects.github_repo_id` 的唯一約束 |
| 一個專案可以綁多個 repo 嗎？ | **第一版不行**，之後需要時再拆出 `project_repositories` 表 | `projects` 上的 repo 欄位 |
| 邀請用什麼比對？ | **GitHub 帳號名稱**（存小寫），能查到 GitHub id 時一併比對 | `project_invitations.github_login`、`github_id` |
| PR 合併後要自動把任務改成完成嗎？ | **要**，合併到預設 branch 即自動完成（規則見[第 1 節](#1-功能流程與資料表的關係)） | `tasks.completed_at`、`completion_source`、`completed_by_pull_request_id`；`github_pull_requests` 的合併欄位 |
| 使用者名稱怎麼決定？ | 以 **GitHub 帳號名稱**作為使用者 ID 與預設名稱，可在設定頁修改顯示名稱 | `members.github_login`、`display_name` |
| commit 要存資料庫嗎？ | 第一版可以每次即時讀取；需要顯示歷史或減少 API 呼叫時再啟用 `github_commits` | `github_commits` |

---

## 7. 成員邀請的設計

已確認提供兩種方式，在下一個分支（`feat/project-invitations`）實作。被邀請的人都在「建立或加入專案」頁（`/projects/new?mode=join`）加入。

### 7.1 指定 GitHub 帳號

1. Leader 在團隊頁輸入對方的 GitHub 帳號，系統向 GitHub 確認帳號存在並顯示頭像；可預先設定角色、職稱、領域、容量
2. 建立邀請後產生**邀請連結**，Leader 自行貼到 LINE、Discord 等（不寄信）
3. 對方點連結並以 GitHub 登入後看到確認頁（誰邀請、哪個專案、什麼角色），按接受即加入；也可以拒絕
4. **只有被邀請的 GitHub 帳號能接受**，連結外流也無法使用；對方沒點連結時，直接登入也會在加入頁看到邀請
5. Leader 可以看到邀請狀態並撤銷

使用現有的 `project_invitations` 資料表（3.4），不需要新增欄位。

### 7.2 邀請碼＋Leader 同意

1. Leader 產生專案的邀請碼（例如 `TL-7K2QX9`），可以設定有效期限、重新產生或停用
2. 任何人登入後在加入頁輸入邀請碼，送出加入申請
3. Leader 在團隊頁看到待審核的申請，同意後對方才加入專案；也可以拒絕
4. 邀請碼外流時，未經 Leader 同意也無法加入

**需要新增的資料表**（請負責資料表的成員建立）：

`project_join_codes`：專案邀請碼

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `project_id` | uuid | ✓ | | FK → `projects.id`，`ON DELETE CASCADE` |
| `code` | text | ✓ | | 邀請碼，**唯一**；不分大小寫比對（存大寫） |
| `role` | text | ✓ | `'Member'` | 經同意加入後的角色（`CHECK`：`Leader`、`Member`） |
| `expires_at` | timestamptz | | | 為空表示不會過期 |
| `revoked_at` | timestamptz | | | 停用時間；停用後不能再申請 |
| `created_by_member_id` | uuid | ✓ | | FK → `members.id` |
| `created_at` | timestamptz | ✓ | `now()` | |

索引：`UNIQUE (code)`；`project_id`。同一個專案同時只會有一組有效的邀請碼，由後端在產生新碼時停用舊碼。

`project_join_requests`：用邀請碼送出的加入申請

| 欄位 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `id` | uuid | ✓ | `gen_random_uuid()` | 主鍵 |
| `project_id` | uuid | ✓ | | FK → `projects.id`，`ON DELETE CASCADE` |
| `join_code_id` | uuid | | | FK → `project_join_codes.id`，`ON DELETE SET NULL`；用哪組邀請碼申請的 |
| `member_id` | uuid | ✓ | | FK → `members.id`，`ON DELETE CASCADE`；申請的人 |
| `status` | text | ✓ | `'pending'` | `pending`、`approved`、`rejected`、`cancelled`（`CHECK`） |
| `decided_by_member_id` | uuid | | | FK → `members.id`，`ON DELETE SET NULL`；同意或拒絕的 Leader |
| `created_at` | timestamptz | ✓ | `now()` | |
| `decided_at` | timestamptz | | | |

索引與約束：`UNIQUE (project_id, member_id)` 限定 `status = 'pending'`（部分唯一索引），同一個人對同一個專案只能有一筆待審核的申請；`(project_id, status)`。

兩張表都要啟用 RLS（[第 4 節](#4-共通規則)）。

---

## 8. 連結 repo 的流程

### 8.1 使用者操作

1. **建立專案**：選擇「整合 GitHub」時必須填寫 repo（`https://github.com/owner/repo` 或 `owner/repo`）；選擇「不整合」時可以不填
2. 按「建立專案並連結 GitHub」→ 前往 GitHub 安裝 Taskline App，勾選該 repo
3. 回到 `/github/callback`，結果有三種：
   - **已連結**：回到專案設定第二步（從專案設定發起時回到基本資訊）
   - **等待核准**：不是 repo 擁有者時 GitHub 只送出安裝請求；擁有者核准後，在專案設定的基本資訊按「重新連結」
   - **選擇 repo**：安裝沒有包含填寫的 repo 時，從已授權的 repo 中選擇，或重新安裝並勾選
4. 之後可以在**專案設定 → 基本資訊**查看狀態、重新連結或解除連結

### 8.2 安全檢查（`backend/app/services/github_link.py`）

- 安裝網址帶有簽章的 `state`（專案、發起的 Leader、30 分鐘期限），回呼時驗證，不能偽造或拿去綁別的專案
- 用安裝時取得的使用者授權查詢「登入者可以存取的安裝」，確認 `installation_id` 不是貼上別人的
- 只有 Leader、且專案開啟 Git 整合時才能連結；一個 repo 只能綁一個專案

### 8.3 GitHub App 需要的設定

在 GitHub App 設定頁確認：

| 項目 | 設定 |
|---|---|
| Callback URL | `http://localhost:5173/github/callback`（5174、5175 也加入；部署後加上正式網址） |
| Request user authorization (OAuth) during installation | 勾選 |
| Webhook | 部署前先不啟用 |
| Repository permissions | Contents、Metadata、Pull requests、Checks、Commit statuses 皆為 Read-only |
| Where can this GitHub App be installed | Any account |

後端需要 `backend/.env` 的 `GITHUB_APP_ID`、`GITHUB_APP_SLUG`、`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`GITHUB_PRIVATE_KEY_PATH`（`./setup.sh` 的 GitHub 整合步驟會詢問）。
