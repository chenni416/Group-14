import type { Services } from './contracts';
import { httpServices } from './http';
import { mockServices } from './mock';

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

/**
 * 混合模式（展示用）：VITE_USE_MOCK=true 且 VITE_AI_BACKEND=true 時，
 * 畫面與資料沿用前端的模擬資料，只有 Planning Studio 的三個 AI 呼叫改打真實後端（會呼叫 OpenAI，並寫入後端的 AI 呼叫紀錄）：
 *   - planning.generateDraft      AI 分析會議紀錄，切出 Story
 *   - planning.askStoryAssistant  與 AI 對話微調 Story
 *   - planning.generateTasks      依 Story 拆解 Task 並建議負責人
 * 這三個呼叫的結果只放在前端的規劃草稿（不依賴後端的 Sprint 或任務資料），所以可以和模擬資料並存。
 * 其他需要後端狀態的 AI 呼叫（sprints.analyze、planning.decompose 等）仍用模擬資料，
 * 因為後端還沒有真實的 Sprint 與任務列表，混用會造成前後端資料不一致。
 */
const AI_BACKEND = USE_MOCK && import.meta.env.VITE_AI_BACKEND === 'true';

const withRealAi = (base: Services): Services => ({
  ...base,
  planning: {
    ...base.planning,
    generateDraft: httpServices.planning.generateDraft,
    askStoryAssistant: httpServices.planning.askStoryAssistant,
    generateTasks: httpServices.planning.generateTasks,
  },
});

if (AI_BACKEND) {
  console.info('[Taskline] 混合模式：Planning Studio 的 AI 呼叫會送到後端', import.meta.env.VITE_API_URL ?? '/api');
}

export const api: Services = AI_BACKEND ? withRealAi(mockServices) : USE_MOCK ? mockServices : httpServices;

export type * from './contracts';
