/**
 * Per-page chat history. Keyed by page URL like the result cache, so each page
 * keeps its own conversation and it survives closing/reopening the chat.
 */

import { storage } from 'wxt/storage';
import { STORAGE_KEYS } from './config';
import type { ChatTurn } from './chat';

export interface StoredChatMsg extends ChatTurn {
  translation?: string;
}

type ChatsByPage = Record<string, StoredChatMsg[]>;

const MAX_PAGES = 50;

const item = storage.defineItem<ChatsByPage>(STORAGE_KEYS.chats, { fallback: {} });

export async function getChat(key: string): Promise<StoredChatMsg[]> {
  return (await item.getValue())[key] ?? [];
}

export async function setChat(key: string, msgs: StoredChatMsg[]): Promise<void> {
  const all = await item.getValue();
  const next = { ...all };
  if (msgs.length === 0) delete next[key];
  else next[key] = msgs;
  const keys = Object.keys(next);
  if (keys.length > MAX_PAGES) {
    for (const k of keys.slice(0, keys.length - MAX_PAGES)) delete next[k];
  }
  await item.setValue(next);
}
