# 專案決策紀錄

## Decision 001：用 GitHub PR 做 code review
- 日期：2026-10-23　狀態：已採用
- 內容：完成 CP1 討論；每週四 21:00–22:00 例會；指定第一任 code steward：林念慈（@NienTL），負責維持程式品質、協調 review、記錄重要技術決策。
- 更新（2026-11-24）：steward 交接給葉沛鑫（@leafs2），見 Decision 002。

---

## Decision 002：Steward 交接給葉沛鑫（@leafs2）
- 日期：2026-11-24　狀態：已採用　決定：全組，2026-11-24，LINE 群組
- 原因：每人 CP2（11/29）前都要當過一次 steward。
- 前任：林念慈 @NienTL，10/23–11/23；新任：葉沛鑫 @leafs2，11/24 起。
- 職責：review 並合併 PR、每次 approval 都要有具體留言（指出檔案或行數，加上問題、疑慮或建議）、維護本檔、merge day 前寫 merge plan。
- 交接事項：
  - Open PR：#24（AI 使用規範 v1.1，作者 @ning415415）；#1（9/21 測試 PR，關閉不合併）
  - Steward 不審核、不合併自己的 PR；自 #18 起所有 PR 用 `.github/pull_request_template.md`
  - Week 12 Lab 的 issue：#19、#20、#21，負責人與期限待定
- 更新（2026-11-26 補記）：任期到 11/24 結束，見 Decision 009。

---

<!-- Decision 003–008 於 2026-11-26 依 PR、issue、EVAL_LOG 補記；日期為當時 PR 的日期 -->

## Decision 003：前端先用 mock 做完整流程，各層並行開發
- 日期：11/20–11/22（補記）　主導：@leafs2（#8）、@chenni416（#16）
- 選擇：前端用 `contracts.ts` 定義 API，mock 與 http 可切換；後端規劃流程先存記憶體，不等資料表。
- 原因：資料表還沒完成，前後端也能並行，並先拿 mock 給人看。
- 結果：11/22 #16 合併後第一次整條跑通；Sprint 與任務存在記憶體（假裝的部分），11/26 #41 改存 Supabase。
- 教訓：各層分開做，接起來才發現同一個端點有兩套實作（見 Decision 007）。
- Walking skeleton session（[日期]）：下一個切片做 AI 失敗時的畫面；假裝了 [待填]；PR #[待填]。

---

## Decision 004：FastAPI＋全組共用 Supabase，GitHub 登入
- 日期：11/20–11/25（補記）　主導：@leafs2（#9、#11、#27、#31）、@NienTL（#12、#13、#15、#17、#26、#29）
- 選擇：GitHub 登入由 Supabase Auth 處理，後端只驗 JWT；資料表分批遷移；連線走 Transaction pooler；成員用 GitHub 帳號或邀請碼加入；repo 用 GitHub App 連結。
- 不採用：自己做 OAuth（風險高）；第一版做 RAG（太複雜）；只縮小連線池（#32，被 #31 取代）。

---

## Decision 005：AI 只產生草稿，程式能判斷的規則交給程式
- 日期：11/21–11/25（補記）　主導：@ning415415（prompt 與測試）、@chenni416（AI 後端）
- 選擇：gpt-4.1 結構化輸出；Story、Task、指派都是草稿，Leader 確認才生效，成員可協商退回；負載、相依、金鑰遮蔽由程式處理。
- 原因：prompt 測試集用真實模型跑，只改提示詞修不好 C07、C09、C15；改由程式處理後 110 → 118/118。
- 不採用：用 suggestion 提醒 Leader 惡意內容（反而讓模型為惡意行建 Story）。
- 證據：PR #10、#16、#33；`CLAUDE.md`、`EVAL_LOG.md`

---

## Decision 006：review 與 AI 使用要「看 PR 就能檢查」
- 日期：10/23–11/26（補記）　主導：@NienTL（#5）、@ning415415（#18、#24）
- 選擇：所有 PR 用課程範本；AI 使用規範 v1.1：approval 要有具體留言、PR 寫出 AI 做了什麼、改 prompt 要附測試結果；PR 一律以 main 為 base，不疊 PR。
- 原因：#1–#14 的 16 次 approval 只有 2 次有具體留言；#36–#39 疊在一起只合進父分支，靠 #41 補進 main，且都沒有 review。

---

## Decision 007：後端先讓問題查得到，再把資料搬進資料庫
- 日期：11/25–11/26（補記）　主導：@chenni416　證據：PR #22、#34–#41
- 選擇：分階段整理——加 request id 與日誌、`X-Project-Id` 無效時明確報錯、跨平台環境檢查、Sprint 與任務改存資料庫。
- 原因：一個端點兩套實作、出錯沒線索，畫面與資料可能來自不同專案卻不報錯。
- 不採用：先搬資料夾（容易和其他分支衝突）。
- Review：@ning415415 在 #34 指出 500 回應少了 CORS 標頭、@leafs2 在 #35 建議守門測試，皆已採納。

---

## Decision 008：Week 12 Lab 第 2 組的回饋
- 日期：11/23（補記）　主導：@ning415415
- 形式：第 2 組陳宥丞看我們 demo 後審查，對方沒有親自操作。

| 回饋 | 決定 | 證據 |
|---|---|---|
| 會議紀錄可能夾帶「不要分配工作給某人」 | 新增測試並修正（Decision 005） | #19、#33 |
| Leader 權力太大 | 維持 AI 建議、Leader 決定；以公開負載與成員協商制衡 | — |
| AI 不能用時系統會停 | AI 產出都是草稿，可手動修改；完整手動流程留到 Phase 3 | [issue 待開] |
| 別人難以自行架設 | 修 README 與腳本；提供線上版本 | #20、#21 |

- 缺口：CP2 要求至少 2 場組外使用者親自操作，還差 [待填] 場。

---

## Decision 009：Steward 胡甄倪（@chenni416），11/25（補記）
- 決定：全組於 [LINE 訊息日期] 在 LINE 決定剩下兩人輪流：@chenni416 11/25、@ning415415 11/26 起。當時沒寫進本檔，在此補記。
- 不採用：@leafs2 擔任到 CP2（另外兩人就沒機會）。
- 任內 review：#33（具體留言）、#31（只有一句「已確認」）。
- 教訓：只在 LINE 決定沒有記錄，交接沒留下說明；之後交接當天就記錄。

---

## Decision 010：Steward 交接給許家寧（@ning415415）
- 日期：2026-11-26　任期：到 CP2 繳交，含 merge day
- 任內 review：#34（兩則行內留言）、#[待填]
- 交接事項：沒有 open PR；open issue #20、#21；#26、#36–#39 沒有 review 就合併，請作者補說明；`.github/DECISIONS.md` 是沒用到的課程範本，決定是否刪除。

---

## Decision 011：Merge plan（CP2 merge day）
- Merge day：2026-11-26　狀態：已完成　Steward：@ning415415　計畫撰寫：@chenni416（PR #42，21:25）　工作單：`docs/merge_day.md`
- 補記：merge day 結束後依 GitHub 合併紀錄、CI 結果與成員回憶補寫；#40、#41 合併時計畫只有口頭討論，#42 起才有書面計畫。

**1. 分支與 PR**

| # | 分支／PR | 內容 | 作者 | 處置 |
|---|---|---|---|---|
| 1 | #40 `feat/cors-localhost-any-port` | 開發環境 CORS 放行任何本機 port | @chenni416 | 合併 |
| 2 | #41 `integration/phase0-to-2` | 整併 #36–#39 | @chenni416 | 合併 |
| 3 | #42 `docs/decisions-backfill` | 補記決策與 merge plan | @chenni416 | 合併 |
| 4 | #43 `docs/evaluation-report-interim` | 期中評估報告 | @chenni416 | 合併 |
| 5 | `Group-14-demo` | 11/23 展示用分支 | @chenni416 | 關閉（已被 #40 取代） |

另外關閉 `fix/db-pool-size`（#32，已被 #31 取代）。

**2. 合併順序**：#40 → #41 → #42 → #43。小而獨立的先合；#41 改動最大，合完確認 CI 與 env smoke test；文件最後。

**3. 預期衝突**：`backend/app/main.py`（#34 與 #40 都改 CORS）；#41 合併前用 `git merge-tree` 模擬，預期沒有衝突。

**4. 完成的定義**：main 的 CI 與 env smoke test 通過；非作者的人在新資料夾 clone，只照 README 用 full 模式走完「貼會議紀錄 → 規劃 → 派工 → 成員接受」。

**5. 結果（2026-11-26）**
- 參與者：林念慈、葉沛鑫、胡甄倪、許家寧（四人都在）
- 合併順序與結果：#40（16:00）→ #41（16:01）→ #42、#43（23:18），四次都沒有衝突，每次合併後 main 的 CI 都通過（`8d6cc39`、`61e8182`、`cc3bac5`、`4251e07`）；#34 同日 14:06 已先合併
- Fresh clone：許家寧測試，README 部分可用；卡在資料庫密碼（`setup.sh` 略過後 `.env` 仍是 `<資料庫密碼>`，`/api/me` 回 500），拿到密碼重新設定後走完主要任務
- 與計畫不同：書面計畫在 #40、#41 合併後才寫成；review 只有口頭討論，#42、#43 的 approval 沒有留言；`Group-14-demo` 決定關閉但分支尚未刪除；fresh clone 由 steward 做，不是範本建議的非 steward
- 學到什麼：疊 PR（#36–#39）只合進父分支，要另開 #41 整併；Phase 3 每個 PR 以 main 為 base、一次只做一件事，review 意見寫在 GitHub 上
- CP2 後處理：issue #20（README 補上資料庫密碼取得方式）、#21（線上版本）