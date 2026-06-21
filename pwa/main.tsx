import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import '@/ui/tokens.css';
import './app.css';
import { App } from './App';

// Register the SW. onNeedRefresh fires only when a NEW version is waiting (not
// on first install), so the in-app banner shows only for real updates.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new Event('sl-need-refresh'));
  },
});
(window as unknown as { __slUpdate?: (r?: boolean) => Promise<void> }).__slUpdate = updateSW;

render(<App />, document.getElementById('app')!);
