import Image from 'next/image';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  icon: Icon,
  imageSrc,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  imageSrc?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-[var(--border)] px-6 py-10 text-center">
      {imageSrc ? (
        <div className="overflow-hidden rounded-[14px] border border-[var(--border)]">
          <Image
            src={imageSrc}
            alt=""
            width={400}
            height={224}
            className="w-full h-[150px] object-cover dark:saturate-[0.85] dark:brightness-[0.7]"
          />
        </div>
      ) : Icon ? (
        <Icon className="h-10 w-10 text-muted-foreground/40" />
      ) : null}
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
