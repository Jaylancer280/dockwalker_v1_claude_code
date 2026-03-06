import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Anchor, Briefcase, MessageSquare } from 'lucide-react';
import { HatSwitcher } from '@/components/hat-switcher';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data: person } = await supabase
    .from('persons')
    .select('id, identity_type, current_hat')
    .eq('id', user.id)
    .single();

  if (!person) redirect('/onboarding');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, identity_type, primary_role_id, agency_name, location_port_id')
    .eq('person_id', user.id)
    .single();

  const isCrewHat = person.current_hat === 'crew';
  const isEmployerHat = person.current_hat === 'employer';

  return (
    <main className="flex min-h-svh flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">DockWalker</h1>
            <p className="text-xs text-muted-foreground">{profile?.display_name ?? 'Welcome'}</p>
          </div>
          <HatSwitcher currentHat={person.current_hat} identityType={person.identity_type} />
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-6">
        {/* Empty state */}
        {isCrewHat && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Anchor className="h-5 w-5 text-sea" />
                <CardTitle className="text-base">Find daywork</CardTitle>
              </div>
              <CardDescription>
                No jobs to show yet. Jobs will appear here as employers post them in your area.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {isEmployerHat && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-navy-light" />
                <CardTitle className="text-base">Your postings</CardTitle>
              </div>
              <CardDescription>
                You haven&apos;t posted any daywork yet. Post your first job to start finding crew.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {person.current_hat === 'agent' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-navy-light" />
                <CardTitle className="text-base">Agency postings</CardTitle>
              </div>
              <CardDescription>
                No postings yet. Post daywork on behalf of your vessels to start finding crew.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Messages</CardTitle>
            </div>
            <CardDescription>
              No conversations yet. Messages will appear here after a hire is confirmed.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </main>
  );
}
