import { render } from 'preact';
import '@/ui/tokens.css';
import './app.css';
import { App } from './App';

render(<App />, document.getElementById('app')!);
