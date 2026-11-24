# API 對照表

前端 `frontend/src/services/contracts.ts` 的每個方法，與後端路由、前端 mock 實作的對應。
後端路由目前只有路徑與資料格式，呼叫時回傳 `501 NOT_IMPLEMENTED`；實作時可以參考 mock 欄位的檔案移植規則。

- 啟動後端後，完整的輸入輸出格式見 http://localhost:8000/docs
- `backend/tests/test_app.py` 會檢查前端 `services/http/index.ts` 呼叫的端點，後端都有定義
- 新增或修改 API 時，前端 `contracts.ts`、`services/http/index.ts` 與後端路由要一起更新

| 服務 | 後端路由檔 | 前端 mock 實作 |
|---|---|---|
| `auth` | `backend/app/api/routes/auth.py` | `frontend/src/services/mock/workspace.ts` |
| `members` | `backend/app/api/routes/members.py` | `frontend/src/services/mock/workspace.ts` |
| `workspace` | `backend/app/api/routes/workspace.py` | `frontend/src/services/mock/workspace.ts` |
| `docs` | `backend/app/api/routes/docs.py` | `frontend/src/services/mock/workspace.ts`、`frontend/src/mocks/handlers/knowledge.ts` |
| `sprints` | `backend/app/api/routes/sprints.py` | `frontend/src/services/mock/tasks.ts`、`frontend/src/mocks/handlers/sprint.ts` |
| `tasks` | `backend/app/api/routes/tasks.py` | `frontend/src/services/mock/tasks.ts` |
| `planning` | `backend/app/api/routes/planning.py` | `frontend/src/services/mock/tasks.ts`、`frontend/src/mocks/handlers/planning.ts`、`frontend/src/mocks/handlers/decompose.ts`、`frontend/src/mocks/handlers/assign.ts` |
| `notifications` | `backend/app/api/routes/notifications.py` | `frontend/src/services/mock/tasks.ts` |
| `studio` | `backend/app/api/routes/studio.py` | `frontend/src/services/mock/tasks.ts`、`frontend/src/mocks/handlers/prompt.ts`、`frontend/src/mocks/handlers/chat.ts` |
| `execution` | `backend/app/api/routes/execution.py` | `frontend/src/services/mock/collab.ts`、`frontend/src/mocks/handlers/execution.ts` |
| `comments` | `backend/app/api/routes/comments.py` | `frontend/src/services/mock/collab.ts` |
| `issues` | `backend/app/api/routes/issues.py` | `frontend/src/services/mock/collab.ts`、`frontend/src/mocks/handlers/issues.ts` |
| `proposals` | `backend/app/api/routes/proposals.py` | `frontend/src/services/mock/collab.ts` |
| `acceptance` | `backend/app/api/routes/acceptance.py` | `frontend/src/services/mock/collab.ts`、`frontend/src/mocks/handlers/acceptance.ts` |
| `retros` | `backend/app/api/routes/retros.py` | `frontend/src/services/mock/collab.ts` |

## auth

| 方法 | HTTP | 路徑 |
|---|---|---|
| `auth.me` | GET | `/api/me` |
| `auth.switchUser` | POST | `/api/auth/switch` |
| `auth.updateMe` | PATCH | `/api/me` |

## members

| 方法 | HTTP | 路徑 |
|---|---|---|
| `members.list` | GET | `/api/members` |
| `members.invite` | POST | `/api/members` |
| `members.update` | PATCH | `/api/members/{id}` |
| `members.remove` | DELETE | `/api/members/{id}` |

## workspace

| 方法 | HTTP | 路徑 |
|---|---|---|
| `workspace.getOrganization` | GET | `/api/organization` |
| `workspace.getProject` | GET | `/api/project` |
| `workspace.updateProject` | PATCH | `/api/project` |
| `workspace.deleteProject` | DELETE | `/api/project` |

## docs

| 方法 | HTTP | 路徑 |
|---|---|---|
| `docs.list` | GET | `/api/docs` |
| `docs.upload` | POST | `/api/docs` |
| `docs.addLink` | POST | `/api/docs/links` |
| `docs.remove` | DELETE | `/api/docs/{id}` |
| `docs.search` | GET | `/api/docs/search` |

## sprints

| 方法 | HTTP | 路徑 |
|---|---|---|
| `sprints.list` | GET | `/api/sprints` |
| `sprints.defaults` | GET | `/api/sprints/defaults` |
| `sprints.create` | POST | `/api/sprints` |
| `sprints.update` | PATCH | `/api/sprints/{sprint_id}` |
| `sprints.addDocs` | POST | `/api/sprints/{sprint_id}/docs` |
| `sprints.analyze` | POST | `/api/sprints/{sprint_id}/analyze` |
| `sprints.answer` | PUT | `/api/sprints/{sprint_id}/questions/{question_id}` |
| `sprints.end` | POST | `/api/sprints/{sprint_id}/end` |
| `sprints.start` | POST | `/api/sprints/{sprint_id}/start` |
| `sprints.burndown` | GET | `/api/sprints/{sprint_id}/burndown` |
| `sprints.backlog` | GET | `/api/backlog` |
| `sprints.decideBacklog` | PUT | `/api/backlog/{id}/decision` |
| `sprints.removeBacklog` | DELETE | `/api/backlog/{id}` |
| `sprints.dependencies` | GET | `/api/sprints/{sprint_id}/dependencies` |

## tasks

| 方法 | HTTP | 路徑 |
|---|---|---|
| `tasks.list` | GET | `/api/tasks` |
| `tasks.create` | POST | `/api/tasks` |
| `tasks.update` | PATCH | `/api/tasks/{id}` |
| `tasks.remove` | DELETE | `/api/tasks/{id}` |
| `tasks.approveDrafts` | POST | `/api/tasks/drafts/approve` |
| `tasks.defer` | POST | `/api/tasks/{id}/defer` |
| `tasks.restore` | POST | `/api/tasks/{id}/restore` |
| `tasks.setCarry` | PUT | `/api/tasks/{id}/carry` |
| `tasks.resendCarry` | POST | `/api/tasks/{id}/carry/resend` |
| `tasks.resend` | POST | `/api/tasks/{id}/resend` |
| `tasks.suggestAssignee` | POST | `/api/tasks/{id}/suggest-assignee` |
| `tasks.resetReturn` | POST | `/api/tasks/{id}/reset-return` |
| `tasks.revise` | PUT | `/api/tasks/{id}/revise` |
| `tasks.accept` | POST | `/api/tasks/{id}/accept` |
| `tasks.negotiate` | POST | `/api/tasks/{id}/negotiate` |
| `tasks.claimReview` | POST | `/api/tasks/{id}/review/claim` |
| `tasks.startDevelopment` | POST | `/api/tasks/{id}/start` |
| `tasks.submitForReview` | POST | `/api/tasks/{id}/review` |
| `tasks.approveReview` | POST | `/api/tasks/{id}/review/approve` |
| `tasks.requestChanges` | POST | `/api/tasks/{id}/review/request-changes` |
| `tasks.confirmPlan` | POST | `/api/tasks/{id}/plan-confirm` |
| `tasks.updatePolicy` | PUT | `/api/tasks/{id}/policy` |

## planning

| 方法 | HTTP | 路徑 |
|---|---|---|
| `planning.getSampleMinutes` | GET | `/api/planning/minutes/sample` |
| `planning.generateDraft` | POST | `/api/planning/drafts` |
| `planning.generateTasks` | POST | `/api/planning/drafts/tasks` |
| `planning.submitPlan` | POST | `/api/planning/drafts/submit` |
| `planning.askStoryAssistant` | POST | `/api/planning/drafts/chat` |
| `planning.decompose` | POST | `/api/sprints/{sprint_id}/decompose` |
| `planning.deferSuggested` | POST | `/api/sprints/{sprint_id}/defer-suggested` |
| `planning.rebalance` | POST | `/api/sprints/{sprint_id}/rebalance` |

## notifications

| 方法 | HTTP | 路徑 |
|---|---|---|
| `notifications.list` | GET | `/api/notifications` |

## studio

| 方法 | HTTP | 路徑 |
|---|---|---|
| `studio.getPrompt` | GET | `/api/tasks/{task_id}/prompt` |
| `studio.setPromptVersion` | PUT | `/api/tasks/{task_id}/prompt/current` |
| `studio.getChat` | GET | `/api/tasks/{task_id}/chat` |
| `studio.ask` | POST | `/api/tasks/{task_id}/chat` |

## execution

| 方法 | HTTP | 路徑 |
|---|---|---|
| `execution.list` | GET | `/api/execution-plans` |
| `execution.get` | GET | `/api/tasks/{task_id}/execution-plan` |
| `execution.suggest` | POST | `/api/tasks/{task_id}/execution-plan/suggest` |
| `execution.save` | PUT | `/api/tasks/{task_id}/execution-plan` |
| `execution.confirm` | POST | `/api/tasks/{task_id}/execution-plan/confirm` |
| `execution.toggleItem` | POST | `/api/tasks/{task_id}/execution-plan/items/{item_id}/toggle` |
| `execution.toggleCheckpoint` | POST | `/api/tasks/{task_id}/execution-plan/checkpoints/{checkpoint_id}/toggle` |

## comments

| 方法 | HTTP | 路徑 |
|---|---|---|
| `comments.list` | GET | `/api/tasks/{task_id}/comments` |
| `comments.add` | POST | `/api/tasks/{task_id}/comments` |
| `comments.markRead` | POST | `/api/tasks/{task_id}/comments/read` |

## issues

| 方法 | HTTP | 路徑 |
|---|---|---|
| `issues.list` | GET | `/api/issues` |
| `issues.report` | POST | `/api/issues` |
| `issues.assign` | POST | `/api/issues/{id}/assign` |
| `issues.respond` | POST | `/api/issues/{id}/respond` |
| `issues.resolve` | POST | `/api/issues/{id}/resolve` |
| `issues.replan` | POST | `/api/issues/{id}/replan` |

## proposals

| 方法 | HTTP | 路徑 |
|---|---|---|
| `proposals.list` | GET | `/api/proposals` |
| `proposals.create` | POST | `/api/proposals` |
| `proposals.comment` | POST | `/api/proposals/{id}/comments` |
| `proposals.decide` | POST | `/api/proposals/{id}/decide` |

## acceptance

| 方法 | HTTP | 路徑 |
|---|---|---|
| `acceptance.check` | POST | `/api/tasks/{task_id}/acceptance/check` |
| `acceptance.records` | GET | `/api/tasks/{task_id}/acceptance/records` |

## retros

| 方法 | HTTP | 路徑 |
|---|---|---|
| `retros.get` | GET | `/api/sprints/{sprint_id}/retro` |
| `retros.list` | GET | `/api/retros` |
| `retros.submitEntry` | POST | `/api/sprints/{sprint_id}/retro/entries` |
| `retros.addAction` | POST | `/api/sprints/{sprint_id}/retro/actions` |
| `retros.toggleAction` | POST | `/api/sprints/{sprint_id}/retro/actions/{action_id}/toggle` |
| `retros.close` | POST | `/api/sprints/{sprint_id}/retro/close` |
