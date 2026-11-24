import { FileText, Send, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Tag } from '@/components/ui';
import { useDocs } from '@/hooks/queries';
import type { Sprint } from '@/types';
import { useAsk, useChat } from '../hooks/useStudio';

const QUICK_QUESTIONS = ['webhook 簽章要怎麼驗證？', '需要寫哪些測試？', '相關檔案在哪裡？', 'UI 要參考哪份設計？', '先不用做多語系'];

export function ChatPanel({ taskId, sprint }: { taskId: string; sprint: Sprint | undefined }) {
  const { data: messages } = useChat(taskId);
  const { data: docs } = useDocs();
  const ask = useAsk(taskId);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, ask.isPending]);

  const send = (q: string) => {
    const question = q.trim();
    if (!question || ask.isPending) return;
    ask.mutate(question);
    setInput('');
  };

  return (
    <section className="flex h-full flex-col rounded-3xl border border-gray-100 bg-white p-5 shadow-card" aria-label="專案脈絡助理">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">專案脈絡助理</h3>
          <p className="text-xs text-gray-500">Context-Aware Copilot</p>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Tag>任務規格</Tag>
        {sprint && <Tag>{sprint.name} Goal</Tag>}
        {docs?.slice(0, 4).map((d) => <Tag key={d.id}>{d.kind}</Tag>)}
      </div>

      <div ref={scrollRef} className="-mx-1 flex-1 space-y-3 overflow-y-auto px-1 py-2">
        {messages?.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-neutral-900 px-4 py-2.5 text-sm text-white">
              {m.text}
            </div>
          ) : (
            <div key={m.id} className="max-w-[92%] rounded-2xl rounded-bl-md border border-violet-100 bg-violet-50/50 px-4 py-3 text-sm text-gray-700">
              <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                <Sparkles className="h-3 w-3" strokeWidth={2} />
                AI Generated
              </div>
              {m.text}
              {m.promptAddition && (
                <div className="mt-2 rounded-xl bg-white px-3 py-2 text-xs text-gray-600">
                  <span className="font-medium text-gray-900">+ Prompt v{m.promptVersion}：</span>
                  {m.promptAddition}
                </div>
              )}
              {m.sources && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.sources.map((s) => (
                    <Tag key={s}>
                      <FileText className="h-3 w-3" strokeWidth={1.75} />
                      {s}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        {ask.isPending && <div className="w-fit rounded-2xl bg-gray-50 px-4 py-2.5 text-sm text-gray-500">正在查詢專案文件</div>}
      </div>

      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => send(q)}
            disabled={ask.isPending}
            className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors duration-150 hover:bg-gray-50 disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>
      <form
        className="mt-2 flex items-center gap-2 rounded-full border border-gray-200 py-1 pl-4 pr-1 focus-within:border-gray-900"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="直接問專案問題，不用重打背景"
          aria-label="輸入問題"
          className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-gray-400 focus:outline-none"
        />
        <button
          type="submit"
          aria-label="送出"
          disabled={!input.trim() || ask.isPending}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-white transition-colors duration-150 hover:bg-neutral-700 disabled:bg-gray-200"
        >
          <Send className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </form>
    </section>
  );
}
