import { PageHeader } from '@/components/layout/page-header';
import { ApprovalChainEditor } from '@/components/admin/approval-chain-editor';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireOsa } from '@/lib/auth';
import {
  APPROVAL_STEP_ROLE_SEQUENCE,
  type ApprovalStepRole,
} from '@/lib/labels';
import { SUBMISSION_MODULES } from '@/lib/submissions';
import { createClient } from '@/lib/supabase/server';

const MODULES = Object.values(SUBMISSION_MODULES);
const MODULE_ORDER = MODULES.map((module) => module.recordType);

/**
 * OSA-only editor for the four approval chains. A saved chain applies to
 * submissions made from then on - records already in review keep the chain
 * they snapshotted at submit time.
 */
export default async function ApprovalChainsPage() {
  await requireOsa();

  const supabase = await createClient();
  const { data: chains } = await supabase
    .from('approval_chains')
    .select(
      'id, record_type, name, steps:approval_chain_steps(step_number, step_role)'
    );

  const ordered = (chains ?? [])
    .map((chain) => ({
      ...chain,
      steps: [...(chain.steps ?? [])].sort(
        (a, b) => a.step_number - b.step_number
      ),
    }))
    .sort(
      (a, b) =>
        MODULE_ORDER.indexOf(a.record_type) - MODULE_ORDER.indexOf(b.record_type)
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval chains"
        description="Who signs off on each submission module. Edits apply to new submissions only - records already in review keep the steps they were submitted with."
      />

      <div className="grid gap-4">
        {ordered.map((chain) => {
          const mod = MODULES.find(
            (module) => module.recordType === chain.record_type
          );
          const roles = chain.steps.map(
            (step) => step.step_role as ApprovalStepRole
          );
          return (
            <Card key={chain.id}>
              <CardHeader>
                <CardTitle>{mod?.label ?? chain.record_type}</CardTitle>
                <CardDescription>
                  {chain.name} · {APPROVAL_STEP_ROLE_SEQUENCE(roles)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ApprovalChainEditor chainId={chain.id} initialSteps={roles} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
