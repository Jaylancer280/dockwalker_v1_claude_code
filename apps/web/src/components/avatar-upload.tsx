'use client';

import { useState, useRef } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { Avatar } from '@/components/avatar';
import { ImageCropper } from '@/components/image-cropper';
import { Button } from '@/components/ui/button';
import { safeFetch } from '@/lib/safe-fetch';

interface AvatarUploadProps {
  currentUrl: string | null;
  name: string;
  onUploaded: (url: string | null) => void;
}

export function AvatarUpload({ currentUrl, name, onUploaded }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('avatar.jpg');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSelectedFileName(file.name);
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleCropConfirm(blob: Blob) {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setUploading(true);

    const formData = new FormData();
    formData.append('file', blob, selectedFileName);

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
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
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
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
