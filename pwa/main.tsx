import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import '@/ui/tokens.css';
import './app.css';
import { App } from './App';

// Register the SW. onNeedRefresh fires only when a NEW version is waiting (not
// on first install), so the in-app banner shows only for real updates.
let swReg: ServiceWorkerRegistration | undefined;
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new Event('sl-need-refresh'));
  },
  onRegisteredSW(_url, r) {
    swReg = r;
  },
});
const w = window as unknown as {
  __slUpdate?: (r?: boolean) => Promise<void>;
  __slCheckUpdate?: () => Promise<boolean>;
};
// Activate a waiting worker + reload.
w.__slUpdate = updateSW;
// Ask the server for a fresh SW. Resolves true if a new version got detected
// (onNeedRefresh then fires the banner). Without this, "check for updates" only
// ever activates an already-waiting worker and never polls for a new build.
w.__slCheckUpdate = async () => {
  if (!swReg) return false;
  const before = !!swReg.waiting;
  try { await swReg.update(); } catch { /* offline / ignore */ }
  return before || !!swReg.waiting || !!swReg.installing;
};

render(<App />, document.getElementById('app')!);
