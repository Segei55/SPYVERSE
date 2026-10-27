export interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  bundledWebRuntime?: boolean;
  server?: {
    androidScheme?: string;
    cleartext?: boolean;
  };
  android?: {
    allowMixedContent?: boolean;
    captureInput?: boolean;
  };
}

const config: CapacitorConfig = {
  appId: 'com.spyverse.game',
  appName: 'SPYVERSE',
  webDir: '../../dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: true, // Allow direct LAN IP connections over http
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
