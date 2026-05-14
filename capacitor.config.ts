import type { CapacitorConfig } from '@capacitor/cli';

// NOTE: appId stays as `com.limnology.skyflag` even after the rebrand —
// App Store Connect treats the bundle id as immutable once an app is in
// distribution. Changing it would create a new App Store record and
// fork the existing user base. Visible name (appName /
// CFBundleDisplayName in iOS) is "Thresan" — the umbrella brand. The
// current edition "Skyflag" lives inside the app as content, alongside
// future editions; the bundle id is a historical artifact at this point.
const config: CapacitorConfig = {
  appId: 'com.limnology.skyflag',
  appName: 'Thresan',
  webDir: 'dist'
};

export default config;
