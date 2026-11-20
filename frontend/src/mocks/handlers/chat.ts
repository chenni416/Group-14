import { REFERENCE_PATHS } from '../data/knowledge';
import type { TaskRecord } from '../db';

interface Reply {
  answer: string;
  addition: string;
  sources: string[];
}

const strip = (q: string) => q.replace(/[？?。]/g, '');

/** 規則式模擬專案脈絡助理的回覆 */
export function aiReply(task: TaskRecord, question: string): Reply {
  const d = task.domain;
  const testTool = d === 'FE' ? 'Vitest' : d === 'QA' ? 'Playwright' : 'pytest';
  const rules: Array<[RegExp, () => Reply]> = [
    [/驗證|簽章|HMAC|安全|auth|JWT|權限|401/i, () => ({
      answer: '依「API 規格 v2」，一般端點使用 JWT；外部 webhook 以 HMAC SHA-256 驗證 X-Hub-Signature-256，失敗時回傳 401 並記錄事件 ID。',
      addition: '驗證失敗一律回傳 401，錯誤格式 {code, message}',
      sources: ['openapi.yaml'],
    })],
    [/測試|test|覆蓋|coverage/i, () => ({
      answer: `README 規定 PR 需通過 lint + unit + e2e。這個任務建議單元測試覆蓋率 > 80%，使用 ${d === 'FE' ? 'Vitest + Testing Library' : testTool}。`,
      addition: `需撰寫對應測試（${testTool}），覆蓋率 > 80%`,
      sources: ['README.md'],
    })],
    [/資料表|schema|資料庫|migration|欄位/i, () => ({
      answer: '依 Coding Standards，資料表變更需使用 Alembic 產生 migration，命名格式為 YYYYMMDD_描述，且必須可 downgrade。',
      addition: '資料表變更需附可 downgrade 的 Alembic migration',
      sources: ['CODING_STANDARDS.md'],
    })],
    [/設計|UI|樣式|Figma|顏色|畫面|間距/i, () => ({
      answer: '請參考 Figma「Taskline UI Kit v2」：卡片圓角 16/24px、主色 #111827；AI 產生內容以淡紫色外框區隔。',
      addition: '樣式依 Figma UI Kit v2，AI 產生內容需以淡紫色外框標示',
      sources: ['Figma · Taskline UI Kit v2'],
    })],
    [/檔案|參考|哪裡|路徑|結構|放在|資料夾/, () => ({
      answer: `相關程式位於 ${REFERENCE_PATHS[d].join('、')}。新增檔案請放在同一層，並依 Coding Standards 命名。`,
      addition: `修改範圍限定於 ${REFERENCE_PATHS[d][0]} 及其測試`,
      sources: ['CODING_STANDARDS.md', '系統架構圖.png'],
    })],
    [/範圍|不用|不需要|scope|先不|之後再/i, () => ({
      answer: '了解，我會把這部分標記為本次範圍外，避免 Agent 多做。',
      addition: `範圍外：${strip(question)}`,
      sources: ['PRD_v2.md'],
    })],
    [/效能|延遲|performance|速度|快取/i, () => ({
      answer: 'PRD §6 的非功能需求：API p90 < 300ms，AI 對話 p90 < 3 秒；必要時以 Redis 快取檢索結果。',
      addition: '效能需求：API p90 < 300ms，AI 回應 p90 < 3 秒',
      sources: ['PRD_v2.md'],
    })],
  ];
  const hit = rules.find(([re]) => re.test(question));
  return hit
    ? hit[1]()
    : {
        answer: 'PRD 與 Sprint 目標中沒有明確規定這點。建議先以最小可行做法實作，並在 PR 描述中註記這個假設，方便 Reviewer 確認。',
        addition: `假設：${strip(question)}（PRD 未定義，需於 PR 註記）`,
        sources: ['PRD_v2.md'],
      };
}
