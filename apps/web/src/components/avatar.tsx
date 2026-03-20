'use client';

import { useState } from 'react';
import Image from 'next/image';

interface AvatarProps {
  src: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-20 w-20 text-xl',
};

const pxMap = { sm: 32, md: 48, lg: 80 };

export function Avatar({ src, name, size = 'md' }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initials = (name || '?')[0].toUpperCase();
  const sizeClass = sizeMap[size];
  const imgSize = pxMap[size];

  if (src && !imgError) {
    return (
      <Image
        src={src}
        alt={name}
        width={imgSize}
        height={imgSize}
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
        onError={() => setImgError(true)}
        unoptimized
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary`}
    >
      {initials}
    </div>
  );
}
