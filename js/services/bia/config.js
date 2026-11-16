/* Proveedor de IA (Gemini u OpenAI), claves y modelo. Lo usan la voz de Bía y el análisis de comidas. */

import { db } from '../../db.js';

/* Modelos de voz de OpenAI que se ofrecen, el primero es el de fábrica. */
export const OPENAI_VOICE_MODELS = [
  { id: 'gpt-4o-mini-realtime-preview', label: 'gpt-4o-mini (Económico)' },
  { id: 'gpt-4o-realtime-preview', label: 'gpt-4o (Ultra)' },
];
/* Una clave real de cualquiera de los dos es bastante más larga: evita guardar un pegado a medias. */
export const MIN_KEY_LENGTH = 15;

export async function getAgentConfig() {
  const [providerRow, geminiKeyRow, openaiKeyRow, openaiModelRow] = await Promise.all([
    db.get('meta', 'voiceProvider'),
    db.get('meta', 'geminiApiKey'),
    db.get('meta', 'openaiApiKey'),
    db.get('meta', 'openaiModel'),
  ]);

  const provider = providerRow?.value || 'gemini';
  const geminiKey = geminiKeyRow?.value || '';
  const openaiKey = openaiKeyRow?.value || '';
  const openaiModel = openaiModelRow?.value || OPENAI_VOICE_MODELS[0].id;

  return {
    provider,
    geminiKey,
    openaiKey,
    openaiModel,
    activeKey: provider === 'openai' ? openaiKey : geminiKey,
    voice: provider === 'openai' ? 'coral' : 'Aoede',
  };
}

export async function setAgentConfig({ provider, geminiKey, openaiKey, openaiModel }) {
  if (provider !== undefined) await db.put('meta', { key: 'voiceProvider', value: provider });
  if (geminiKey !== undefined) await db.put('meta', { key: 'geminiApiKey', value: geminiKey });
  if (openaiKey !== undefined) await db.put('meta', { key: 'openaiApiKey', value: openaiKey });
  if (openaiModel !== undefined) await db.put('meta', { key: 'openaiModel', value: openaiModel });
}
