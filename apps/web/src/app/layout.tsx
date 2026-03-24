import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { NativeInit } from '@/components/native-init';
import { PushToast } from '@/components/push-toast';
import { ThemeProvider } from '@/components/theme-provider';
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
  description: 'Fast-dispatch daywork hiring for superyacht crew',
  manifest: '/manifest.json',
  icons: {
    icon: '/images/brand/dw_app_icon_cropped.png',
    apple: '/images/brand/dw_app_icon_cropped.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DockWalker',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#111a24',
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
          <NativeInit />
          <PushToast />
          {children}
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
