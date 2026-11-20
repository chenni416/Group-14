import { Code2, Database, PenTool, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Domain } from '@/types';

const DOMAIN_ICONS: Record<Domain, LucideIcon> = {
  FE: Code2,
  BE: Database,
  AI: Sparkles,
  QA: ShieldCheck,
  DS: PenTool,
};

export function DomainIcon({ domain, className }: { domain: Domain; className?: string }) {
  const Icon = DOMAIN_ICONS[domain];
  return <Icon className={cn('h-4 w-4', className)} strokeWidth={1.75} aria-hidden />;
}
