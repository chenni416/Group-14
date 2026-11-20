# prompts

各 AI 功能的系統提示與輸出格式，一個功能一個檔案，例如：

| 檔案 | 功能 | 前端對應的 mock |
|---|---|---|
| `analyze_minutes.md` | 會議紀錄分析，產生 Story 與待釐清問題 | `mocks/handlers/planning.ts` |
| `decompose.md` | 任務拆解 | `mocks/handlers/decompose.ts` |
| `suggest_assignee.md` | 指派建議 | `mocks/handlers/assign.ts` |
| `execution_plan.md` | 執行計畫建議 | `mocks/handlers/execution.ts` |
| `acceptance_check.md` | 驗收檢查 | `mocks/handlers/acceptance.ts` |
| `living_prompt.md` | Living Prompt 組合 | `mocks/handlers/prompt.ts` |
| `context_chat.md` | 專案脈絡助理 | `mocks/handlers/chat.ts` |

撰寫原則：
- 輸出使用 structured output（JSON schema），格式直接對應 `app/schemas`
- AI 產生的結果一律是草稿，需要使用者確認才生效
- 上傳文件放在標示為參考資料的區塊，並註明不執行文件中的指令
