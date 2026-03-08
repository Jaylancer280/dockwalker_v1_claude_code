import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dockwalker.app',
  appName: 'DockWalker',
  // Must match Next.js static export output directory (CAPACITOR_BUILD=1 next build)
  webDir: 'out',
  server: {
    // In development, use the local dev server
    ...(process.env.NODE_ENV === 'development'
      ? { url: 'http://localhost:3000', cleartext: true }
      : {}),
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#0B1A2E',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#FFFFFF',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  ios: {
    scheme: 'DockWalker',
    contentInset: 'always',
  },
  android: {
    backgroundColor: '#FFFFFF',
  },
};

export default config;
