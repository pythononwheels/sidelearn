/**
 * Model discovery via LM Studio's native REST endpoint (`/api/v0/models`),
 * which — unlike the OpenAI-compatible `/v1/models` — also reports context
 * length, load state and capabilities. We use it to populate the model picker.
 */

import { APPROVED_MODELS, LM_STUDIO } from '../config';

export interface ModelInfo {
  id: string;
  type: string;
  state: 'loaded' | 'not-loaded';
  maxContextLength: number;
  /** Context the model is currently loaded with (only when state === 'loaded'). */
  loadedContextLength?: number;
  /** Whether we have tested & approved this model. */
  approved: boolean;
}

interface RawModel {
  id: string;
  type?: string;
  state?: string;
  max_context_length?: number;
  loaded_context_length?: number;
}

/**
 * List text-generation models. Embedding/TTS models are filtered out.
 * Approved models are sorted first. Returns [] if LM Studio is unreachable.
 */
export async function listModels(): Promise<ModelInfo[]> {
  let raw: RawModel[];
  try {
    const res = await fetch(`${LM_STUDIO.nativeBaseUrl}/models`);
    if (!res.ok) return [];
    raw = ((await res.json()) as { data?: RawModel[] }).data ?? [];
  } catch {
    return [];
  }

  const approved = new Set<string>(APPROVED_MODELS);
  return raw
    .filter((m) => m.type !== 'embeddings' && m.type !== 'tts')
    .map<ModelInfo>((m) => ({
      id: m.id,
      type: m.type ?? 'llm',
      state: m.state === 'loaded' ? 'loaded' : 'not-loaded',
      maxContextLength: m.max_context_length ?? 0,
      loadedContextLength: m.loaded_context_length,
      approved: approved.has(m.id),
    }))
    .sort((a, b) => Number(b.approved) - Number(a.approved) || a.id.localeCompare(b.id));
}
