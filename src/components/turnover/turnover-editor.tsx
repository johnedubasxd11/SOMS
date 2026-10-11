'use client';

import { useActionState, startTransition, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, Send, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  saveOfficerTermAction,
  submitOfficerTermAction,
  withdrawOfficerTermAction,
} from '@/lib/actions/officer-terms';
import { type ActionResult } from '@/lib/action-result';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  OFFICER_TERM_LABELS,
  OFFICER_TERM_TONE,
  type OfficerTermStatus,
} from '@/lib/labels';

const INITIAL: ActionResult = { ok: true };

function useToastedAction(
  action: (prev: ActionResult, data: FormData) => Promise<ActionResult>
) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const notified = useRef<string | null>(null);

  useEffect(() => {
    if (state === INITIAL) return;
    const key = JSON.stringify(state);
    if (notified.current === key) return;
    notified.current = key;
    if (state.ok) toast.success(state.message ?? 'Saved.');
    else toast.error(state.error);
  }, [state]);

  return { formAction, pending };
}

export interface TurnoverMember {
  full_name: string;
  position: string;
  email: string;
}

export interface TermRow {
  id: string;
  status: OfficerTermStatus;
  notes: string | null;
  submitted_at: string | null;
  members: TurnoverMember[];
}

interface MemberDraft {
  id: number;
  full_name: string;
  position: string;
  email: string;
}

let nextMemberId = 1;

function toDraft(members: TurnoverMember[]): MemberDraft[] {
  return members.map((m) => ({
    id: nextMemberId++,
    full_name: m.full_name,
    position: m.position,
    email: m.email ?? '',
  }));
}

/**
 * The organization-facing turnover screen (Phase 6): officers type the
 * incoming officer list (free-text names - they may not have accounts),
 * save it as a draft, then submit it to OSA. A submitted list is frozen
 * until it is withdrawn or decided on.
 */
export function TurnoverEditor({ term }: { term: TermRow | null }) {
  const editable = !term || term.status === 'draft';
  const saveAction = useToastedAction(saveOfficerTermAction);
  const withdrawAction = useToastedAction(withdrawOfficerTermAction);

  const [members, setMembers] = useState<MemberDraft[]>(toDraft(term?.members ?? []));
  const [notes, setNotes] = useState(term?.notes ?? '');

  function memberField(index: number, field: keyof MemberDraft, value: string) {
    setMembers((prev) =>
      prev.map((member, i) => (i === index ? { ...member, [field]: value } : member))
    );
  }

  function addMember() {
    setMembers((prev) => [
      ...prev,
      { id: nextMemberId++, full_name: '', position: '', email: '' },
    ]);
  }

  function removeMember(index: number) {
    setMembers((prev) => prev.filter((_, i) => i !== index));
  }

  function moveMember(index: number, delta: number) {
    setMembers((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  function buildFormData() {
    const formData = new FormData();
    formData.set('notes', notes);
    formData.set(
      'members',
      JSON.stringify(
        members
          .filter((m) => m.full_name.trim() && m.position.trim())
          .map((m) => ({
            full_name: m.full_name.trim(),
            position: m.position.trim(),
            email: m.email.trim(),
          }))
      )
    );
    return formData;
  }

  function save() {
    startTransition(() => saveAction.formAction(buildFormData()));
  }

  /**
   * Save the current edits first, then flip the status - the submit action
   * re-reads the draft, so a straight submit would fail on unsaved edits.
   */
  function submit() {
    const formData = buildFormData();
    startTransition(async () => {
      const saved = await saveOfficerTermAction(INITIAL, formData);
      if (!saved.ok) {
        toast.error(saved.error);
        return;
      }
      const result = await submitOfficerTermAction(INITIAL, formData);
      if (result.ok) toast.success(result.message ?? 'Submitted.');
      else toast.error(result.error);
    });
  }

  function withdraw() {
    const formData = new FormData();
    formData.set('id', term!.id);
    startTransition(() => withdrawAction.formAction(formData));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={OFFICER_TERM_TONE[term?.status ?? 'draft']}>
            {OFFICER_TERM_LABELS[term?.status ?? 'draft']}
          </Badge>
          {term?.submitted_at ? (
            <span className="text-xs text-muted-foreground">
              Submitted {new Date(term.submitted_at).toLocaleDateString()}
            </span>
          ) : null}
        </div>
        {term?.status === 'submitted' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={withdrawAction.pending}
            onClick={withdraw}
            data-testid="turnover-withdraw"
          >
            {withdrawAction.pending ? <Loader2 className="animate-spin" /> : <Undo2 />}
            Withdraw to edit
          </Button>
        ) : null}
      </div>

      {!editable ? (
        <p className="text-sm text-muted-foreground">
          The officer list is with OSA or already approved - withdraw it first if you
          need to make changes.
        </p>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Officers</Label>
          <Button type="button" size="sm" variant="outline" onClick={addMember} disabled={!editable}>
            <Plus />
            Add officer
          </Button>
        </div>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No officers on the list yet.</p>
        ) : (
          <div className="space-y-2" data-testid="turnover-members">
            {members.map((member, index) => (
              <div
                key={member.id}
                className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
                data-testid="turnover-member-row"
              >
                <Input
                  placeholder="Full name"
                  aria-label="Officer name"
                  value={member.full_name}
                  disabled={!editable}
                  onChange={(e) => memberField(index, 'full_name', e.target.value)}
                />
                <Input
                  placeholder="Position"
                  aria-label="Officer position"
                  value={member.position}
                  disabled={!editable}
                  onChange={(e) => memberField(index, 'position', e.target.value)}
                />
                <Input
                  placeholder="E-mail (optional)"
                  aria-label="Officer e-mail"
                  type="email"
                  value={member.email}
                  disabled={!editable}
                  onChange={(e) => memberField(index, 'email', e.target.value)}
                />
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Move up"
                    disabled={!editable || index === 0}
                    onClick={() => moveMember(index, -1)}
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Move down"
                    disabled={!editable || index === members.length - 1}
                    onClick={() => moveMember(index, 1)}
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Remove officer"
                    className="text-destructive hover:text-destructive"
                    disabled={!editable}
                    onClick={() => removeMember(index)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="turnover-notes">Notes for OSA (optional)</Label>
        <Textarea
          id="turnover-notes"
          rows={3}
          value={notes}
          disabled={!editable}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Context about the turnover - e.g. officers elected during the general assembly on..."
        />
      </div>

      {editable ? (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={saveAction.pending}
            onClick={save}
            data-testid="turnover-save"
          >
            {saveAction.pending ? <Loader2 className="animate-spin" /> : null}
            Save draft
          </Button>
          <Button
            type="button"
            onClick={submit}
            data-testid="turnover-submit"
          >
            <Send />
            Submit to OSA
          </Button>
        </div>
      ) : null}
    </div>
  );
}
