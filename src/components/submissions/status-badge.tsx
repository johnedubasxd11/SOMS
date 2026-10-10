import { Badge } from '@/components/ui/badge';
import { STATUS_LABELS, STATUS_TONE, type SubmissionStatus } from '@/lib/labels';
import { cn } from 'cn';

export function StatusBadge({
  status,
  className,
}: {
  status: SubmissionStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn('shrink-0 border-transparent', STATUS_TONE[status], className)}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
