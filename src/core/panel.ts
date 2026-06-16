/**
 * Side-panel open/closed state. The panel opens a runtime port to the
 * background; the background flips this flag on connect/disconnect. The content
 * script watches it so inline marking only shows while the panel is open.
 */

import { storage } from 'wxt/storage';
import { STORAGE_KEYS } from './config';

const item = storage.defineItem<boolean>(STORAGE_KEYS.panelOpen, { fallback: false });

export const getPanelOpen = () => item.getValue();
export const setPanelOpen = (open: boolean) => item.setValue(open);
export const watchPanelOpen = (cb: (open: boolean) => void) => item.watch(cb);
