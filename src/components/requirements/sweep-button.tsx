'use client';

import { useRef, useTransition } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { runRequirementSweepAction } from '@/lib/actions/requirements';
import { Button } from '@/components/ui/button';

/**
 * OSA-only "run the deadline sweep now" button. The same sweep runs nightly
 * through pg_cron (or POST /api/cron/reminders where cron is unavailable).
 */
export function SweepButton() {
  const [pending, startTransition] = useTransition();
  const running = useRef(false);

  function run() {
    if (running.current) return;
    running.current = true;
    startTransition(async () => {
      try {
        const result = await runRequirementSweepAction();
        if (result.ok) toast.success(result.message ?? 'Sweep complete.');
        else toast.error(result.error);
      } finally {
        running.current = false;
      }
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={run}>
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      Run reminder sweep
    </Button>
  );
}
