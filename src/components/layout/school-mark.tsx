import Image from 'next/image';
import { cn } from 'cn';

/**
 * ACD seal (Office of Student Affairs, Assumption College of Davao), served
 * from `public/acdlogo.png`. `rounded-full` trims the square artboard corners
 * so the round seal blends into any background.
 */
export function SchoolMark({ className }: { className?: string }) {
  return (
    <Image
      src="/acdlogo.png"
      alt="Assumption College of Davao"
      width={128}
      height={128}
      className={cn('rounded-full', className)}
    />
  );
}
