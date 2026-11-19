import { Quote, Send, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge, Card, Callout, SegmentedControl } from '@/components/ui';
import { cn } from '@/lib/cn';
import { pendingClarify } from '@/lib/planning';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import type { StoryDraft } from '@/types';
import { usePlanningStore } from '../store';
import { StoryClarifyList } from './StoryClarifyList';

const QUICK = ['這個 Story 太大，幫我拆成兩個', 'Webhook 移到下個 Sprint', '點數是怎麼估的？'];

type Tab = 'clarify' | 'rationale';

/** 階段 3 右側：AI 分析（待釐清的提問與建議、拆解依據與會議紀錄溯源）與微調對話 */
export function StoryInsightPanel({ story, className }: { story: StoryDraft | undefined; className?: string }) {
  const { storyChat, pushChat, updateStory } = usePlanningStore();
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [tab, setTab] = useState<Tab>('clarify');
  const scrollRef = useRef<HTMLDivElement>(null);
  const unresolved = story ? pendingClarify(story) : 0;

  // 切換 Story 時回到頂端；還有待釐清項目時預設打開「待釐清」，否則顯示拆解依據
  const chatCount = useRef(storyChat.length);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setTab(story && pendingClarify(story) > 0 ? 'clarify' : 'rationale');
    // 只在切換 Story 時決定預設分頁，回答過程中不自動切換
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);
  useEffect(() => {
    if (storyChat.length === chatCount.current && !pending) return;
    chatCount.current = storyChat.length;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [storyChat.length, pending]);

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || pending) return;
    setInput('');
    pushChat({ role: 'user', text: question });
    setPending(true);
    try {
      pushChat({ role: 'assistant', text: await api.planning.askStoryAssistant(question, story?.title ?? null) });
    } catch (e) {
      toast(e instanceof Error ? e.message : '傳送失敗');
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className={cn('flex flex-col p-5 lg:h-full lg:min-h-0 lg:overflow-hidden', className)}>
      <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">AI 分析</h2>
          <p className="text-xs text-gray-500">回答 AI 的提問、確認建議，並對照會議紀錄微調切分</p>
        </div>
        <Badge tone="violet">
          <Sparkles className="h-3 w-3" strokeWidth={2} />
          AI
        </Badge>
      </div>

      {story && (
        <SegmentedControl<Tab>
          size="sm"
          aria-label="AI 分析內容"
          className="mb-4 shrink-0"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'clarify', label: unresolved ? `待釐清 ${unresolved}` : '待釐清' },
            { value: 'rationale', label: '拆解依據' },
          ]}
        />
      )}

      <div ref={scrollRef} className="scrollbar-thin -mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1" aria-label="AI 分析與對話紀錄">
        {story && tab === 'clarify' ? (
          <section>
            <div className="mb-2 text-xs font-medium text-gray-500">
              {story.code} · {story.title}
            </div>
            <StoryClarifyList story={story} onChange={(clarify) => updateStory(story.id, { clarify })} />
          </section>
        ) : story ? (
          <section>
            <div className="mb-2 text-xs font-medium text-gray-500">
              {story.code} · {story.title}
            </div>
            <Callout tone="ai">{story.rationale}</Callout>
            {story.sources.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <Quote className="h-3.5 w-3.5" strokeWidth={1.75} />
                  會議紀錄溯源
                </div>
                {story.sources.map((s) => (
                  <blockquote key={s.line} className="flex gap-3 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    <span className="shrink-0 font-mono text-xs leading-5 text-gray-400">L{s.line}</span>
                    {s.text}
                  </blockquote>
                ))}
              </div>
            )}
          </section>
        ) : (
          <p className="text-sm text-gray-500">點選左側 Story 查看拆解依據。</p>
        )}

        <section className={cn('space-y-2 border-t border-gray-100 pt-4', !storyChat.length && !pending && 'hidden')}>
          {storyChat.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-neutral-900 px-4 py-2.5 text-sm text-white">
                {m.text}
              </div>
            ) : (
              <div key={m.id} className="max-w-[92%] rounded-2xl rounded-bl-md border border-violet-100 bg-violet-50/50 px-4 py-2.5 text-sm text-gray-700">
                {m.text}
              </div>
            ),
          )}
          {pending && <div className="w-fit rounded-2xl bg-gray-50 px-4 py-2.5 text-sm text-gray-500">AI 正在思考</div>}
        </section>
      </div>

      <div className="mt-3 flex shrink-0 gap-1.5 overflow-x-auto pb-1">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            disabled={pending}
            onClick={() => send(q)}
            className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors duration-150 hover:bg-gray-50 disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>
      <form
        className="mt-2 flex shrink-0 items-center gap-2 rounded-full border border-gray-200 py-1 pl-4 pr-1 focus-within:border-gray-900"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="告訴 AI 要怎麼調整 Story 切分"
          aria-label="調整 Story 切分"
          className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-gray-400 focus:outline-none"
        />
        <button
          type="submit"
          aria-label="送出"
          disabled={!input.trim() || pending}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-white transition-colors duration-150 hover:bg-neutral-700 disabled:bg-gray-200"
        >
          <Send className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </form>
    </Card>
  );
}
