'use client';

import { useState } from 'react';
import { FileText, Image, Download, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { safeFetch } from '@/lib/safe-fetch';
import { useToast } from '@/hooks/use-toast';

interface DocumentInfo {
  id: string;
  message_id: string | null;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  expires_at: string;
  deleted_at: string | null;
  uploader_person_id: string;
}

interface DocumentCardProps {
  doc: DocumentInfo;
  engagementId: string;
  userId: string;
  onDeleted: (docId: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hoursRemaining(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)));
}

export function DocumentCard({ doc, engagementId, userId, onDeleted }: DocumentCardProps) {
  const { showError } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isExpired = new Date(doc.expires_at) < new Date();
  const isDeleted = !!doc.deleted_at;
  const isActive = !isExpired && !isDeleted;
  const isUploader = doc.uploader_person_id === userId;
  const isPdf = doc.mime_type === 'application/pdf';
  const hours = hoursRemaining(doc.expires_at);

  async function handleDownload() {
    setDownloading(true);
    const res = await safeFetch<{ url: string }>(
      `/api/messages/${engagementId}/documents/${doc.id}/download`,
    );
    if (res.ok && res.data.url) {
      window.open(res.data.url, '_blank');
    } else {
      showError(!res.ok ? res.error : 'Download failed');
    }
    setDownloading(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await safeFetch(`/api/messages/${engagementId}/documents/${doc.id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      onDeleted(doc.id);
    } else {
      showError('Failed to delete');
    }
    setDeleting(false);
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
        isActive
          ? 'border-[var(--border)] bg-[var(--surface)]'
          : 'border-[var(--border)] bg-[var(--surface)] opacity-50'
      }`}
    >
      {isPdf ? (
        <FileText className="h-5 w-5 shrink-0 text-red-500" />
      ) : (
        <Image className="h-5 w-5 shrink-0 text-blue-500" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{doc.file_name}</p>
        <p className="text-[10px] text-muted-foreground">
          {formatSize(doc.file_size_bytes)}
          {isActive && (
            <>
              {' · '}
              <Clock className="inline h-3 w-3" /> {hours}h left
            </>
          )}
          {isExpired && !isDeleted && ' · Expired'}
          {isDeleted && ' · Deleted by uploader'}
        </p>
      </div>

      {isActive && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleDownload}
            disabled={downloading}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          {isUploader && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
