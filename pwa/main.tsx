import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import '@/ui/tokens.css';
import './app.css';
import { App } from './App';

// Auto-update the service worker in the background; the in-app banner
// (useUpdate) tells the user when a refresh will pick up a new version.
registerSW({ immediate: true });

render(<App />, document.getElementById('app')!);
