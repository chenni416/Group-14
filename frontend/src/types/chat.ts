export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: string[];
  /** 這則回覆新增到 Prompt 的內容 */
  promptAddition?: string;
  promptVersion?: number;
}

export interface PromptState {
  /** 每個版本完整的 Prompt 行 */
  versions: string[][];
  /** 目前採用的版本索引 */
  current: number;
}
