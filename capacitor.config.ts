import type { CapacitorConfig } from '@capacitor/cli';

// NOTE: appId stays as `com.limnology.skyflag` for now. App Store Connect
// treats the bundle id as immutable once an app is in review/distribution,
// so renaming it requires creating a new App Store record. Visible name
// (appName / CFBundleDisplayName in iOS) flips to 3phor; the bundle id
// rename is Phase C with full App Store coordination.
const config: CapacitorConfig = {
  appId: 'com.limnology.skyflag',
  appName: '3phor',
  webDir: 'dist'
};

export default config;
