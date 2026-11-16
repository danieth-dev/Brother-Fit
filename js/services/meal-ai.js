/* Análisis de comidas con IA (Gemini u OpenAI) a partir de una foto o una descripción.
 * La foto viaja al proveedor y no se guarda. Sin clave o sin red, las descripciones se leen
 * con el catálogo local (food-catalog.js). */
import { getAgentConfig } from './bia/config.js';
import { normalizeMealItem, buildMealTitle } from './nutrition.js';
import { parseMealTextLocally } from './food-catalog.js';

const NUTRITION_PROMPT = `Eres el nutricionista deportivo de la app Bía.
Analiza la imagen o texto y devuelve ÚNICAMENTE un objeto JSON válido (sin markdown adicional) con esta estructura exacta:
{
  "esComida": true,
  "motivo": "",
  "plato": "Nombre corto del plato en español",
  "items": [
    {
      "nombre": "Nombre del ingrediente en español (ej. Papas en air fryer, Huevo frito, Carne molida)",
      "gramos": 180,
      "kcal": 207,
      "proteina": 4.5,
      "carbos": 43.2,
      "grasa": 2.2
    }
  ]
}
Reglas estrictas:
1. Si en la foto o texto NO hay ningún alimento, comida, bebida ni suplemento (por ejemplo: una mancuerna, un zapato, una pared, una mascota o una pantalla), devuelve "esComida": false, "motivo": "No veo comida ni bebida en la foto.", "items": [] y NO inventes alimentos.
2. Si sí hay comida o bebida, devuelve "esComida": true y estima pesos realistas en gramos para las porciones visibles en el plato.
3. REGLA AIR FRYER Y ACEITE SEPARADO: No infles las calorías de papas, carnes o vegetales asumiendo que fueron sumergidos en aceite profundo. Si las papas están cortadas en dados/trozos dorados sin brillo excesivo de grasa (o si el usuario aclara "air fryer" / "horno"), estímales ~115 kcal por cada 100 g ("Papas en air fryer / horno"). Si crees que algún alimento lleva aceite de sartén (por ejemplo un huevo frito), agrega una fila separada llamada "Aceite de cocción" (ej. 5 g = 44 kcal) para que el atleta pueda subirla, bajarla o quitarla a su gusto.
4. Asegúrate de que las kcal y macros (proteina, carbos, grasa) sean nutricionalmente coherentes con los gramos indicados.`;

/* Poca creatividad: el mismo plato debe dar números parecidos cada vez. */
const TEMPERATURE = 0.15;
const OPENAI_MODEL = 'gpt-4o-mini';
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-flash-latest',
];
const GEMINI_MODELS_TO_TRY = 5;
const GEMINI_EXCLUDED = ['tts', 'embedding', 'imagen', 'veo', 'aqa', 'audio', 'robotics', 'computer-use'];
const INVALID_KEY = /api_key_invalid|key not valid/i;

export function buildNutritionPrompt({ userHint = '', textPrompt = '' } = {}) {
  let prompt = NUTRITION_PROMPT;
  if (userHint) {
    prompt += `\n\nACLARACIÓN IMPORTANTE DEL ATLETA SOBRE ESTE PLATO: "${userHint}". Respeta esta aclaración al identificar los ingredientes, el método de cocción (ej. air fryer = sin aceite extra) y las calorías.`;
  }
  if (textPrompt) prompt += `\n\nDescripción del plato a analizar: "${textPrompt}"`;
  return prompt;
}

function extractJsonObject(raw) {
  const cleaned = String(raw || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Respuesta sin JSON válido.');
  }
}

function extractItems(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (Array.isArray(parsed)) return parsed;
  const arr = parsed.items || parsed.ingredientes || parsed.alimentos;
  return Array.isArray(arr) ? arr : null;
}

/**
 * Convierte la respuesta escrita del modelo en { plato, items }.
 * Lanza un error con code 'NOT_FOOD' si el modelo dice que no hay comida, y otro si la respuesta no sirve.
 */
export function parseNutritionReply(text) {
  const parsed = extractJsonObject(text);
  const items = extractItems(parsed);
  if (parsed?.esComida === false || (Array.isArray(items) && items.length === 0)) {
    const err = new Error(parsed?.motivo || 'No detecté comida ni bebida en la foto.');
    err.code = 'NOT_FOOD';
    throw err;
  }
  if (!items?.length) throw new Error('La IA no devolvió ingredientes válidos.');
  return { plato: parsed.plato || buildMealTitle(items), items: items.map(normalizeMealItem) };
}

export function formatApiError(provider, status, rawText) {
  let msg = '';
  try {
    msg = JSON.parse(rawText)?.error?.message || '';
  } catch {
    msg = String(rawText || '').slice(0, 140);
  }
  if (status === 400 && INVALID_KEY.test(msg)) return `Tu clave de ${provider} no es válida. Revísala en Bía › Conexión.`;
  if (status === 401 || status === 403) return `Tu clave de ${provider} fue rechazada (${status}). Verifica que esté activa en Bía › Conexión.`;
  if (status === 429) return `Se alcanzó el límite de uso gratuito de ${provider}. Espera unos segundos y pulsa Reintentar.`;
  return msg ? `${provider} (${status}): ${msg.slice(0, 110)}` : `Error ${status} al conectar con ${provider}.`;
}

/* ---------- Gemini ---------- */

/* Prefiere los modelos rápidos y estables; los de vista previa van después. */
function geminiModelScore(id) {
  if (id === 'gemini-2.5-flash') return 100;
  if (id === 'gemini-2.5-flash-lite') return 95;
  if (id.startsWith('gemini-2.5-flash') && !id.includes('preview')) return 90;
  if (id === 'gemini-3-flash-preview' || id === 'gemini-3.1-flash-lite-preview') return 88;
  if (id === 'gemini-flash-latest') return 85;
  if (id === 'gemini-2.0-flash') return 80;
  if (id === 'gemini-2.0-flash-lite') return 78;
  if (id === 'gemini-1.5-flash') return 75;
  if (id.includes('flash')) return 70;
  if (id.includes('pro')) return 50;
  return 30;
}

/** De la lista de modelos de la cuenta, los que sirven para leer fotos, mejores primero. */
export function pickGeminiModels(models = []) {
  const ids = models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => String(m.name || '').replace(/^models\//, ''))
    .filter((id) => id.startsWith('gemini-') && !GEMINI_EXCLUDED.some((x) => id.includes(x)));
  if (!ids.length) return GEMINI_FALLBACK_MODELS;
  return ids.sort((a, b) => geminiModelScore(b) - geminiModelScore(a)).slice(0, GEMINI_MODELS_TO_TRY);
}

const modelsByKey = new Map();

async function geminiModels(apiKey) {
  if (modelsByKey.has(apiKey)) return modelsByKey.get(apiKey);
  try {
    const res = await fetch(`${GEMINI_API}?key=${encodeURIComponent(apiKey)}`);
    if (!res.ok) return GEMINI_FALLBACK_MODELS;
    const models = pickGeminiModels((await res.json())?.models);
    modelsByKey.set(apiKey, models);
    return models;
  } catch {
    return GEMINI_FALLBACK_MODELS;
  }
}

/* El texto de la respuesta sin los «pensamientos» del modelo. */
function geminiReplyText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('\n')
    || parts.map((p) => p.text || '').join('\n');
}

/* Prueba los modelos en orden; una clave inválida o «no es comida» cortan la búsqueda. */
async function callGemini({ base64, mimeType, prompt }, apiKey) {
  const parts = [];
  if (base64) parts.push({ inline_data: { mime_type: mimeType || 'image/jpeg', data: base64 } });
  parts.push({ text: prompt });
  let lastError = null;
  for (const model of await geminiModels(apiKey)) {
    try {
      const res = await fetch(`${GEMINI_API}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: TEMPERATURE } }),
      });
      if (!res.ok) {
        const errText = await res.text();
        lastError = new Error(formatApiError('Gemini', res.status, errText));
        if (res.status === 400 && INVALID_KEY.test(errText)) lastError.code = 'BAD_KEY';
        if (lastError.code) throw lastError;
        continue;
      }
      return parseNutritionReply(geminiReplyText(await res.json()));
    } catch (err) {
      if (err?.code === 'NOT_FOOD' || err?.code === 'BAD_KEY') throw err;
      lastError = err;
    }
  }
  throw lastError || new Error('No se pudo analizar la comida con Gemini.');
}

/* ---------- OpenAI ---------- */

async function callOpenAI({ base64, mimeType, prompt }, apiKey) {
  const content = [{ type: 'text', text: prompt }];
  if (base64) {
    content.push({ type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${base64}`, detail: 'low' } });
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: TEMPERATURE,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) throw new Error(formatApiError('OpenAI', res.status, await res.text()));
  const data = await res.json();
  return parseNutritionReply(data?.choices?.[0]?.message?.content || '{}');
}

/* ---------- Elegir proveedor ---------- */

/** Orden de proveedores: el elegido en Conexión primero y el otro de respaldo, si tiene clave. */
export function providerOrder({ provider, geminiKey, openaiKey }) {
  const gemini = (geminiKey || '').trim() && { call: callGemini, key: geminiKey.trim() };
  const openai = (openaiKey || '').trim() && { call: callOpenAI, key: openaiKey.trim() };
  const order = provider === 'openai' ? [openai, gemini] : [gemini, openai];
  return order.filter(Boolean);
}

async function analyze(request) {
  const providers = providerOrder(await getAgentConfig());
  if (!providers.length) {
    const err = new Error('Configura tu clave en Bía › Conexión para analizar fotos con IA.');
    err.code = 'NO_API_KEY';
    throw err;
  }
  let lastError;
  for (const { call, key } of providers) {
    try {
      return await call(request, key);
    } catch (err) {
      if (err?.code === 'NOT_FOOD') throw err;
      lastError = err;
    }
  }
  throw lastError;
}

export async function analyzeMealImage({ base64, mimeType, userHint = '' }) {
  return analyze({ base64, mimeType, prompt: buildNutritionPrompt({ userHint }) });
}

/* Analiza una descripción escrita o hablada («me comí dos huevos y una arepa»).
 * Sin clave o si la IA falla, la lee el catálogo local. Nunca se inventa un plato. */
export async function analyzeMealText(text) {
  const clean = String(text || '').trim();
  if (!clean) return { plato: '', items: [] };
  try {
    return await analyze({ prompt: buildNutritionPrompt({ textPrompt: clean }) });
  } catch (err) {
    if (err?.code === 'NOT_FOOD') throw err;
    return parseMealTextLocally(clean);
  }
}
