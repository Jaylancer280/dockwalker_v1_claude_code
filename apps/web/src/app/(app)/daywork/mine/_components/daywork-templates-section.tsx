'use client';

import { useRouter } from 'next/navigation';
import { FileText, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { LoadingSpinner } from '@/components/loading-spinner';
import { currencySymbol } from '@dockwalker/shared';
import type { Template } from './daywork-types';

export interface DayworkTemplatesSectionProps {
  loading: boolean;
  templates: Template[];
  deletingTemplate: string | null;
  onDeleteTemplate: (id: string) => void;
}

export function DayworkTemplatesSection({
  loading,
  templates,
  deletingTemplate,
  onDeleteTemplate,
}: DayworkTemplatesSectionProps) {
  const router = useRouter();

  return (
    <>
      {/* B-005: dedicated Create-template entry point. Routes to the post
          form pre-toggled into template-mode (top checkbox checked). */}
      <div className="mb-3 flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push('/daywork/post?type=daywork&mode=template')}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Create template
        </Button>
      </div>
      {loading && <LoadingSpinner size="md" />}
      {!loading && templates.length === 0 && (
        <EmptyState
          icon={FileText}
          title="No templates"
          description="Templates let you save partial job configurations to reuse later. Tap Create template to build one."
        />
      )}
      {templates.map((t) => (
        <Card key={t.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.name}</CardTitle>
            <CardDescription>
              {[
                t.yacht_roles?.name,
                t.ports?.name,
                t.vessels?.name,
                t.day_rate ? `${currencySymbol(t.currency ?? 'EUR')}${t.day_rate}/day` : null,
                t.working_days ? `${t.working_days}d` : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'Partial template — tap Edit to fill in more fields'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => router.push(`/daywork/post?type=daywork&templateId=${t.id}`)}
              >
                <Play className="mr-1 h-3.5 w-3.5" />
                Use
              </Button>
              {/* B-005: edit-in-place. Routes the post form into edit mode
                  so the submit button PATCHes the template row. */}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  router.push(`/daywork/post?type=daywork&mode=edit&templateId=${t.id}`)
                }
              >
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDeleteTemplate(t.id)}
                disabled={deletingTemplate === t.id}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                {deletingTemplate === t.id ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
