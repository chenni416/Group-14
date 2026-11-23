import { useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { FolderPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardHeader, Field, Input, PageHeader, Textarea } from '@/components/ui';
import { api } from '@/services';
import { useProjectStore } from '@/stores/project.store';
import { toast } from '@/stores/toast.store';

/** 專案代碼只保留英文大寫與數字（與後端相同） */
const toPrefix = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

/** 建立專案：沒有任何專案的使用者會先來到這裡，建立後進入專案初始化 */
export function CreateProjectPage() {
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [goal, setGoal] = useState('');
  const setCurrentId = useProjectStore((s) => s.setCurrentId);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const create = useMutation({
    mutationFn: () => api.workspace.createProject({ name: name.trim(), prefix, goal: goal.trim() }),
    onSuccess: async (project) => {
      setCurrentId(project.id);
      // 換了專案：所有資料都要重新讀取
      await qc.invalidateQueries();
      toast(`已建立「${project.name}」`);
      navigate('/onboarding');
    },
    onError: (err) => toast(err instanceof Error ? err.message : '建立失敗'),
  });

  const canSubmit = name.trim() !== '' && prefix !== '' && !create.isPending;

  return (
    <>
      <PageHeader eyebrow="New Project" title="建立專案" />
      <Card className="max-w-2xl">
        <CardHeader title="專案基本資訊" description="建立後你會成為這個專案的 Leader，接著進入專案初始化" />
        <div className="space-y-4">
          <Field label="專案名稱" htmlFor="new-project-name">
            <Input
              id="new-project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：Taskline — 會議到交付平台"
              autoFocus
            />
          </Field>
          <Field label="專案代碼（英文大寫或數字，最多 6 個字）" htmlFor="new-project-prefix">
            <Input
              id="new-project-prefix"
              value={prefix}
              onChange={(e) => setPrefix(toPrefix(e.target.value))}
              placeholder="例如：TL"
              className="w-40 font-mono"
            />
          </Field>
          <Field label="專案目標（可以之後再填）" htmlFor="new-project-goal">
            <Textarea id="new-project-goal" rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Button variant="primary" disabled={!canSubmit} onClick={() => create.mutate()}>
              <FolderPlus className="h-4 w-4" strokeWidth={1.75} />
              {create.isPending ? '建立中…' : '建立專案'}
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
