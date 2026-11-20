import { Check, Clock, Eye, FileText, Link2, Search, Sparkles, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Badge, Button, Card, CardHeader, IconButton, Input, Label, ProgressBar, Tag } from '@/components/ui';
import { cn } from '@/lib/cn';
import { ragStatus } from '@/lib/rag';
import type { KnowledgeDoc } from '@/types';
import { useOnboardingMutations } from '../hooks/useOnboarding';

const docIcon = (d: KnowledgeDoc) => (d.isLink ? Link2 : /png|jpg|fig/i.test(d.name) ? Eye : FileText);

export function KnowledgeBaseStep({ docs }: { docs: KnowledgeDoc[] }) {
  const { upload, addLink, removeDoc, search } = useOnboardingMutations();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [link, setLink] = useState('');
  const [query, setQuery] = useState('');
  const rag = ragStatus(docs);

  const onFiles = (files: FileList | null) => {
    if (files?.length) upload.mutate([...files].map((f) => ({ name: f.name, size: f.size })));
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <Card>
          <CardHeader title="上傳文件" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              onFiles(e.dataTransfer.files);
            }}
            className={cn(
              'flex w-full flex-col items-center rounded-2xl border border-dashed px-6 py-10 text-center transition-colors duration-150',
              dragging ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50',
            )}
          >
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-600">
              <Upload className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="text-sm font-medium text-gray-900">拖曳或點擊上傳</span>
            <span className="mt-1 text-xs text-gray-500">PRD、架構圖、API 規格、Coding Standards、README</span>
          </button>
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => (onFiles(e.target.files), (e.target.value = ''))} />
          <Label htmlFor="kb-link" className="mt-5">
            或貼上連結（Figma、Notion、GitHub）
          </Label>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (link.trim()) addLink.mutate(link.trim(), { onSuccess: () => setLink('') });
            }}
          >
            <Input id="kb-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.figma.com/file/..." />
            <Button type="submit" variant="primary" loading={addLink.isPending}>
              加入
            </Button>
          </form>
        </Card>
        <Card>
          <CardHeader
            title="測試檢索"
            action={
              <Badge tone="violet">
                <Sparkles className="h-3 w-3" strokeWidth={2} />
                RAG
              </Badge>
            }
          />
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) search.mutate(query.trim());
            }}
          >
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例如：webhook 要怎麼驗證？" aria-label="檢索問題" />
            <IconButton type="submit" aria-label="檢索" disabled={search.isPending}>
              <Search className="h-4 w-4" strokeWidth={1.75} />
            </IconButton>
          </form>
          {search.data && (
            <div className="mt-4 space-y-2">
              {search.data.map((h) => (
                <div key={h.source} className="rounded-2xl bg-gray-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-gray-900">{h.source}</span>
                    <span className="font-mono text-xs tabular-nums text-gray-500">score {h.score.toFixed(2)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500">{h.excerpt}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <Card>
        <CardHeader
          title="Project Knowledge Base"
          action={
            <Badge tone={rag.ready ? 'sky' : 'orange'}>
              {rag.ready ? <Check className="h-3 w-3" strokeWidth={2.2} /> : <Clock className="h-3 w-3" strokeWidth={2} />}
              {rag.label}
            </Badge>
          }
        />
        <div className="divide-y divide-gray-100">
          {docs.map((d) => {
            const Icon = docIcon(d);
            const done = d.progress >= 100;
            return (
              <div key={d.id} className="flex items-center gap-3 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-600">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-gray-900">{d.name}</span>
                    <span className={cn('shrink-0 text-xs tabular-nums', done ? 'text-sky-700' : 'text-gray-500')}>
                      {done ? `Indexed · ${d.chunks} chunks` : `Indexing ${d.progress}%`}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Tag>{d.kind}</Tag>
                    <span className="shrink-0 text-xs text-gray-400">{d.size}</span>
                    <ProgressBar value={d.progress} max={100} tone={done ? 'sky' : 'orange'} size="xs" className="flex-1" label={`${d.name} 索引進度`} />
                  </div>
                </div>
                <IconButton aria-label={`移除 ${d.name}`} size="sm" variant="ghost" onClick={() => removeDoc.mutate(d.id)}>
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </IconButton>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
