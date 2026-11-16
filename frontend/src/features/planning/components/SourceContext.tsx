import { Sparkles, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, CardHeader, Input, Label, Tag, Textarea } from '@/components/ui';
import { useDocs } from '@/hooks/queries';
import { ragStatus } from '@/lib/rag';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import type { Sprint } from '@/types';
import { useMinutes, usePlanningMutations } from '../hooks/usePlanning';

interface Props {
  sprint: Sprint;
  analyzing: boolean;
  hasDraft: boolean;
  onAnalyze: (goal: string, minutes: string) => void;
}

/** 階段 0：Sprint Goal、會議紀錄與已掛載的專案脈絡 */
export function SourceContext({ sprint, analyzing, hasDraft, onAnalyze }: Props) {
  const { data: savedMinutes } = useMinutes();
  const { data: docs } = useDocs();
  const { updateGoal } = usePlanningMutations();
  const [minutes, setMinutes] = useState('');
  const [goal, setGoal] = useState(sprint.goal);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (savedMinutes != null) setMinutes(savedMinutes);
  }, [savedMinutes]);
  useEffect(() => setGoal(sprint.goal), [sprint.goal]);

  const rag = ragStatus(docs ?? []);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setMinutes(String(reader.result ?? ''));
      toast(`已讀取 ${file.name}`);
    };
    reader.readAsText(file);
  };

  return (
    <Card className="lg:sticky lg:top-0">
      <CardHeader title="Source Context" action={<Tag>{`${sprint.start} – ${sprint.end}`}</Tag>} />
      <div className="space-y-5">
        <div>
          <Label htmlFor="sprint-goal">Sprint Goal</Label>
          <Input
            id="sprint-goal"
            value={goal}
            placeholder="本次 Sprint 要達成的成果"
            onChange={(e) => setGoal(e.target.value)}
            onBlur={() => goal !== sprint.goal && updateGoal.mutate({ id: sprint.id, goal })}
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label htmlFor="minutes" className="mb-0">
              會議紀錄（Markdown）
            </Label>
            <div className="flex gap-1.5">
              <Button size="xs" onClick={() => fileRef.current?.click()}>
                <Upload className="h-3 w-3" strokeWidth={1.75} />
                上傳
              </Button>
              <Button size="xs" onClick={async () => setMinutes(await api.planning.getSampleMinutes())}>
                範例
              </Button>
              <input ref={fileRef} type="file" accept=".md,.txt" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            </div>
          </div>
          <Textarea
            id="minutes"
            rows={14}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="bg-gray-50 font-mono text-xs"
          />
        </div>
        <div>
          <Label>AI 已掛載的專案脈絡</Label>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={rag.ready ? 'sky' : 'orange'} dot>
              {rag.label}
            </Badge>
            {docs?.slice(0, 5).map((d) => <Tag key={d.id}>{d.kind}</Tag>)}
          </div>
        </div>
        <Button
          variant="primary"
          size="lg"
          className="w-full"
         
          loading={analyzing}
          onClick={() => onAnalyze(goal, minutes)}
        >
          <Sparkles className="h-4 w-4" strokeWidth={1.75} />
          {analyzing ? 'AI 分析中' : hasDraft ? '重新分析（覆蓋目前草稿）' : 'AI Analyze & Decompose'}
        </Button>
      </div>
    </Card>
  );
}
