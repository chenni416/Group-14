import { Copy, Undo2 } from 'lucide-react';
import { Button, Card, CardHeader, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { usePrompt, useSetPromptVersion } from '../hooks/useStudio';

function PromptLine({ line, added }: { line: string; added: boolean }) {
  const m = line.match(/^(【[^】]+】)(.*)$/);
  return (
    <div className={cn('-mx-2 rounded px-2', added && 'bg-violet-50 text-violet-900')}>
      {m ? (
        <>
          <span className="font-semibold text-gray-900">{m[1]}</span>
          {m[2]}
        </>
      ) : (
        line
      )}
    </div>
  );
}

export function LivingPrompt({ taskId }: { taskId: string }) {
  const { data } = usePrompt(taskId);
  const setVersion = useSetPromptVersion(taskId);
  const copy = useCopyToClipboard();

  if (!data) return <Skeleton className="h-72" />;

  const { versions, current } = data;
  const lines = versions[current] ?? [];
  const prev = current > 0 ? versions[current - 1] ?? [] : lines;

  return (
    <Card className="flex flex-col p-5">
      <CardHeader
        title="Living Prompt"
        description="任務規格、Sprint 目標與知識庫自動組合，會隨對話更新"
        className="mb-4"
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Prompt 版本">
          {versions.map((_, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={i === current}
              onClick={() => setVersion.mutate(i)}
              className={cn(
                'h-7 min-w-[2.25rem] rounded-full px-2 text-xs font-medium tabular-nums transition-colors duration-150',
                i === current ? 'bg-neutral-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              v{i + 1}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Button size="xs" disabled={current === 0} onClick={() => setVersion.mutate(current - 1)}>
            <Undo2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            還原上一版
          </Button>
          <Button size="xs" variant="primary" onClick={() => copy(lines.join('\n'), `已複製 ${taskId} 的 Prompt`)}>
            <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
            Copy prompt
          </Button>
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto rounded-2xl lg:max-h-none lg:min-h-0 lg:flex-1 bg-gray-50 p-4 font-mono text-xs leading-relaxed text-gray-700">
        {lines.map((line, i) => (
          <PromptLine key={i} line={line} added={current > 0 && !prev.includes(line)} />
        ))}
      </div>
      {current > 0 && <p className="mt-2 text-xs text-gray-500">淡紫色為本版新增內容</p>}
    </Card>
  );
}
