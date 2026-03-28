'use client';

import { useRouter } from 'next/navigation';
import { FileText, Play, Trash2 } from 'lucide-react';
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
      {loading && <LoadingSpinner size="md" />}
      {!loading && templates.length === 0 && (
        <EmptyState
          icon={FileText}
          title="No templates"
          description="Save a template from the post form to reuse common configurations."
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
                .join(' · ')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => router.push(`/daywork/post?templateId=${t.id}`)}>
                <Play className="mr-1 h-3.5 w-3.5" />
                Use
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
