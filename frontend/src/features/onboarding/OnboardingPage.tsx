import { Check, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, CardHeader, PageHeader, PageSkeleton } from '@/components/ui';
import { MemberCard } from '@/features/team/components/MemberCard';
import { useCurrentUser, useDocs, useMembers, useOrganization, useProject } from '@/hooks/queries';
import { scrollMainToTop } from '@/lib/mainScroll';
import { isLead } from '@/lib/permissions';
import { useUiStore } from '@/stores/ui.store';
import { BasicInfoStep } from './components/BasicInfoStep';
import { ragStatus } from '@/lib/rag';
import { KnowledgeBaseStep } from './components/KnowledgeBaseStep';
import { ReviewDefaultsStep } from './components/ReviewDefaultsStep';
import { Stepper } from './components/Stepper';

const STEPS = ['基本資訊', '專案知識庫', '成員技術特徵', 'Review 預設策略'];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { onboardingStep: step, setOnboardingStep } = useUiStore();
  const { data: project } = useProject();
  const { data: org } = useOrganization();
  const { data: docs } = useDocs();
  const { data: members } = useMembers();
  const { data: me } = useCurrentUser();

  if (!project || !org || !docs || !members || !me) return <PageSkeleton />;
  const lead = isLead(me);
  const rag = ragStatus(docs);
  const go = (i: number) => {
    setOnboardingStep(i);
    scrollMainToTop();
  };

  return (
    <>
      <PageHeader
        eyebrow="Project Onboarding & Context Hub"
        title="專案初始化"
        actions={
          <Badge tone={rag.ready ? 'sky' : 'orange'}>
            <Layers className="h-3 w-3" strokeWidth={2} />
            {rag.label}
          </Badge>
        }
      />
      <Stepper steps={STEPS} current={step} onChange={go} />

      {step === 0 && <BasicInfoStep project={project} org={org} editable={lead} />}
      {step === 1 && <KnowledgeBaseStep docs={docs} />}
      {step === 2 && (
        <Card>
          <CardHeader title="成員角色與技術特徵" description="範例：Frontend Lead · React, TypeScript · 8 SP / Sprint" />
          <div className="grid gap-4 md:grid-cols-2">
            {members.map((m) => (
              <MemberCard key={m.id} member={m} editable={lead} />
            ))}
          </div>
        </Card>
      )}
      {step === 3 && <ReviewDefaultsStep project={project} members={members} editable={lead} />}

      <div className="mt-8 flex justify-between">
        <Button disabled={step === 0} onClick={() => go(Math.max(0, step - 1))}>
          上一步
        </Button>
        {step < STEPS.length - 1 ? (
          <Button variant="primary" onClick={() => go(step + 1)}>
            下一步
          </Button>
        ) : (
          <Button variant="primary" onClick={() => navigate('/planning')}>
            <Check className="h-4 w-4" strokeWidth={2} />
            完成並前往 Sprint 規劃
          </Button>
        )}
      </div>
    </>
  );
}
