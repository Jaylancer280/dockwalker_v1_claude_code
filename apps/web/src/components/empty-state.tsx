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
    // Card is max-w-md so the image never exceeds the source file's native
    // resolution (~400-600px wide for the current empty-states/*.jpg set) and
    // therefore never stretch-blurs. To go wider without pixelation, replace
    // the source JPEGs with 1600px+ exports.
    return (
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-[14px] border border-dashed border-[var(--border)] text-center">
        <Image
          src={imageSrc}
          alt=""
          width={448}
          height={224}
          sizes="(min-width: 640px) 448px, 100vw"
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
