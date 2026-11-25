# Prompt 測試集（`tests/prompt_eval/`）

用固定的 18 個案例測試 AI 提示詞，比較每次修改前後的結果。提示詞與文件卡在 `app/ai/prompts/`（見該資料夾的 `CLAUDE.md`），測試紀錄寫在本資料夾的 `EVAL_LOG.md`。

## 檔案

| 檔案 | 內容 |
|---|---|
| `cases.py` | 18 個案例：輸入資料、要呼叫的服務函式、自動檢查、人工評分項目 |
| `harness.py` | 記錄模型輸入與原始輸出的 `RecordingLlm`、只組提示詞不呼叫 API 的 `DryRunLlm` |
| `static_checks.py` | 不呼叫 API 的檢查：提示詞有沒有提到所有輸出欄位、有沒有說明每個輸入區塊、有沒有附加共用規則 |
| `run.py` | 執行入口（指令見下方） |
| `EVAL_LOG.md` | 案例總表、每次執行的結果、修正循環（失敗 → 修改 → 重測） |
| `results/` | 每次執行產生的 `summary.md` 與 `raw.jsonl` |

`tests/test_prompt_static.py` 會在 `uv run pytest` 與 CI 中執行靜態檢查，所以改提示詞時漏寫欄位或輸入區塊，CI 會失敗。
`tests/test_prompt_eval_malicious.py` 用假的 LLM 確認 C17、C18 的自動檢查抓得到「照著惡意指示做」的輸出（不需要 API 金鑰）。

## 執行方式（在 `backend/` 資料夾）

```bash
# 1. 不需要 API 金鑰
uv run python -m tests.prompt_eval.run --static      # 靜態檢查
uv run python -m tests.prompt_eval.run --dry-run     # 輸出每個案例的 system / user 到 results/，可貼到網頁版聊天測試

# 2. 需要 backend/.env 的 OPENAI_API_KEY
uv run python -m tests.prompt_eval.run                        # 全部案例各跑 1 次（約 16 次 API 呼叫）
uv run python -m tests.prompt_eval.run --repeat 3 --label v0.2   # 每個案例跑 3 次，檢查穩定度
uv run python -m tests.prompt_eval.run --case C08 --case C09     # 只跑指定案例
```

### 比較舊版提示詞（例如組員的 v0.1）

```bash
mkdir -p /tmp/v01 && git archive 926d227 backend/app/ai/prompts | tar -x -C /tmp/v01
uv run python -m tests.prompt_eval.run --prompts-dir /tmp/v01/backend/app/ai/prompts --label v0.1
uv run python -m tests.prompt_eval.run --label v0.2
```

兩次的 `summary.md` 放在一起比較，就是一次「改前／改後」的紀錄。注意：舊版提示詞搭配的是目前的程式，所以比較的是提示詞本身的差異。

## 評分方式

1. **自動檢查**（`cases.py` 的 `check_*`）：檢查模型原始輸出與程式校正後的結果，例如行號是否存在、點數是否在允許值內、是否洩漏金鑰。`--repeat N` 時，**N 次都通過**才算通過。
2. **人工評分**（`summary.md` 最後的表格）：自動檢查判斷不了的品質，例如「Story 能否獨立驗收」。看 `raw.jsonl` 的輸出後填 0（不符合）、1（部分符合）、2（符合）。
3. **溫度與隨機性**：`OPENAI_TEMPERATURE` 預設 0.2，結果仍可能每次不同。判斷某個提示詞修改有沒有效果時，用 `--repeat 3` 比較通過次數，不要只看一次。

## 案例分布

| 類型 | 案例 |
|---|---|
| typical（一般） | C01、C05、C07、C08、C11、C13、C16 |
| edge（邊界） | C02、C03、C06、C09、C12、C14 |
| adversarial（對抗） | C04（提示詞注入）、C10（依姓名或性別分配）、C15（洩漏金鑰）、C17、C18（針對特定成員的惡意會議紀錄） |

| Agent | 案例 |
|---|---|
| 1 Story 切分 | C01–C04、C16、C17 |
| 2 待釐清分析 | C05–C07 |
| 3 Task 拆解與派送 | C08–C12、C18（從切 Story 一路到指派） |
| 4 任務小助理 | C13–C15 |

## 修改提示詞的流程

1. 跑一次現況（`--label 改前`），在 `EVAL_LOG.md` 記下失敗的案例與檢查項目。
2. 判斷原因：提示詞沒寫清楚、寫了但模型沒遵守、或是案例本身的預期有問題。
3. 修改提示詞，更新 `app/ai/prompts/CLAUDE.md` 的版本紀錄。
4. 用 `--case` 重跑失敗的案例，再跑全部案例確認沒有讓其他案例變差（`--label 改後`）。
5. 在 `EVAL_LOG.md` 的「修正循環」補一列：失敗內容 → 原因 → 修改 → 重測結果。

## 新增案例

1. 在 `cases.py` 寫輸入資料、`run_*`（呼叫服務函式）與 `check_*`（回傳 `Check` 清單），加進 `CASES`。
2. 執行 `--static` 確認提示詞有說明新案例用到的輸入區塊。
3. 在 `EVAL_LOG.md` 的案例總表補一列。

測試資料都是虛構的；不要放真實的會議紀錄、成員個資或金鑰（C15 的金鑰是假的）。
