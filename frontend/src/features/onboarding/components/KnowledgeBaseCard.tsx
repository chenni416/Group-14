import { Eye, FileText, Link2, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button, Card, CardHeader, IconButton, Input, Tag } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { KnowledgeDoc } from '@/types';
import { useOnboardingMutations } from '../hooks/useOnboarding';

const docIcon = (d: KnowledgeDoc) => (d.isLink ? Link2 : /png|jpg|fig/i.test(d.name) ? Eye : FileText);

/** 專案知識庫：上傳文件或貼上連結，下方列出已加入的文件 */
export function KnowledgeBaseCard({ docs, editable }: { docs: KnowledgeDoc[]; editable: boolean }) {
  const { upload, addLink, removeDoc } = useOnboardingMutations();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [link, setLink] = useState('');

  const onFiles = (files: FileList | null) => {
    if (files?.length) upload.mutate([...files].map((f) => ({ name: f.name, size: f.size })));
  };

  return (
    <Card>
      <CardHeader title="專案知識庫" description="PRD、架構圖、API 規格、Coding Standards、README" />
      <button
        type="button"
        disabled={!editable}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (editable) onFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl border border-dashed px-4 py-4 text-left transition-colors duration-150 disabled:cursor-not-allowed',
          dragging ? 'border-gray-900 bg-gray-50' : 'border-gray-200 enabled:hover:bg-gray-50',
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
          <Upload className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span>
          <span className="block text-sm font-medium text-gray-900">拖曳或點擊上傳文件</span>
          <span className="block text-xs text-gray-500">支援 PDF、Markdown、圖片等檔案</span>
        </span>
      </button>
      <input ref={fileRef} type="file" multiple hidden onChange={(e) => (onFiles(e.target.files), (e.target.value = ''))} />
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (link.trim()) addLink.mutate(link.trim(), { onSuccess: () => setLink('') });
        }}
      >
        <Input
          aria-label="文件連結"
          value={link}
          disabled={!editable}
          onChange={(e) => setLink(e.target.value)}
          placeholder="或貼上連結（Figma、Notion、GitHub）"
        />
        <Button type="submit" disabled={!editable || !link.trim()} loading={addLink.isPending}>
          加入
        </Button>
      </form>

      <div className="mt-4 text-xs text-gray-500">已加入 {docs.length} 份文件</div>
      {docs.length > 0 && (
        <div className="mt-1 max-h-52 divide-y divide-gray-100 overflow-y-auto">
          {docs.map((d) => {
            const Icon = docIcon(d);
            return (
              <div key={d.id} className="flex items-center gap-3 py-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-600">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{d.name}</span>
                <Tag>{d.kind}</Tag>
                <span className="w-14 shrink-0 text-right text-xs tabular-nums text-gray-400">{d.size}</span>
                {editable && (
                  <IconButton aria-label={`移除 ${d.name}`} size="sm" variant="ghost" onClick={() => removeDoc.mutate(d.id)}>
                    <X className="h-4 w-4" strokeWidth={1.75} />
                  </IconButton>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
