import { ClosureAgent } from '@prisma/client';

export const AGENT_VALUES: ClosureAgent[] = [
  ClosureAgent.RYAN,
  ClosureAgent.NAYANE,
  ClosureAgent.WALISSON,
  ClosureAgent.JADE,
  ClosureAgent.ABRAAO,
];

export const agentLabels: Record<ClosureAgent, string> = {
  RYAN: 'Ryan',
  NAYANE: 'Nayane',
  WALISSON: 'Walisson',
  JADE: 'Jade',
  ABRAAO: 'Abraão',
};

export type ClosureCounts = Record<ClosureAgent, number>;

export type MonthlyClosureSummary = {
  monthLabel: string;
  counts: ClosureCounts;
};
