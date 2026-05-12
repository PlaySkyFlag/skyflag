import type { CapacitorConfig } from '@capacitor/cli';

// NOTE: appId stays as `com.limnology.skyflag` for now. App Store Connect
// treats the bundle id as immutable once an app is in review/distribution,
// so renaming it requires creating a new App Store record. Visible name
// (appName / CFBundleDisplayName in iOS) is "Skyflag" — short form for the
// iPhone home-screen icon. Full brand "Thresan: Skyflag" lives in
// marketing / in-app surfaces, not the home-screen label.
const config: CapacitorConfig = {
  appId: 'com.limnology.skyflag',
  appName: 'Skyflag',
  webDir: 'dist'
};

export default config;
