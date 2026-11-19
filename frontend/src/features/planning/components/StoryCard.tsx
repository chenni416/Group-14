import { Check, Clock, Pencil, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, IconButton, Input, Label, Select, Tag, Textarea } from '@/components/ui';
import { STORY_POINT_OPTIONS } from '@/lib/constants';
import { cn } from '@/lib/cn';
import type { StoryDraft } from '@/types';
import { usePlanningStore } from '../store';
import { DependencyChips } from './DependencyChips';
import { DependencyEditor } from './DependencyEditor';

interface Props {
  story: StoryDraft;
  selected: boolean;
  defaultEditing?: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<StoryDraft>) => void;
}

const SP_OPTIONS = [...STORY_POINT_OPTIONS, 10, 11, 12, 13];

export function StoryCard({ story, selected, defaultEditing = false, onSelect, onChange }: Props) {
  const [editing, setEditing] = useState(defaultEditing);
  const [scopeText, setScopeText] = useState(story.scope.join('\n'));
  const { requestDefer, requestRestore } = usePlanningStore();

  return (
    <article
      onClick={onSelect}
      className={cn(
        'cursor-pointer rounded-2xl border p-5 transition-colors duration-150',
        story.deferred ? 'border-dashed bg-gray-50/70' : 'bg-white',
        selected ? 'border-neutral-900' : story.deferred ? 'border-gray-300' : 'border-gray-100 hover:border-gray-300',
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <Badge tone="dark" className="font-mono">
          {story.code}
        </Badge>
        <Badge className={cn('tabular-nums', story.deferred && 'text-gray-400 line-through')}>{story.storyPoints} SP</Badge>
        {story.deferred ? (
          <Badge>已延後 · 本輪不處理</Badge>
        ) : (
          <span className="text-xs text-gray-500">預估範疇 {story.scope.length} 項</span>
        )}
        {!editing && story.deferred && (
          <Button
            size="xs"
            className="ml-auto"
            aria-label={`取消延後 ${story.code}`}
            onClick={(e) => {
              e.stopPropagation();
              requestRestore('story', story.id);
            }}
          >
            <Undo2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            取消延後
          </Button>
        )}
        {!editing && !story.deferred && (
          <Button
            size="xs"
            variant="ghost"
            className="ml-auto"
            aria-label={`延後 ${story.code}`}
            title="延後到之後的 Sprint，本輪不處理"
            onClick={(e) => {
              e.stopPropagation();
              requestDefer('story', story.id);
            }}
          >
            <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
            延後
          </Button>
        )}
        {editing ? (
          <Button
            size="xs"
            variant="primary"
            className="ml-auto"
            onClick={(e) => {
              e.stopPropagation();
              onChange({ scope: scopeText.split('\n').map((s) => s.trim()).filter(Boolean) });
              setEditing(false);
            }}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2} />
            完成
          </Button>
        ) : (
          <IconButton
            aria-label={`編輯 ${story.code}`}
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
              setEditing(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
          </IconButton>
        )}
      </div>

      {editing ? (
        <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
          <div>
            <Label htmlFor={`${story.id}-title`}>標題</Label>
            <Input id={`${story.id}-title`} value={story.title} onChange={(e) => onChange({ title: e.target.value })} />
          </div>
          <div>
            <Label htmlFor={`${story.id}-story`}>使用者故事</Label>
            <Textarea id={`${story.id}-story`} rows={3} value={story.userStory} onChange={(e) => onChange({ userStory: e.target.value })} />
          </div>
          <div className="grid grid-cols-[96px_1fr] gap-3">
            <div>
              <Label htmlFor={`${story.id}-sp`}>預估點數</Label>
              <Select id={`${story.id}-sp`} value={story.storyPoints} onChange={(e) => onChange({ storyPoints: Number(e.target.value) })}>
                {SP_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`${story.id}-scope`}>任務範疇（每行一項）</Label>
              <Textarea id={`${story.id}-scope`} rows={3} value={scopeText} onChange={(e) => setScopeText(e.target.value)} />
            </div>
          </div>
          <DependencyEditor kind="story" item={story} />
        </div>
      ) : (
        <>
          <h3 className={cn('text-base font-semibold tracking-tight', story.deferred ? 'text-gray-500' : 'text-gray-900')}>{story.title}</h3>
          <p className={cn('mt-1.5 text-sm leading-relaxed', story.deferred ? 'text-gray-400' : 'text-gray-600')}>{story.userStory}</p>
          <DependencyChips itemId={story.id} className="mt-2.5" />
          {story.scope.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {story.scope.map((s) => (
                <Tag key={s}>{s}</Tag>
              ))}
            </div>
          )}
        </>
      )}
    </article>
  );
}
