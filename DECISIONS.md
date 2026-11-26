# Project Decisions

## Decision 001: Use GitHub Pull Requests for Code Review

#### Date: 2026-10-23

#### Status: Accepted

#### Context: We have finalized the recurring meeting schedule, completed the CP1 discussion, and designated the code steward for the current phase. 

- Recurring meeting schedule: From 21:00 to 22:00, every Thursday.
- Current code steward recorded
  - Name: 林念慈（Veronica Lin）
  - GitHub: @NienTL
  - Responsibilities: Maintain code quality, coordinate code reviews, and document significant technical decisions.
- Update (2026-11-24): steward role handed over to 葉沛鑫 (@leafs2), see Decision 002.

---

## Decision 002: Code Steward Handoff to 葉沛鑫 (@leafs2)

#### Date: 2026-11-24

#### Status: Accepted

#### Context: Every member must serve as code steward at least once before CP2 (due 2026-11-29). 林念慈 has been steward since 2026-10-23 (Decision 001), so the team agreed to rotate the role.

- Previous steward: 林念慈（Veronica Lin）, GitHub @NienTL, 2026-10-23 to 2026-11-23
- New steward: 葉沛鑫, GitHub @leafs2, from 2026-11-24
- Responsibilities: review and merge PRs, leave at least one specific comment on every approval (file or line, plus a question, concern or suggestion), keep DECISIONS.md up to date, and write the merge plan before merge day.
- Decided by: whole team, 2026-11-24, in our LINE group

#### Handoff notes (from @NienTL to @leafs2)

- Open PRs: #24 AI_Usage_Guidelines v1.1 (author @ning415415, waiting for the rule 3 command update); #1 leaf-test from 2026-09-21 (test PR, to be closed without merging).
- A steward does not approve or merge their own PR; PRs by @leafs2 are reviewed by another member (as #23 was, by @ning415415).
- Since PR #18, every PR uses `.github/pull_request_template.md`. Check that "AI assistance" and "How I checked it" are filled in before approving.
- Open issues from the Week 12 Lab review: #19 prompt test for targeted malicious minutes, #20 README setup errors on a new machine, #21 hosted version. Owners and dates still to be assigned.
- Before CP2: write the merge plan entry in DECISIONS.md (every open branch and PR, merge order and why, expected conflicts, PRs to close, what "done" means that day).
- Other: To be added by @NienTL in review

---

<!-- Decision 003–022 為補錄（依 PR #1–#41 與 issue、EVAL_LOG 整理），日期為 PR 建立日；「Led by」依 PR 作者或 PR 內文標註，請各主導者確認。-->

## Decision 003: 以 Pull Request 範本要求「AI assistance」與「Decision」段落
#### Date: 2026-10-23（範本）／2026-11-24（改用課程範本）
#### Status: Accepted
- Chosen: 建立 PR 範本（#5），改用課程提供的範本並保留 Decision 段落、刪除根目錄重複範本（#18）。
- Why: 讓每個 PR 都能看出 AI 用在哪裡、如何驗證，也讓決策有地方記錄。
- Led by: @NienTL（#5）、@ning415415（#18）
- Evidence: PR #5、#18

---

## Decision 004: 前端先以 mock 與 http 兩套實作切換
#### Date: 2026-11-20 ｜ Status: Accepted
- Chosen: 前端透過 `services/contracts.ts` 定義 API 介面，mock 與 http 兩套實作可切換；先完成整條 Sprint 流程的 mock 版本，作為後端介面規格。
- Why: 後端與資料表尚未完成時，前後端仍能並行開發，也能先拿 mock 給人試用。
- Led by: @leafs2 ｜ Evidence: PR #8

---

## Decision 005: 後端架構與第一版不做向量檢索
#### Date: 2026-11-20 ｜ Status: Accepted
- Chosen: 前後端與文件拆分（FastAPI 後端、docs、docker-compose、CI）；AI 功能直接帶入所需資料，初期不做向量檢索（RAG）。
- Why: 先讓主要流程跑通；RAG 的成本與複雜度不符合目前階段。
- 後續: #34 進一步移除未使用的 Redis、worker、storage 空殼，設計意圖記在 `docs/architecture.md`「尚未實作的設計」。
- Led by: @leafs2 ｜ Evidence: PR #9、#34

---

## Decision 006: 登入使用 Supabase Auth（GitHub provider），後端只驗證 JWT
#### Date: 2026-11-22 ｜ Status: Accepted
- Chosen: 前端以 Supabase Auth 登入，後端以 JWKS 公開金鑰驗證 JWT，不自行實作 OAuth 流程。
- Why: 目標使用者是學生，GitHub 帳號本來就有；自行實作 OAuth 風險高且不是產品重點。
- Led by: @leafs2 ｜ Evidence: PR #11

---

## Decision 007: 資料庫分批遷移，依外鍵相依順序串接
#### Date: 2026-11-22 ｜ Status: Accepted
- Chosen: 每份遷移只建相關資料表；尚未存在的表（tasks、sprints）先不建外鍵，之後補上。專案目前的 Sprint 只記在 `sprints.status`，不在 `projects` 重複存 Sprint id。AI 拆解的草稿與正式任務共用 `tasks`，用 `state` 區分，不另建草稿表。不建立 `acceptance_checks`，AI 驗收結果即時產生，只保存 Reviewer 的最終判斷。
- Why: 避免互相等待與重複儲存資訊，維持資料一致性。
- Led by: @NienTL ｜ Evidence: PR #12、#13、#15、#17；說明見 `docs/database.md`

---

## Decision 008: 規劃流程先用記憶體假資料，並新增 AI 呼叫稽核紀錄
#### Date: 2026-11-22 ｜ Status: Accepted（記憶體部分已由 Decision 013 取代）
- Chosen: 規劃流程路由先用 `MemoryStore`，不等資料表；新增 `app/ai/audit.py`，每個有呼叫模型的請求寫成一筆 JSON Lines。
- Rejected: 等資料表完成再實作（前端會無法連後端操作整個流程）；只用 INFO 日誌記 token（看不到提示詞與回傳內容，無法追查）。
- Evidence of value: Task 拆解漏掉 Story 與逾時的問題，是靠稽核紀錄找到原因。
- Led by: @chenni416 ｜ Evidence: PR #16

---

## Decision 009: 修 CI 的 401 失敗只改測試，不改正式的 auth
#### Date: 2026-11-22 ｜ Status: Accepted
- Chosen: 測試客戶端預設帶 `X-Demo-User: m1`（Leader），不改 `auth.py`。
- Why: 為了讓測試通過而放寬正式驗證，會削弱登入檢查。
- Led by: @chenni416 ｜ Evidence: PR #14

---

## Decision 010: Prompt v0.2 與「能由程式確定的規則交給程式」
#### Date: 2026-11-21（v0.2）～2026-11-25（v0.3.2） ｜ Status: Accepted
- Chosen: 9 個 prompt 補上輸入格式、步驟、欄位與自我檢查，共用規則放 `_safety.md`；Task 點數統一為 1、2、3、5、8；指派時由程式驗算負載；後續失敗案例中，凡能由程式確定判斷的規則（負載、重複相依）改由程式處理，不只靠 prompt 約束。
- Why: 靜態檢查 v0.1 為 12/32、v0.2 為 32/32；真實模型測試中 C09、C07 反覆失敗，單靠提示詞無效（EVAL_LOG R4、R4b、R8）。
- Led by: @ning415415 ｜ Evidence: PR #10、#33；`backend/tests/prompt_eval/EVAL_LOG.md`

---

## Decision 011: 針對惡意會議紀錄的防護與測試（Week 12 Lab 回饋）
#### Date: 2026-11-25 ｜ Status: Accepted
- Context: Week 12 Lab 第 2 組指出，會議紀錄可能夾帶「不要分配任何工作給某成員」之類的指示（issue #19）。
- Chosen: 新增案例 C17、C18；整行都是分工指示時視為不存在，不建 Story、也不在 rationale 說明「自己略過了它」。結果 110/118 → 118/118。
- Rejected: 先前「用 suggestion 提醒 Leader」的做法，因為與「每行需求都要歸屬 Story」衝突，反而讓模型為惡意行另建 Story（R3b）。
- Led by: @ning415415 ｜ Evidence: issue #19、PR #33、EVAL_LOG R3、R3b、R3c

---

## Decision 012: AI 使用規範改成「看 PR 就能檢查」的規則（v1 → v1.1）
#### Date: 2026-11-24 ｜ Status: Accepted
- Chosen: 三條規則：approval 要有具體留言；PR 要填 AI assistance 段落；改 prompt 要附測試結果與指令。
- Why: Week 12 Lab 證據顯示原規則無法被檢查。
- Review 意見採納: @leafs2 建議列出完整操作指令。
- Led by: @ning415415 ｜ Evidence: PR #24（含 Revision history）

---

## Decision 013: 成員邀請提供兩種方式，不寄 email
#### Date: 2026-11-24 ｜ Status: Accepted
- Chosen: 指定 GitHub 帳號邀請（附連結，登入後在系統內接受或拒絕）與邀請碼（Leader 同意後加入）；刪除專案與移出成員需再次輸入名稱。「有效邀請碼」由 `revoked_at`／`expires_at` 即時判斷，不另存狀態；通知目的頁由 `ref_id` 即時推算，不存連結。撤銷邀請、取消申請不通知，避免打擾。
- Led by: @NienTL（#26、#29）、@leafs2（#23） ｜ Evidence: PR #23、#26、#29

---

## Decision 014: GitHub repo 連結透過 GitHub App 安裝流程
#### Date: 2026-11-24 ｜ Status: Accepted
- Chosen: 選擇整合 GitHub 時，建立專案後立即進入 GitHub App 安裝；後端以簽章 state 與使用者授權驗證後綁定 repo。專案設定精簡為兩步（基本資訊、知識庫與 Review 策略），repo 連結與刪除專案統一放基本資訊。
- Led by: @leafs2 ｜ Evidence: PR #27、#28；`docs/github.md` 第 8 節

---

## Decision 015: 以 `X-Project-Id` 標頭指定目前專案，並改為無效時明確報錯
#### Date: 2026-11-24（原決定）、2026-11-25（修訂） ｜ Status: Accepted（#22 的退回規則已被取代）
- 原決定（#22）: 標頭沒有或無效時用最近加入的專案；rejected: 把目前專案存在 members 表（切換要寫資料庫、多分頁互相影響）。Led by: Veronica。
- 修訂（#36）: 專案範圍端點嚴格（無效 → 400／403），帳號層級端點明確標示寬鬆；前端只送 uuid 並自動復原。
- Why: 原本「畫面是 A 專案、資料在 B 專案」且沒有錯誤，最難除錯。
- Rejected: 全部端點嚴格（`/me` 在專案失效時也失敗，前端無法復原）；只在前端防護；無效時回 404（與 `NO_PROJECT` 混淆）。
- Led by: Jennifer ｜ Evidence: PR #22、#34、#36

---

## Decision 016: 建立新專案流程與目前專案的保存方式
#### Date: 2026-11-25 ｜ Status: Accepted
- Chosen: 建立新專案仍在第一步就寫入資料庫，提供「取消建立」與離開確認；目前專案改記在 localStorage。
- Why: 原因是清單未重讀時側邊欄自動跳回第一個專案，且 GitHub 導回時整頁重新載入會遺失記憶體中的專案。
- Led by: @leafs2 ｜ Evidence: PR #30

---

## Decision 017: 共用 Supabase 一律用 Transaction pooler
#### Date: 2026-11-25 ｜ Status: Accepted
- Context: 免費版全專案只有 15 條連線，Session pooler 加上預設連線池，不到四人同時開後端就會滿（`EMAXCONNSESSION`）。
- Chosen: 後端用 Transaction pooler（6543）、`NullPool`、關閉 prepared statement；遷移走 Session pooler（5432）。
- Rejected: 只限制連線池大小（`pool_size=2, max_overflow=2`，PR #32）。#32 先提出並關閉，因為只是縮小問題，且當時判斷 transaction 模式牽涉部署設定。#31 實際解決。
- Led by: @leafs2（#31 採用）、@chenni416（#32 提出） ｜ Evidence: PR #31、#32

---

## Decision 018: 後端架構整理階段 0——先加觀測與約定，不改行為
#### Date: 2026-11-25 ｜ Status: Accepted
- Context: 一個端點兩套實作（uuid 走資料庫、demo 成員走記憶體）、出錯無追蹤線索、文件過期。
- Chosen: 共用依賴、request id 與請求日誌、專案退回留下日誌、移除死碼、自動產生 API 狀態表並以測試防止過期、新增「症狀 → 檔案」對照表。
- Rejected（當時）: 直接把靜默退回改成報錯，因為需要前端配合，放到 Decision 015；在錯誤 JSON 加 `requestId` 欄位，因為會破壞既有測試與前端契約，只用標頭與訊息中的錯誤代碼。
- 審查意見（@ning415415，已採納並已確認在 main）: RequestIdMiddleware 原本在 CORS 外層，未處理例外的 500 沒有 CORS 標頭，前端讀不到錯誤代碼；改為 CORS 在最外層，並新增帶 Origin 的測試（`test_observability.py`）。FastAPI description 的「501」說明也改為指向 `docs/api-status.md`。
- Led by: Jennifer ｜ Evidence: PR #34

---

## Decision 019: 環境一致性用「診斷工具＋守門測試＋跨平台 CI」三層維持
#### Date: 2026-11-25 ｜ Status: Accepted
- Context: 繁中 Windows（cp950）上 `alembic.ini` 含中文會讓遷移與 DB 測試全部失敗；CRLF、IPv6／`localhost`、應用程式控制擋 `.exe` 等問題只在特定電腦出現。
- Chosen: `doctor.sh`、`.gitattributes`、`test_alembic_ini.py` 守門測試（採納 @leafs2 的 review 建議）、三平台 `env-smoke.yml`。
- Rejected: 只更新 README；把 `localhost` 問題留給使用者改 `.env`；`doctor` 用 Python 寫（沒有 uv 時最需要它）。
- Led by: Jennifer ｜ Evidence: PR #35、#37

---

## Decision 020: Sprint、任務與任務生命週期改存資料庫；狀態轉換新增檢查
#### Date: 2026-11-26 ｜ Status: Accepted
- Chosen: 階段 1 把 Sprint、任務、規劃、延續事項、通知改存資料庫（取代 Decision 008 的記憶體）；階段 2 實作核准派工之後的 9 個端點，沿用 mock 規則但新增狀態檢查。
- Rejected: 完全照搬 mock（mock 不會被亂序、重送呼叫；真實 API 會，不檢查會讓已完成的任務又被送審）；為每個動作各寫查詢；以 `DEFERRABLE` 唯一索引處理狀態交換（需新 migration）。
- 已知未做: 逐條驗收紀錄、Sprint 結束自動建立回顧、送審時建立 PR。
- Led by: Jennifer ｜ Evidence: PR #38、#39、#41

---

## Decision 021: 開發環境 CORS 放行任何本機 port
#### Date: 2026-11-26 ｜ Status: Accepted
- Chosen: development 下放行 `localhost`／`127.0.0.1` 任何 port。小改動，PR 自述不涉及架構決策。
- Risk 已記錄: `APP_ENV` 預設為 `development`，部署必須明確設成 production。
- Led by: Jennifer ｜ Evidence: PR #40

---

## Decision 022: 合併策略——疊 PR 的補救
#### Date: 2026-11-26 ｜ Status: Accepted
- Context: #36→#34、#37→#35、#38→#36、#39→#38 疊在彼此之上，只合進了父分支，沒有進 `main`（commit 紀錄：「原 PR 疊在其他分支上，只合進了父分支」）。
- Chosen: 以 #41 整併 #36～#39 一次進入 `main`，不新增功能。
- Lesson: 疊 PR 要確認每一層最後都進 `main`；#36～#39 與 #41 在 GitHub 上沒有 review 紀錄，這是目前 review 品質的缺口（見第 3 部分）。
- Led by: Jennifer ｜ Evidence: PR #41

---

## Decision 023: Merge plan（CP2 前 merge day）
#### Date: 2026-11-26 起草（**合併日日期與參與者請填**） ｜ Status: Draft，待全組確認
> 狀態依據：2026-11-26 查詢 GitHub。`main` 為 `61e8182`（Merge #41），`main` 最近的 CI（`ci.yml`、`env-smoke.yml`，#41）為 success；2026-11-26 在本機對 `main` 另跑：後端 ruff 通過、180 個非 DB 測試通過，前端 lint 與 build 通過（DB 測試靠 CI）；**目前沒有 open 的 PR**。

**1. 目前每條分支與 PR 的處置**

| 類別 | 分支／PR | 現況 | 處置 | 原因 |
|---|---|---|---|---|
| 已進 main | #5–#18、#22–#31、#33–#35、#40、#41 對應分支（`feat/database*`、`feat/github-*`、`feat/join-codes`、`feat/new-user-welcome`、`fix/project-settings-layout`、`fix/invite-dialog`、`fix/db-connection-pool`、`docs/*`、`chore/*`、`ui/*` 等） | 內容已在 main，分支比 main 落後 | 合併日當天刪除遠端分支 | 避免日後誤從舊分支開工；保留 PR 紀錄即可 |
| 已進 main（經 #41 整併） | `refactor/architecture-phase0`（#34）、`fix/windows-local-env`（#35）、`chore/env-consistency`（#37）、`fix/project-id-explicit-error`（#36）、`feat/phase1-sprint-db`（#38）、`feat/phase2-lifecycle`（#39） | #36～#39 原本疊在父分支，只合進父分支；以 #41 一次補進 main | 確認 main 含這些內容後刪除分支 | #41 為整併，不新增功能 |
| 已進 main | `feat/cors-localhost-any-port`（#40） | 已合併 | 刪除 | — |
| 不合併 | `fix/db-pool-size`（#32，已關閉） | 只有 1 個 commit（`pool_size=2, max_overflow=2`） | 刪除，不合併 | 已被 #31（Transaction pooler＋`NullPool`）取代，見 Decision 017 |
| 不合併 | `leaf-test`、`jennifer-test`、`ning-test`、`NienTL-test`、`NienTL-patch-1`／`-1-1`／`-2`（PR #1 已關閉） | 9 月的測試分支 | 刪除；#1 維持關閉 | 只用於練習 PR |
| 待決定 | `Group-14-demo` | 比 main 多 3 個 commit（`README_DEMO.md` 與 CORS，其中 CORS 已由 #40 合進 main），與 main 差距 259 個檔案 | 由 @chenni416 決定：Week 12 之後不再使用就刪除；仍要保留展示版就改名並在 README 註明 | 避免 demo 分支與 main 長期分叉 |
| 另有 | `test/malicious-minutes` | 內容已由 #33 合進 main | 刪除 | — |

（以上分支狀態用 `git rev-list` 與 `git diff` 檢查，不是只靠名稱。合併日開始前請在 `main` 重跑一次，因為這兩天仍有人在推送。）

**2. 合併順序與原因**
目前沒有 open 的 PR，所以合併日的重點是**新工作**如何進 main，而不是舊分支。規則：
1. **每個 PR 的 base 都是 `main`，不再疊在別的 PR 上。** 原因：#36～#39 疊 PR 後只合進父分支，要靠 #41 補救（Decision 022）。如果真的要疊，後一個 PR 必須等前一個合進 main 後再改 base。
2. **先合基礎、後合依賴它的**：資料庫遷移（Alembic）→ 後端端點 → 前端。同時改動 `backend/alembic/versions/` 的 PR 要先合，並確認遷移鏈只有單一 head（`alembic heads`）。
3. **先合小的、再合大的**：小 PR 的衝突較容易判斷。
4. 每合併一個 PR，在 main 上跑一次 CI，再合下一個。

**3. 預期衝突**
- `backend/app/main.py`（`create_app()`）：#34、#40 都動過；之後有人加 middleware 或 CORS 要注意。
- `backend/alembic/versions/`：多人同時新增遷移會出現兩個 head。處置：後合的人 rebase 並改 `down_revision`。
- `docs/api-status.md`：由 `scripts/route_status.py` 自動產生，且有測試比對。路由有改動的 PR 一旦衝突，**不要手動合併**，重新執行 `cd backend && uv run python scripts/route_status.py`。
- `backend/uv.lock`、`frontend/package-lock.json`：重新產生，不手動解。
- `README.md`、`docs/*.md`：多人修改，逐段比對。
- `DECISIONS.md`：每個 PR 都可能加條目，衝突時兩邊都保留。

**4. 「完成」的定義（合併日當天必須全部成立）**
- [ ] `main` 的 CI（`ci.yml`、`env-smoke.yml`）全部 success
- [ ] 一個**沒參與設定的人**在乾淨資料夾 clone，只照 README（`./setup.sh` → `./dev.sh full`）跑起來（issue #20）
- [ ] 兩個人同時登入，在同一個專案走完主要任務：建立專案 → 邀請成員 → 建 Sprint → 分析會議紀錄 → 規劃 → 核准派工 → 接受 → 送審 → 審查 → 結束 Sprint
- [ ] 後端 `pytest`、`ruff check`、`ruff format --check` 與前端 `npm run lint`、`npm run build` 通過
- [ ] 沒有 open 的 PR 疊在別的 PR 上；已處置的分支都已刪除或註明保留原因
- [ ] 四位成員在 PR 都有被記錄的 review，且每位都完成 CP2 的個人門檻（2 個含實質程式碼的已合併 PR、2 次附實質留言的 approval、當過一次 steward）
- [ ] 全組在本條目「合併日紀錄」填寫

**5. 合併日紀錄（當天填，以下全是**待填**，不要預先寫）**
- 日期與時間：
- 參與者（需四人）：
- 實際合併順序與結果：
- 實際遇到的衝突與處理方式：
- 與計畫不同的地方：
- 我們學到什麼：

**6. 已知缺口（誠實列出，尚未完成）**
- issue #20（新電腦照 README 架設）與 #21（線上版本）仍是 open，預計 12/1，負責人分別為胡甄倪、葉沛鑫。#21 完成前，組外使用者測試只能請對方在本機安裝或由我們陪同操作。
- 組外使用者測試尚未進行。
- 已知未實作：逐條驗收紀錄、Sprint 結束自動建立回顧、送審時建立 PR、知識庫檔案上傳與 RAG。
- 9 個無需登入的端點（含會呼叫 OpenAI 的 `planning.generateTasks`、`acceptance.check`）未修，見 `docs/api-status.md`。
- Led by: <!-- 請填：誰負責合併日 -->
