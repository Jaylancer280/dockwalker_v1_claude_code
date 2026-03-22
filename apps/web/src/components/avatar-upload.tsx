'use client';

import { useState, useRef } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/ui/button';
import { safeFetch } from '@/lib/safe-fetch';

interface AvatarUploadProps {
  currentUrl: string | null;
  name: string;
  onUploaded: (url: string | null) => void;
}

function resizeImage(file: File, maxSize: number): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(blob ?? file),
        file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        0.85,
      );
    };
    img.src = URL.createObjectURL(file);
  });
}

export function AvatarUpload({ currentUrl, name, onUploaded }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);

    const resized = await resizeImage(file, 512);
    const formData = new FormData();
    formData.append('file', resized, file.name);

    const result = await safeFetch<{ avatar_url: string }>('/api/profile/avatar', {
      method: 'POST',
      body: formData,
    });

    if (result.ok) {
      onUploaded(result.data.avatar_url);
    } else {
      setError(result.error);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleRemove() {
    setUploading(true);
    const result = await safeFetch('/api/profile/avatar', { method: 'DELETE' });
    if (result.ok) onUploaded(null);
    setUploading(false);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        className="relative"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        <Avatar src={currentUrl} name={name} size="lg" />
        <div className="absolute bottom-0 right-0 rounded-full bg-primary p-1 text-primary-foreground">
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      {currentUrl && !uploading && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={handleRemove}
        >
          <X className="mr-1 h-3 w-3" />
          Remove photo
        </Button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
