'use client';

import { useRouter } from 'next/navigation';
import { Briefcase, Loader2, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { currencySymbol } from '@/lib/units';
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
      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {!loading && templates.length === 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">No templates</CardTitle>
            </div>
            <CardDescription>
              Save a template from the post form to reuse common configurations.
            </CardDescription>
          </CardHeader>
        </Card>
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
