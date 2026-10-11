import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { requireProfile } from '@/lib/auth';
import { guideSectionsForRole, ROLE_LANDING } from '@/lib/guide';
import { ROLE_LABELS, roleBadgeVariant } from '@/lib/labels';

/**
 * Per-role user guide (spec Phase 9). Server-rendered from guide.ts so the
 * copy stays in one place; each role only sees the sections it needs plus
 * the common getting-started material.
 */
export default async function GuidePage() {
  const profile = await requireProfile();
  const sections = guideSectionsForRole(profile.role);
  const landing = ROLE_LANDING[profile.role];

  return (
    <div className="space-y-6">
      <PageHeader
        title="User guide"
        description="How to use SOMS with your account - written for your role."
      />

      <Card data-testid="guide-landing">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={roleBadgeVariant(profile.role)}>
              {ROLE_LABELS[profile.role]}
            </Badge>
            {profile.position ? (
              <span className="text-xs text-muted-foreground">{profile.position}</span>
            ) : null}
          </div>
          <CardTitle className="text-lg">{landing.headline}</CardTitle>
          <CardDescription>{landing.body}</CardDescription>
        </CardHeader>
      </Card>

      {sections.map((section) => (
        <Card key={section.id} data-testid={`guide-section-${section.id}`}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
            <CardDescription>{section.intro}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {section.tasks.map((task, index) => (
              <div key={task.title} className="space-y-2">
                <p className="font-medium">{task.title}</p>
                <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
                  {task.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {index < section.tasks.length - 1 ? <Separator /> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
