'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { safeFetch } from '@/lib/safe-fetch';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, Loader2, Search } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

export default function AddShoreExperiencePage() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [categoryId, setCategoryId] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [employerName, setEmployerName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCurrent, setIsCurrent] = useState(false);
  const [description, setDescription] = useState('');

  useEffect(() => {
    safeFetch<{ categories?: Category[] }>('/api/shore-experience-categories').then((res) => {
      if (res.ok) setCategories(res.data.categories ?? []);
      setLoading(false);
    });
  }, []);

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase()),
  );

  const selectedCategory = categories.find((c) => c.id === categoryId);

  async function handleSubmit() {
    if (!categoryId || !employerName.trim() || !jobTitle.trim() || !startDate) {
      showError('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    const result = await safeFetch<{ id?: string; error?: string }>('/api/shore-experiences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryId,
        employerName: employerName.trim(),
        jobTitle: jobTitle.trim(),
        startDate,
        endDate: isCurrent ? null : endDate || null,
        isCurrent,
        description: description.trim() || null,
      }),
    });

    if (result.ok) {
      showSuccess('Shore experience added');
      router.push('/profile');
    } else {
      showError(result.error);
    }
    setSubmitting(false);
  }

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="page-width flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h1 className="text-lg font-semibold">Add Shore-Based Experience</h1>
        </div>
      </header>

      <div className="page-width flex w-full flex-col gap-6 px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label>Industry Category *</Label>
              {selectedCategory ? (
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[var(--success-lo)] border border-[var(--success)]/20 px-3 py-1 text-sm text-[var(--success)]">
                    {selectedCategory.name}
                  </span>
                  <button
                    onClick={() => setCategoryId('')}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search categories..."
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
                    {filteredCategories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setCategoryId(cat.id);
                          setCategorySearch('');
                        }}
                        className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-sm transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        {cat.name}
                      </button>
                    ))}
                    {filteredCategories.length === 0 && (
                      <p className="px-2 py-3 text-sm text-muted-foreground">
                        No categories match your search
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="employerName">Employer / Company *</Label>
              <Input
                id="employerName"
                placeholder="e.g. Hilton Hotels, British Army"
                value={employerName}
                onChange={(e) => setEmployerName(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="jobTitle">Job Title *</Label>
              <Input
                id="jobTitle"
                placeholder="e.g. Front Desk Manager, Infantry Sergeant"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={isCurrent}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isCurrent}
                onChange={(e) => {
                  setIsCurrent(e.target.checked);
                  if (e.target.checked) setEndDate('');
                }}
                className="rounded border-[var(--border)]"
              />
              I currently work here
            </label>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of your role and responsibilities"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={250}
              />
              <p className="text-xs text-muted-foreground">{description.length}/250</p>
            </div>

            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Experience'
              )}
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
