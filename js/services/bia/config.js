/* Proveedor de IA (Gemini u OpenAI), claves y modelo. Lo usan la voz de Bía y el análisis de comidas. */

import { db } from '../../db.js';

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
  const openaiModel = openaiModelRow?.value || 'gpt-4o-mini-realtime-preview';

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
