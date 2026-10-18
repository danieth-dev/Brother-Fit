/* Conversación visible de Fit. Vive en meta; no es recuerdo ni serie. */
import { db } from '../db.js';
import { now } from '../utils/clock.js';

export const FIT_CHAT_KEY = 'fitChat';
const MAX_MESSAGES = 60;

function normalize(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.filter((m) => (
    m
    && (m.role === 'user' || m.role === 'bot')
    && String(m.text || '').trim()
  )).map((m) => ({
    role: m.role,
    text: String(m.text).trim(),
    ts: Number(m.ts) || 0,
  }));
}

export async function loadFitChat() {
  const row = await db.get('meta', FIT_CHAT_KEY);
  return normalize(row?.value?.messages);
}

export async function appendFitChat(role, text) {
  const t = String(text || '').trim();
  if (!t || (role !== 'user' && role !== 'bot')) return loadFitChat();
  const messages = await loadFitChat();
  messages.push({ role, text: t, ts: now() });
  const trimmed = messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages;
  await db.put('meta', {
    key: FIT_CHAT_KEY,
    value: { messages: trimmed, updatedAt: now() },
  });
  return trimmed;
}

export async function clearFitChat() {
  await db.remove('meta', FIT_CHAT_KEY);
}

export function formatChatForContext(messages) {
  return normalize(messages)
    .map((m) => (m.role === 'user' ? `Atleta: ${m.text}` : `Fit: ${m.text}`))
    .join('\n');
}
