import { AtSign, MessageSquare, Send } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Avatar, Button, Card, CardHeader, EmptyState } from '@/components/ui';
import { useCommentActions, useComments } from '@/hooks/useCollab';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/format';
import type { Member, Task } from '@/types';

interface Props {
  task: Task;
  me: Member;
  members: Member[];
  memberMap: Map<string, Member>;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 留言內容：把 @成員 標成可辨識的顏色 */
function CommentText({ text, members, meId }: { text: string; members: Member[]; meId: string }) {
  if (!members.length) return <>{text}</>;
  const re = new RegExp(`(@(?:${members.map((m) => escapeRe(m.name)).join('|')}))`, 'g');
  return (
    <>
      {text.split(re).map((part, i) => {
        const m = members.find((x) => `@${x.name}` === part);
        if (!m) return part;
        return (
          <span key={i} className={cn('rounded px-0.5 font-medium', m.id === meId ? 'bg-sky-50 text-sky-700' : 'text-sky-700')}>
            {part}
          </span>
        );
      })}
    </>
  );
}

/** 任務留言區：單層留言串，輸入 @ 可標注成員，對方會收到通知 */
export function TaskComments({ task, me, members, memberMap }: Props) {
  const { data: comments = [] } = useComments(task.id);
  const { add, markRead } = useCommentActions(task.id);
  const [text, setText] = useState('');
  // 正在輸入的 @ 關鍵字（游標前），null 表示沒有開啟選單
  const [query, setQuery] = useState<{ start: number; term: string } | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // 插入標注後要放回的游標位置，在畫面更新後立即套用，避免與後續輸入衝突
  const caretRef = useRef<number | null>(null);
  const markReadRef = useRef(markRead.mutate);
  markReadRef.current = markRead.mutate;

  // 打開留言區就把自己在這項任務被 @ 的通知標為已讀
  useEffect(() => {
    markReadRef.current();
  }, [task.id, me.id]);

  useLayoutEffect(() => {
    const pos = caretRef.current;
    if (pos == null) return;
    caretRef.current = null;
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(pos, pos);
  }, [text]);

  const others = useMemo(() => members.filter((m) => m.id !== me.id), [members, me.id]);
  const options = query ? others.filter((m) => m.name.includes(query.term) || m.title.toLowerCase().includes(query.term.toLowerCase())) : [];
  const mentioned = others.filter((m) => text.includes(`@${m.name}`));

  const syncQuery = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    // 中文前面不會有空白，只排除英數字緊接 @（像 email）的情況
    const m = before.match(/(?:^|[^A-Za-z0-9_])@([^\s@]*)$/);
    setQuery(m ? { start: caret - m[1]!.length - 1, term: m[1]! } : null);
    setActive(0);
  };

  const pick = (m: Member) => {
    if (!query) return;
    const el = inputRef.current;
    const caret = el?.selectionStart ?? text.length;
    const next = `${text.slice(0, query.start)}@${m.name} ${text.slice(caret)}`;
    const pos = query.start + m.name.length + 2;
    caretRef.current = pos;
    setText(next);
    setQuery(null);
  };

  const insertAt = () => {
    const el = inputRef.current;
    const caret = el?.selectionStart ?? text.length;
    const pad = /[A-Za-z0-9_]/.test(text[caret - 1] ?? '') ? ' ' : '';
    const next = `${text.slice(0, caret)}${pad}@${text.slice(caret)}`;
    const pos = caret + pad.length + 1;
    caretRef.current = pos;
    setText(next);
    setQuery({ start: pos - 1, term: '' });
    setActive(0);
  };

  const submit = () => {
    if (!text.trim() || add.isPending) return;
    add.mutate({ text, mentions: mentioned.map((m) => m.id) }, { onSuccess: () => setText('') });
    setQuery(null);
  };

  return (
    <Card className="p-5">
      <CardHeader title="留言區" description="討論這項任務的問題，輸入 @ 可以標注相關成員，對方會收到通知" className="mb-3" />

      <div className="space-y-4">
        {comments.length ? (
          comments.map((c) => {
            const by = memberMap.get(c.byId);
            return (
              <article key={c.id} className="flex gap-3" aria-label={`${by?.name ?? '成員'} 的留言`}>
                {by && <Avatar member={by} size="sm" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 text-xs">
                    <span className="font-medium text-gray-900">{by?.name ?? '成員'}</span>
                    {c.byId === task.assigneeId && <span className="text-gray-500">負責人</span>}
                    <span className="text-gray-400">{relativeTime(c.at)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">
                    <CommentText text={c.text} members={members} meId={me.id} />
                  </p>
                </div>
              </article>
            );
          })
        ) : (
          <EmptyState icon={MessageSquare} title="還沒有留言" description="對任務有疑問時可以在這裡提出，並 @ 相關成員" />
        )}
      </div>

      <form
        className="relative mt-5 rounded-2xl border border-gray-200 bg-white focus-within:border-gray-900"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={inputRef}
          value={text}
          rows={3}
          aria-label="留言內容"
          placeholder="輸入留言，使用 @ 標注成員（⌘ / Ctrl + Enter 送出）"
          className="block w-full resize-none rounded-2xl bg-transparent px-4 pt-3 text-sm placeholder:text-gray-400 focus:outline-none"
          onChange={(e) => {
            setText(e.target.value);
            syncQuery(e.target.value, e.target.selectionStart);
          }}
          onClick={(e) => syncQuery(e.currentTarget.value, e.currentTarget.selectionStart)}
          onBlur={() => setTimeout(() => document.activeElement !== inputRef.current && setQuery(null), 120)}
          onKeyDown={(e) => {
            if (query && options.length) {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length);
                return;
              }
              if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                pick(options[active]!);
                return;
              }
            }
            if (e.key === 'Escape' && query) {
              e.preventDefault();
              e.stopPropagation();
              setQuery(null);
              return;
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
        />

        {query && options.length > 0 && (
          <ul role="listbox" aria-label="標注成員" className="absolute bottom-full left-3 z-10 mb-1 w-64 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-card">
            {options.map((m, i) => (
              <li
                key={m.id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(m);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn('flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm', i === active && 'bg-gray-50')}
              >
                <Avatar member={m} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-gray-900">{m.name}</span>
                  <span className="block truncate text-xs text-gray-500">{m.title}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
          <div className="flex min-w-0 items-center gap-2">
            <Button type="button" size="xs" variant="ghost" onClick={insertAt} aria-label="標注成員">
              <AtSign className="h-3.5 w-3.5" strokeWidth={1.75} />
              標注
            </Button>
            {mentioned.length > 0 && <span className="truncate text-xs text-gray-500">將通知 {mentioned.map((m) => m.name).join('、')}</span>}
          </div>
          <Button type="submit" size="sm" variant="primary" aria-label="送出留言" disabled={!text.trim()} loading={add.isPending}>
            <Send className="h-3.5 w-3.5" strokeWidth={1.75} />
            送出
          </Button>
        </div>
      </form>
    </Card>
  );
}
