import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { PushToast } from '@/components/push-toast';
import { ThemeProvider } from '@/components/theme-provider';
import { THEME_COLOR_DARK } from '@/lib/theme-colors';
import './globals.css';

const geist = localFont({
  src: [
    { path: '../../public/fonts/Geist-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../../public/fonts/Geist-Medium.ttf', weight: '500', style: 'normal' },
    { path: '../../public/fonts/Geist-SemiBold.ttf', weight: '600', style: 'normal' },
    { path: '../../public/fonts/Geist-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-geist',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DockWalker',
  description:
    'Superyacht hiring, simplified — daywork and permanent positions for crew and employers',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DockWalker',
  },
  openGraph: {
    title: 'DockWalker',
    description:
      'Superyacht hiring, simplified — daywork and permanent positions for crew and employers',
    siteName: 'DockWalker',
    images: [{ url: '/images/brand/dw_app_icon_cropped.png', width: 512, height: 512 }],
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'DockWalker',
    description:
      'Superyacht hiring, simplified — daywork and permanent positions for crew and employers',
    images: ['/images/brand/dw_app_icon_cropped.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: THEME_COLOR_DARK,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('dw-theme');var d=(t==='light'||t==='dark')?t:(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');document.documentElement.dataset.theme=d;}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${geist.variable} font-sans antialiased`}
        style={{
          ['--font-geist-mono' as string]:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        }}
      >
        <ThemeProvider>
          <PushToast />
          {children}
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
