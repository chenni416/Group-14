# API 實作狀態

> 這份文件由 `backend/scripts/route_status.py` 自動產生，**不要手動修改**。新增或修改路由後執行 `uv run python scripts/route_status.py` 更新；`tests/test_api_status_doc.py` 與 CI 會檢查它是不是最新。

共 116 個端點：**86 個已實作或部分實作**、30 個尚未實作（呼叫時回 `501 NOT_IMPLEMENTED`）。

| 欄位 | 說明 |
|---|---|
| 資料來源 | 資料庫＝讀寫 Supabase／Postgres 資料表；記憶體＝`MemoryStore`（全域、不分專案、重啟即重置）；「資料庫＋記憶體」＝GitHub 登入的成員走資料庫、`X-Demo-User` 示範成員走記憶體 |
| 驗證 | 無＝不需要登入（任何人可呼叫）；登入＝需要有效的 Supabase token，且 `X-Project-Id` 若有帶，必須是我所屬的專案（否則 400／403）；登入（帳號）＝帳號層級的端點（`/me`、專案清單、邀請、通知），不檢查 `X-Project-Id`；Leader＝另外要求專案角色為 Leader |

GitHub 連結（`github` 群組）的 Leader 檢查在 `services/github_link.py` 內，所以這裡顯示為「登入」。

## acceptance（1／2 已實作）

| 方法 | 路徑 | operationId | 狀態 | 資料來源 | 驗證 |
|---|---|---|---|---|---|
| POST | `/api/tasks/{task_id}/acceptance/check` | `acceptance.check` | 已實作 | 記憶體 | 無 |
| GET | `/api/tasks/{task_id}/acceptance/records` | `acceptance.records` | 501 | — | 無 |

## auth（2／3 已實作）

| 方法 | 路徑 | operationId | 狀態 | 資料來源 | 驗證 |
|---|---|---|---|---|---|
| GET | `/api/me` | `auth.me` | 已實作 | 資料庫 | 登入（帳號） |
| PATCH | `/api/me` | `auth.updateMe` | 已實作 | 資料庫 | 登入（帳號） |
| POST | `/api/auth/switch` | `auth.switchUser` | 501 | — | 無 |

## comments（0／3 已實作）

| 方法 | 路徑 | operationId | 狀態 | 資料來源 | 驗證 |
|---|---|---|---|---|---|
| GET | `/api/tasks/{task_id}/comments` | `comments.list` | 501 | — | 無 |
| POST | `/api/tasks/{task_id}/comments` | `comments.add` | 501 | — | 無 |
| POST | `/api/tasks/{task_id}/comments/read` | `comments.markRead` | 501 | — | 無 |

## docs（5／5 已實作）

| 方法 | 路徑 | operationId | 狀態 | 資料來源 | 驗證 |
|---|---|---|---|---|---|
| GET | `/api/docs` | `docs.list` | 已實作 | 資料庫＋記憶體（依身分） | 登入 |
| POST | `/api/docs` | `docs.upload` | 已實作 | 資料庫＋記憶體（依身分） | Leader |
| POST | `/api/docs/links` | `docs.addLink` | 已實作 | 資料庫＋記憶體（依身分） | Leader |
| DELETE | `/api/docs/{id}` | `docs.remove` | 已實作 | 資料庫＋記憶體（依身分） | Leader |
| GET | `/api/docs/search` | `docs.search` | 已實作 | — | 無 |

## execution（3／7 已實作）

| 方法 | 路徑 | operationId | 狀態 | 資料來源 | 驗證 |
|---|---|---|---|---|---|
| GET | `/api/execution-plans` | `execution.list` | 已實作 | 記憶體 | 登入 |
| GET | `/api/tasks/{task_id}/execution-plan` | `execution.get` | 已實作 | 記憶體 | 登入 |
| POST | `/api/tasks/{task_id}/execution-plan/suggest` | `execution.suggest` | 已實作 | 記憶體 | 登入 |
| PUT | `/api/tasks/{task_id}/execution-plan` | `execution.save` | 501 | — | 無 |
| POST | `/api/tasks/{task_id}/execution-plan/confirm` | `execution.confirm` | 501 | — | 無 |
| POST | `/api/tasks/{task_id}/execution-plan/items/{item_id}/toggle` | `execution.toggleItem` | 501 | — | 無 |
| POST | `/api/tasks/{task_id}/execution-plan/checkpoints/{checkpoint_id}/toggle` | `execution.toggleCheckpoint` | 501 | — | 無 |

## github（4／4 已實作）

| 方法 | 路徑 | operationId | 狀態 | 資料來源 | 驗證 |
|---|---|---|---|---|---|
| GET | `/api/github/install-url` | `github.installUrl` | 已實作 | 資料庫 | 登入 |
| POST | `/api/github/installations` | `github.completeInstallation` | 已實作 | 資料庫 | 登入（帳號） |
| PUT | `/api/github/repository` | `github.chooseRepository` | 已實作 | 資料庫 | 登入 |
| DELETE | `/api/github/repository` | `github.unlink` | 已實作 | 資料庫 | 登入 |

## invitations（6／6 已實作）

| 方法 | 路徑 | operationId | 狀態 | 資料來源 | 驗證 |
|---|---|---|---|---|---|
| GET | `/api/invitations` | `invitations.list` | 已實作 | 資料庫 | Leader |
| POST | `/api/invitations` | `invitations.create` | 已實作 | 資料庫 | Leader |
| DELETE | `/api/invitations/{id}` | `invitations.revoke` | 已實作 | 資料庫 | Leader |
| GET | `/api/invitations/mine` | `invitations.mine` | 已實作 | 資料庫 | 登入（帳號） |
| POST | `/api/invitations/{id}/accept` | `invitations.accept` | 已實作 | 資料庫 | 登入（帳號） |
| POST | `/api/invitations/{id}/decline` | `invitations.decline` | 已實作 | 資料庫 | 登入（帳號） |

## issues（1／6 已實作）

| 方法 | 路徑 | operationId | 狀態 | 資料來源 | 驗證 |
|---|---|---|---|---|---|
| GET | `/api/issues` | `issues.list` | 已實作 | 資料庫 | 登入 |
| POST | `/api/issues` | `issues.report` | 501 | — | 無 |
| POST | `/api/issues/{id}/assign` | `issues.assign` | 501 | — | 無 |
| POST | `/api/issues/{id}/respond` | `issues.respond` | 501 | — | 無 |
| POST | `/api/issues/{id}/resolve` | `issues.resolve` | 501 | — | 無 |
| POST | `/api/issues/{id}/replan` | `issues.replan` | 501 | — | 無 |

## join_codes（9／9 已實作）

| 方法 | 路徑 | operationId | 狀態 | 資料來源 | 驗證 |
|---|---|---|---|---|---|
| GET | `/api/join-codes/current` | `joinCodes.current` | 已實作 | 資料庫 | Leader |
| POST | `/api/join-codes` | `joinCodes.create` | 已實作 | 資料庫 | Leader |
| DELETE | `/api/join-codes/current` | `joinCodes.revoke` | 已實作 | 資料庫 | Leader |
| GET | `/api/join-requests` | `joinCodes.listRequests` | 已實作 | 資料庫 | Leader |
| POST | `/api/join-requests/{id}/approve` | `joinCodes.approve` | 已實作 | 資料庫 | Leader |
| POST | `/api/join-requests/{id}/reject` | `joinCodes.reject` | 已實作 | 資料庫 | Leader |
| POST | `/api/join-requests` | `joinCodes.submit` | 已實作 | 資料庫 | 登入（帳號） |
| GET | `/api/join-requests/mine` | `joinCodes.mine` | 已實作 | 資料庫 | 登入（帳號） |
| DELETE | `/api/join-requests/{id}` | `joinCodes.cancel` | 已實作 | 資料庫 | 登入（帳號） |

## members（4／4 已實作）

| 方法 | 路徑 | operationId | 狀態 | 資料來源 | 驗證 |
|---|---|---|---|---|---|
| GET | `/api/members` | `members.list` | 已實作 | 資料庫＋記憶體（依身分） | 登入 |
| POST | `/api/members` | `members.invite` | 部分實作 | 資料庫＋記憶體（依身分） | Leader |
| PATCH | `/api/members/{id}` | `members.update` | 已實作 | 資料庫＋記憶體（依身分） | Leader |
| DELETE | `/api/members/{id}` | `members.remove` | 已實作 | 資料庫 | Leader |

## notifications（3／3 已實作）

| 方法 | 路徑 | operationId | 狀態 | 資料來源 | 驗證 |
|---|---|---|---|---|---|
| GET | `/api/notifications` | `notifications.list` | 已實作 | 資料庫＋記憶體（依身分） | 登入（帳號） |
| POST | `/api/notifications/read-all` | `notifications.markAllRead` | 已實作 | 資料庫 | 登入（帳號） |
| POST | `/api/notifications/{id}/read` | `notifications.markRead` | 已實作 | 資料庫 | 登入（帳號） |

## planning（8／8 已實作）

| 方法 | 路徑 | operationId | 狀態 | 資料來源 | 驗證 |
|---|---|---|---|---|---|
| GET | `/api/planning/minutes/sample` | `planning.getSampleMinutes` | 已實作 | — | 無 |
| POST | `/api/planning/drafts` | `planning.generateDraft` | 已實作 | 記憶體 | Leader |
| POST | `/api/planning/drafts/tasks` | `planning.generateTasks` | 已實作 | 記憶體 | 無 |
| POST | `/api/planning/drafts/submit` | `planning.submitPlan` | 已實作 | 記憶體 | Leader |
| POST | `/api/planning/drafts/chat` | `planning.askStoryAssistant` | 已實作 | 記憶體 | Leader |
| POST | `/api/sprints/{sprint_id}/decompose` | `planning.decompose` | 已實作 | 記憶體 | Leader |
| POST | `/api/sprints/{sprint_id}/defer-suggested` | `planning.deferSuggested` | 已實作 | 記憶體 | Leader |
| POST | `/api/sprints/{sprint_id}/rebalance` | `planning.rebalance` | 已實作 | 記憶體 | Leader |

## proposals（1／4 已實作）

| 方法 | 路徑 | operationId | 狀態 | 資料來源 | 驗證 |
|---|---|---|---|---|---|
| GET | `/api/proposals` | `proposals.list` | 已實作 | 資料庫 | 登入 |
| POST | `/api/proposals` | `proposals.create` | 501 | — | 無 |
| POST | `/api/proposals/{id}/comments` | `proposals.comment` | 501 | — | 無 |
| POST | `/api/proposals/{id}/decide` | `proposals.decide` | 501 | — | 無 |

## retros（0／6 已實作）

| 方法 | 路徑 | operationId | 狀態 | 資料來源 | 驗證 |
|---|---|---|---|---|---|
| GET | `/api/sprints/{sprint_id}/retro` | `retros.get` | 501 | — | 無 |
| GET | `/api/retros` | `retros.list` | 501 | — | 無 |
| POST | `/api/sprints/{sprint_id}/retro/entries` | `retros.submitEntry` | 501 | — | 無 |
| POST | `/api/sprints/{sprint_id}/retro/actions` | `retros.addAction` | 501 | — | 無 |
| POST | `/api/sprints/{sprint_id}/retro/actions/{action_id}/toggle` | `retros.toggleAction` | 501 | — | 無 |
| POST | `/api/sprints/{sprint_id}/retro/close` | `retros.close` | 501 | — | 無 |

## sprints（13／14 已實作）

| 方法 | 路徑 | operationId | 狀態 | 資料來源 | 驗證 |
|---|---|---|---|---|---|
| GET | `/api/sprints` | `sprints.list` | 已實作 | 資料庫＋記憶體（依身分） | 登入 |
| GET | `/api/sprints/defaults` | `sprints.defaults` | 已實作 | 資料庫＋記憶體（依身分） | 登入 |
| POST | `/api/sprints` | `sprints.create` | 已實作 | 資料庫＋記憶體（依身分） | Leader |
| PATCH | `/api/sprints/{sprint_id}` | `sprints.update` | 已實作 | 資料庫＋記憶體（依身分） | Leader |
| POST | `/api/sprints/{sprint_id}/docs` | `sprints.addDocs` | 已實作 | 資料庫＋記憶體（依身分） | Leader |
| POST | `/api/sprints/{sprint_id}/analyze` | `sprints.analyze` | 已實作 | 資料庫＋記憶體（依身分） | Leader |
| PUT | `/api/sprints/{sprint_id}/questions/{question_id}` | `sprints.answer` | 已實作 | 資料庫＋記憶體（依身分） | Leader |
| POST | `/api/sprints/{sprint_id}/end` | `sprints.end` | 已實作 | 記憶體 | Leader |
| POST | `/api/sprints/{sprint_id}/start` | `sprints.start` | 已實作 | 記憶體 | Leader |
| GET | `/api/sprints/{sprint_id}/burndown` | `sprints.burndown` | 501 | — | 無 |
| GET | `/api/backlog` | `sprints.backlog` | 已實作 | 資料庫＋記憶體（依身分） | 登入 |
| PUT | `/api/backlog/{id}/decision` | `sprints.decideBacklog` | 已實作 | 資料庫＋記憶體（依身分） | Leader |
| DELETE | `/api/backlog/{id}` | `sprints.removeBacklog` | 已實作 | 資料庫＋記憶體（依身分） | Leader |
| GET | `/api/sprints/{sprint_id}/dependencies` | `sprints.dependencies` | 已實作 | 資料庫＋記憶體（依身分） | 登入 |

## studio（4／4 已實作）

| 方法 | 路徑 | operationId | 狀態 | 資料來源 | 驗證 |
|---|---|---|---|---|---|
| GET | `/api/tasks/{task_id}/prompt` | `studio.getPrompt` | 已實作 | 記憶體 | 登入 |
| PUT | `/api/tasks/{task_id}/prompt/current` | `studio.setPromptVersion` | 已實作 | 記憶體 | 登入 |
| GET | `/api/tasks/{task_id}/chat` | `studio.getChat` | 已實作 | 記憶體 | 登入 |
| POST | `/api/tasks/{task_id}/chat` | `studio.ask` | 已實作 | 記憶體 | 登入 |

## tasks（16／22 已實作）

| 方法 | 路徑 | operationId | 狀態 | 資料來源 | 驗證 |
|---|---|---|---|---|---|
| GET | `/api/tasks` | `tasks.list` | 已實作 | 記憶體 | 無 |
| POST | `/api/tasks` | `tasks.create` | 已實作 | 記憶體 | Leader |
| PATCH | `/api/tasks/{id}` | `tasks.update` | 已實作 | 記憶體 | Leader |
| DELETE | `/api/tasks/{id}` | `tasks.remove` | 已實作 | 記憶體 | Leader |
| POST | `/api/tasks/drafts/approve` | `tasks.approveDrafts` | 已實作 | 記憶體 | Leader |
| POST | `/api/tasks/{id}/defer` | `tasks.defer` | 已實作 | 記憶體 | Leader |
| POST | `/api/tasks/{id}/restore` | `tasks.restore` | 已實作 | 記憶體 | Leader |
| PUT | `/api/tasks/{id}/carry` | `tasks.setCarry` | 已實作 | 記憶體 | Leader |
| POST | `/api/tasks/{id}/carry/resend` | `tasks.resendCarry` | 501 | — | 無 |
| POST | `/api/tasks/{id}/resend` | `tasks.resend` | 501 | — | 無 |
| POST | `/api/tasks/{id}/suggest-assignee` | `tasks.suggestAssignee` | 已實作 | 記憶體 | Leader |
| POST | `/api/tasks/{id}/reset-return` | `tasks.resetReturn` | 501 | — | 無 |
| PUT | `/api/tasks/{id}/revise` | `tasks.revise` | 501 | — | 無 |
| POST | `/api/tasks/{id}/accept` | `tasks.accept` | 已實作 | 記憶體 | 登入 |
| POST | `/api/tasks/{id}/negotiate` | `tasks.negotiate` | 已實作 | 記憶體 | 登入 |
| POST | `/api/tasks/{id}/review/claim` | `tasks.claimReview` | 已實作 | 記憶體 | 登入 |
| POST | `/api/tasks/{id}/start` | `tasks.startDevelopment` | 已實作 | 記憶體 | 登入 |
| POST | `/api/tasks/{id}/review` | `tasks.submitForReview` | 已實作 | 記憶體 | 登入 |
| POST | `/api/tasks/{id}/review/approve` | `tasks.approveReview` | 已實作 | 記憶體 | 登入 |
| POST | `/api/tasks/{id}/review/request-changes` | `tasks.requestChanges` | 已實作 | 記憶體 | 登入 |
| POST | `/api/tasks/{id}/plan-confirm` | `tasks.confirmPlan` | 501 | — | 無 |
| PUT | `/api/tasks/{id}/policy` | `tasks.updatePolicy` | 501 | — | 無 |

## workspace（6／6 已實作）

| 方法 | 路徑 | operationId | 狀態 | 資料來源 | 驗證 |
|---|---|---|---|---|---|
| GET | `/api/organization` | `workspace.getOrganization` | 已實作 | 資料庫＋記憶體（依身分） | 登入 |
| GET | `/api/projects` | `workspace.listProjects` | 已實作 | 資料庫＋記憶體（依身分） | 登入（帳號） |
| POST | `/api/projects` | `workspace.createProject` | 已實作 | 資料庫 | 登入（帳號） |
| GET | `/api/project` | `workspace.getProject` | 已實作 | 資料庫＋記憶體（依身分） | 登入 |
| PATCH | `/api/project` | `workspace.updateProject` | 已實作 | 資料庫＋記憶體（依身分） | Leader |
| DELETE | `/api/project` | `workspace.deleteProject` | 已實作 | 資料庫 | 登入（帳號） |
