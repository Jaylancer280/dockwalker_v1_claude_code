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
  if (imageSrc) {
    return (
      <div className="overflow-hidden rounded-[14px] border border-dashed border-[var(--border)] text-center">
        <Image
          src={imageSrc}
          alt=""
          width={400}
          height={224}
          sizes="(min-width: 768px) 400px, 100vw"
          className="h-[180px] w-full object-cover dark:saturate-[0.85] dark:brightness-[0.7]"
        />
        <div className="px-6 py-6">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-[var(--border)] px-6 py-10 text-center">
      {Icon && <Icon className="h-10 w-10 text-muted-foreground/40" />}
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
