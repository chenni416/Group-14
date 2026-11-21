# Prompt 比對：組員版（feat/backend-ai-openai） vs ning v0.1 → 合併為 v0.2

v0.2 以組員版為基礎：**沿用組員的檔案結構、輸出 schema（`schemas.py`）、標籤名稱與程式端過濾**，只改寫 prompt 內容。
所有 prompt 與說明文件都集中在這個資料夾。
第 4 節列出的程式問題中，P1-1、P1-2、P1-4、P2-1、P2-2 已經修改（程式中以 `[v0.2 修改]` 標註），完整清單見第 6 節；其餘仍是建議，由負責 API 的組員決定。

---

## 1. 整體設計比對

| 面向 | 組員版 | ning v0.1 | v0.2 採用 | 理由 |
|---|---|---|---|---|
| 模型與 API | OpenAI `gpt-4.1`，structured output（pydantic） | Anthropic，tool use 強制輸出 JSON Schema | **組員版** | 程式已完成並有測試；兩種做法效果相同 |
| 功能切分 | 12 個小功能，各一個 prompt | 5 次呼叫（1、2、3A、3B、4） | **組員版** | 粒度更細，每個 prompt 任務單純；我的 4 個 agent 對應到其中 9 個檔案 |
| id 與編號 | 模型不產生 id，程式依順序配發 | 模型產生 `st-1`、`tk-4` 等暫時 key | **組員版** | 模型無法編造 id，比要求模型遵守規則可靠 |
| 會議紀錄引用 | 模型只給行號，原文由程式補上 | 模型逐字抄寫原文，後端比對 | **組員版** | 不會出現改寫過的引用 |
| 相依循環 | 程式移除造成循環的那一條 | 驗證失敗後要求模型重試 | **組員版** | 少一次呼叫，結果一定無循環 |
| 指派負載 | 模型讀取 capacity 與已分配點數，自己加總 | 後端先用公式算好候選與負載，AI 只判斷與說明 | **組員版＋補強** | prompt 加入逐張累計的分配步驟；建議程式端驗算（P1-2） |
| 重新指派 `fits` | 程式重算 | （無此功能） | **組員版** | |
| Prompt 詳細度 | 每檔 5–15 行原則 | 每個 agent 完整規則、欄位寫法、範例 | **合併** | 組員版的骨架＋我的規則與範例 |
| 輸入格式說明 | prompt 沒有說明標籤內每行的格式 | 有，但標籤名稱與程式不同 | **合併** | 改用組員的標籤名稱，在每個 prompt 開頭說明格式 |
| 共用規則 | `_safety.md`：3 條 | 共用 System Prompt：定位、界線、7 條內容規則 | **合併** | `_safety.md` 擴充為 6 部分，仍自動附加 |
| warnings 欄位 | 無 | 每個輸出都有 | **不加** | 不改 schema；需要提醒的內容寫進 rationale／reason |
| 驗證失敗重試 | 無（只有 SDK 網路重試），改用程式過濾 | 驗證失敗帶錯誤訊息重試一次 | **組員版** | 過濾已足夠；建議記錄被過濾的數量（P1-3） |
| 文件 | `prompts/README.md`（撰寫指南，commit 926d227 改寫） | `CLAUDE.md`＋各 agent 文件卡 | **合併** | 保留組員的 README，只標註 v0.2 變更；在 `prompts/` 新增 `CLAUDE.md` 放文件卡與版本紀錄 |

---

## 2. 逐一比對與 v0.2 修改內容

### Agent 1：Story 切分（`analyze_minutes.md`、`story_assistant.md`）

| 項目 | 組員版 | ning v0.1 | v0.2 |
|---|---|---|---|
| 輸入說明 | 無 | 有 | 說明行號格式與「已釐清事項」區段 |
| `[延續] / [延後] / [跨 Sprint]` 標記 | 未處理 | 有規則 | 加入；`[延續]` 不建 Story、需要等它時寫在 rationale |
| 切分原則 | 一個可獨立驗收的情境 | 另加「不依技術層切分」、2–6 個、合併與分開的判斷 | 合併 |
| 點數 | 費氏 1–13 | 1–21 | **沿用組員 1–13**，加上估點基準 |
| scope | 每項一句 | 2–5 項、名詞片語、必須有來源 | 合併 |
| clarify | question／suggestion、`{answer}` | 另有：什麼值得問、不要問、數量上限、優先順序、effect 必須可驗證 | 合併；每個 Story 最多 3 項 |
| 涵蓋檢查 | 無 | 每一行需求都要有歸屬 | 加入「輸出前自我檢查」 |
| 範例 | 無 | 有 | 加入一個 Story 的範例 |
| story_assistant | 5 句內、不能改草稿 | （無此功能） | 加入拆分／合併／延後的判斷依據與操作位置 |

### Agent 2：待釐清分析（`clarify_questions.md`、`task_dependencies.md`）

| 項目 | 組員版 | ning v0.1 | v0.2 |
|---|---|---|---|
| 問題數量 | 最多 5 題 | 每 Story 3、每 Task 2、總共 12 | **沿用組員 5 題**（Sprint 層級） |
| 問題用途 | 未說明 | — | 說明答案會以「問題 → 答案」附在會議紀錄後，所以問題要能單獨閱讀 |
| 值得問／不要問 | 簡短 | 5 類＋不要問清單 | 合併，並加入好壞範例 |
| 重新分析時保留答案 | 程式以問句比對 | — | prompt 要求同一缺口用相同問句 |
| 相依判斷 | prev／same 與 risk 定義 | 6 種常見硬相依清單 | 合併；加入「不重複已列依賴」「每張最多 3 個、不列遞移相依」 |

### Agent 3：Task 拆解與派送（`generate_tasks.md`、`assign.md`、`reassign.md`、`defer_tasks.md`）

| 項目 | 組員版 | ning v0.1 | v0.2 |
|---|---|---|---|
| Task 點數 | 1、2、3、5（超過 5 再拆） | 1、2、3、5、8 | **沿用組員**；前端選項含 8，見第 3 節 |
| 單一領域 | 未提 | 一張 Task 只屬一個領域 | 加入 |
| task_no 的意思 | 只在 schema 註解 | — | 在 prompt 中說明「依輸出順序編號」並舉例，避免相依指錯 |
| 驗收條件 | 2–4 條、可驗證 | 另有好壞範例、要寫進已釐清的決定 | 合併 |
| reviewer_mode | pool／leader 簡述 | pool／leader／member 詳細規則 | 依組員 schema 只有 pool／leader，補上 leader 的具體條件 |
| 指派步驟 | 依領域與技能、不超過 capacity | 後端算好，AI 只調整 | 加入 6 步分配流程（大點數先、逐張累計、平衡、相依鏈分散、超量處理） |
| 指派理由 | 一句話說依據 | 只引用技能、領域、負載 | 加入範例；不寫累計數字（避免算錯）；公平規則 |
| 重新指派 | 參考協商理由與建議人選 | — | 加入選擇順序、協商項目為點數／範圍時的提醒 |
| 延後 | 剛好夠用、不延後被依賴的 | — | 加入判斷「可獨立延後」的方法與取捨順序 |

### Agent 4：任務小助理（`context_chat.md`）

| 項目 | 組員版 | ning v0.1 | v0.2 |
|---|---|---|---|
| 回答依據 | 只依任務規格與文件 | 同左，並禁止編造路徑、標示推測 | 合併 |
| 範圍變更 | 未處理 | 不能替 Leader 同意，建議發起協商 | 加入（schema 沒有 `needsLeader`，改在 answer 說明，prompt_addition 為 null） |
| prompt_addition | 有決定時寫一句祈使句 | 只收已確認的事實、60 字、不重複 | 合併 |
| 安全 | 共用規則 | 不輸出 secret、注入防護 | 由 `_safety.md` 與本檔共同處理 |
| 回答格式 | 精簡、先結論 | 250 字、最多 5 點、程式碼 10 行 | 合併 |

---

## 3. 需要團隊決定的事

| # | 事項 | 現況 | 建議 |
|---|---|---|---|
| D1 | Task 最大點數 | **已決定：8**。prompt、程式（`TASK_POINT_OPTIONS`）、前端選項統一為 1、2、3、5、8 | — |
| D2 | 審查方式「指定成員」 | 前端 `ReviewerAssignment` 支援 member，`LlmTask.reviewer_mode` 只有 pool／leader | 由 Leader 在前端手動指定即可；若要 AI 建議，見 P2-4 |
| D3 | 模型 | `gpt-4.1`；`client.py`（Anthropic）保留備用 | prompt 與模型無關，兩者都能用 |

---

## 4. 建議修改程式（需與負責 API 的組員討論）

prompt 已經寫成「有這些資料時會使用」，程式補上後效果會更好。

### P1：可靠性（改動小，建議優先）

1. **✅ 已修改｜設定 temperature**：`OpenAILlm.generate_json` 與 `generate_text` 加上 `temperature` 參數（規劃類 0.2、對話類 0.4）。目前使用預設值 1，同樣的會議紀錄每次切分結果差異較大。
2. **✅ 已修改｜指派時帶入既有負載並驗算**：`task_planning.generate_tasks` 呼叫 `suggest_assignments(drafts, members, llm)` 時沒有傳 `loads`，上一輪帶入任務與 Leader 保留的任務點數沒有算進「已分配」。建議傳入 `store.planned_load(...)`；並在 `suggest_assignments` 回傳後依序累計，超過 capacity 的在理由後附上「指派後超出 capacity」。
3. **記錄被過濾的項目**：各服務在丟掉不存在的行號、id、循環相依時，用 `log.info` 記下數量與功能名稱，作為 prompt 測試的依據（CLAUDE.md 第 5 節）。
4. **✅ 已修改｜指派時帶入相依**：`assignment._draft_text` 加上 `｜依賴：{ids}`，`assign.md` 的第 5 步才會生效。

### P2：補足功能

1. **✅ 已修改｜拆 Task 時帶入已釐清的答案**：`task_planning._stories_text` 只輸出標題、使用情境與範疇。規劃工作室中 Leader 對每個 Story 的 clarify 回答（`StoryClarifyItem.answer`／`decision`）沒有傳給模型。已新增 `task_planning._clarify_lines`，在每個 Story 下輸出「已釐清」與「採用建議」兩種行（詳見第 6.2 節）。
   `generate_tasks.md` 已要求「Story 中明確的決定要寫進驗收條件」。
2. **✅ 已修改｜Story 助理拿得到 Story**：`api/routes/planning.py` 呼叫 `story_assistant_reply(..., stories=[])`，模型看不到目前的 Story。建議由前端在 `StoryAssistantBody` 帶上草稿，或從暫存的草稿讀取。
3. **小助理帶入 Living Prompt 與會議來源**：`chat_ai.ask` 加入 `block("living_prompt", 目前版本)`，讓模型判斷 prompt_addition 是否重複；並把任務所屬 Story 的 `sources`（會議紀錄原文行）加進 `project_docs`，名稱用「會議紀錄 L9」，小助理就能回答「當初會議怎麼說」。
4. **（選用）schema 擴充**：
   | 類別 | 新欄位 | 用途 |
   |---|---|---|
   | `LlmChat` | `needs_leader: bool`、`leader_note: str \| None` | 範圍變更時前端顯示「發起協商」按鈕 |
   | `LlmTask` | `reviewer_mode` 加入 `"member"` 與 `reviewer_hint: str` | AI 建議指定審查人（例如設計師審畫面） |
   | `LlmStory` | `depends_on_prev: list[{task_id, reason}]`，並在 user message 加 `<carried_tasks>` | Story 直接標出對上輪任務的相依 |
   | `LlmQuestion` | `effect: str` | 回答直接變成驗收條件，而不只是附在會議紀錄後 |

### P3：之後再做

- 會議紀錄切分加上 `unmapped_lines`（沒有歸屬的行與原因），讓 Leader 檢查有沒有漏掉需求。
- ✅ 已建立 prompt 測試集 `backend/tests/prompt_eval/`（16 個案例）；需要 API 的部分不放進 CI，靜態檢查放進 CI。有 API 金鑰後執行並在 `EVAL_LOG.md` 記錄修正循環。

---

## 5. 檔案清單（v0.2）

| 檔案 | 狀態 |
|---|---|
| `backend/app/ai/prompts/CLAUDE.md` | 新增 |
| `backend/app/ai/prompts/COMPARISON.md` | 新增（本檔） |
| `backend/app/ai/prompts/README.md` | 以組員 926d227 的版本為準，加上 `[v0.2 修改]` 標註（輸入格式、點數、負載、Story 助理） |
| `backend/app/ai/prompts/_safety.md` | 改寫 |
| `analyze_minutes.md`、`clarify_questions.md`、`story_assistant.md`、`generate_tasks.md`、`task_dependencies.md`、`assign.md`、`reassign.md`、`defer_tasks.md`、`context_chat.md` | 改寫 |
| `execution_plan.md`、`acceptance_check.md`、`__init__.py` | 未變更 |

---

## 6. 程式修改紀錄（v0.2）

所有修改處在程式中都以 `[v0.2 修改]` 標註，可用 `grep -rn "v0.2 修改" backend frontend/src` 找到。

### 6.1 指派沒有計入既有負載

**問題**：拆完 Task 做指派建議時，`suggest_assignments` 沒有收到 `loads`，模型看到每個人「已分配 0 點」；上一輪帶入任務、Leader 保留的任務都沒算。`MemoryStore.planned_load` 本身也沒有計入上一輪帶入的任務（前端的 `planLoad` 有）。重新平衡與延後建議也有同樣問題。

| 檔案 | 修改 |
|---|---|
| `app/repo/memory.py` | 新增 `carry_load`（與前端 `carryLoad` 相同規則：上一輪未完成且 `carry=True`，負責人用 `carry_assignee_id`，點數用 `carry_points`）；`planned_load` 加上帶入點數；新增 `committed_load`（帶入＋本輪非草稿任務） |
| `app/services/planning_flow.py` | `decompose`：負載＝帶入＋保留的任務；`rebalance`：傳入 `committed_load`；`defer_suggested`：總點數加上 `committed_load` |
| `app/api/routes/planning.py` | `generate_tasks` 路由帶入 `store.committed_load(sprint_id)` |
| `app/services/task_planning.py` | `generate_tasks` 新增 `loads` 參數並傳給指派；`rebalance` 新增 `base_loads`；`defer_suggested` 新增 `committed` 並寫進 `<capacity>` |
| `app/services/assignment.py` | 新增 `_flag_overload`：依 AI 結果重新累計，超量的在理由後註明「指派後共 x/y 點，超出 capacity」；`_draft_text` 加上依賴（以任務編號表示） |

### 6.2 釐清回答沒有傳給拆 Task

**問題**：`_stories_text` 只輸出標題、使用情境與範疇。規劃工作室中 Leader 對每個 Story 的回答（`clarify[].answer`、`decision`），以及「拆解」流程中 Sprint 層級問題的回答，都沒有傳給 `generate_tasks`。

| 檔案 | 修改 |
|---|---|
| `app/services/task_planning.py` | 新增 `_clarify_lines`：已回答的提問輸出「已釐清：問題 → 答案（驗收條件：effect 代入答案）」，採用的建議輸出「採用建議：…」；不採用與未回答的不輸出。`generate_tasks` 新增 `sprint_answers`，以 `<clarifications>` 區塊送出 |
| `app/services/planning_flow.py` | `decompose` 把 `sprint.questions` 的回答傳給 `generate_tasks` |
| `prompts/generate_tasks.md` | 說明這兩種輸入，並要求「已釐清」的驗收條件句原樣寫進 Task；驗收條件上限改為 5 條 |

### 6.3 Story 助理看不到 Story

**原因**：Story 草稿只存在前端（`usePlanningStore` 的 `draft`），沒有寫進後端資料層；而 `/planning/drafts/chat` 的請求只帶 `question` 與 `storyTitle`，所以路由只能傳入空陣列。

| 檔案 | 修改 |
|---|---|
| `app/schemas/planning.py` | `StoryAssistantBody` 新增選填 `stories: list[StoryDraft] \| None`（舊版前端不帶也不會壞） |
| `app/api/routes/planning.py` | 改用 `body.stories` |
| `app/services/task_planning.py` | `story_assistant_reply` 不送已延後的 Story |
| `frontend/src/services/contracts.ts`、`services/http/index.ts` | `askStoryAssistant` 新增第三個參數 `stories` 並送出 |
| `frontend/src/features/planning/components/StoryInsightPanel.tsx` | 呼叫時帶上 `draft.stories` |

### 6.4 temperature

**作用**：模型每次產生下一個字時，會從候選字的機率分布中抽樣。temperature 控制抽樣的「隨機程度」：0 幾乎總是選機率最高的字，結果最穩定；1（API 預設）保留原本的機率分布，同樣的輸入每次可能切出不同的 Story、給不同點數；更高則更發散。切 Story、拆 Task、指派這類需要一致、可重現的工作適合低溫；開放式對話可以稍高，回答較自然。

| 檔案 | 修改 |
|---|---|
| `app/core/config.py`、`.env.example` | 新增 `OPENAI_TEMPERATURE`（預設 0.2）、`OPENAI_TEXT_TEMPERATURE`（預設 0.5）；留空代表不傳 |
| `app/ai/llm.py` | `OpenAILlm` 在 `parse`（結構化輸出）與 `create`（純文字）分別帶入 |

說明：
- 結構化輸出（包含小助理 `context_chat`）都用 0.2：小助理需要依文件回答，低溫較不容易編造。
- 不設成 0：完全貪婪的輸出偶爾會重複或卡在同一種寫法，0.2 保留少量彈性。
- 推理類模型（如 o 系列）不接受 temperature，換模型時把兩個值留空即可。
- 低溫只能降低差異、不能保證每次相同；要比較 prompt 版本時，同一個測試案例跑 3 次看是否穩定。

### 6.5 Task 最大點數 8

| 檔案 | 修改 |
|---|---|
| `app/services/task_planning.py` | 新增 `TASK_POINT_OPTIONS = (1, 2, 3, 5, 8)` 與 `_snap_points`：模型給的點數向上調整到最近的允許值，最大 8（原本夾在 1–13，可能出現前端選不到的 4、13） |
| `prompts/generate_tasks.md`、`analyze_minutes.md` | 點數改為 1、2、3、5、8；8 點只用於無法再拆的情況，並需在 analysis 說明 |
| `tests/test_ai_services.py` | 原本斷言 99 點夾成 13，改為 8 |

### 6.6 測試

新增 `tests/test_v02_changes.py`（15 個測試）：帶入負載計算、草稿不計入、指派時送出既有負載與超量註明、指派訊息含依賴、延後計入既有點數、釐清回答的輸出格式、Story 助理收到 Story、點數調整、temperature 有送出與留空不送。
後端 `ruff check`、`ruff format --check`、`pytest`（56 個）全部通過；前端 `npm run lint`、`npm run build` 通過。
