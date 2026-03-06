import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function Home() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/images/brand/dw_app_icon_cropped.png"
            alt="DockWalker"
            width={80}
            height={80}
            className="rounded-2xl"
          />
          <h1 className="text-2xl font-bold tracking-tight">DockWalker</h1>
          <p className="text-center text-sm text-muted-foreground">
            Fast-dispatch daywork hiring for superyacht crew
          </p>
        </div>

        {/* Design system preview */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-base">Design System Active</CardTitle>
            <CardDescription>Maritime professional theme with Geist font</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge>Deckhand</Badge>
              <Badge variant="secondary">STCW</Badge>
              <Badge variant="outline">Antibes</Badge>
            </div>
            <div className="flex gap-2">
              <Button size="sm">Apply</Button>
              <Button size="sm" variant="outline">
                Pass
              </Button>
              <Button size="sm" variant="secondary">
                Details
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Color palette preview */}
        <div className="flex w-full flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">Brand palette</p>
          <div className="flex gap-1.5">
            <div className="h-8 flex-1 rounded-md bg-navy" title="Navy" />
            <div className="h-8 flex-1 rounded-md bg-navy-light" title="Navy Light" />
            <div className="h-8 flex-1 rounded-md bg-sea" title="Sea" />
            <div className="h-8 flex-1 rounded-md bg-sea-light" title="Sea Light" />
            <div className="h-8 flex-1 rounded-md bg-teal" title="Teal" />
            <div className="h-8 flex-1 rounded-md bg-success" title="Success" />
            <div className="h-8 flex-1 rounded-md bg-warning" title="Warning" />
          </div>
        </div>
      </div>
    </main>
  );
}
