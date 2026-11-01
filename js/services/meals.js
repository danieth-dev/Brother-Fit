/* Servicio de Nutrición y Escaneo de Comidas (Cal AI para Brother Fit).
 * Guarda únicamente datos numéricos y desglose de alimentos en IndexedDB (cero fotos persistidas).
 * Soporta análisis por foto con Gemini / OpenAI Vision, análisis por texto/voz y catálogo local. */

import { db } from '../db.js';
import { state } from '../store.js';
import { todayISO } from '../utils/dates.js';
import { getAgentConfig } from './agent.js';

export const MEAL_TYPES = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena'];

/* Catálogo local de alimentos frecuentes (valores por cada 100 g + porción típica en g). */
export const COMMON_FOODS = [
  { nombre: 'Papas en air fryer / horno', porcion: 180, kcal100: 115, p100: 2.5, c100: 24.0, g100: 1.2 },
  { nombre: 'Huevo frito / a la plancha', porcion: 60, kcal100: 196, p100: 13.6, c100: 0.8, g100: 14.8 },
  { nombre: 'Carne molida de res', porcion: 140, kcal100: 215, p100: 24.0, c100: 0.0, g100: 13.0 },
  { nombre: 'Arroz blanco cocido', porcion: 180, kcal100: 130, p100: 2.7, c100: 28.2, g100: 0.3 },
  { nombre: 'Pechuga de pollo', porcion: 140, kcal100: 165, p100: 31.0, c100: 0.0, g100: 3.6 },
  { nombre: 'Ensalada mixta', porcion: 90, kcal100: 28, p100: 1.4, c100: 4.5, g100: 0.4 },
  { nombre: 'Aceite de cocción / oliva', porcion: 5, kcal100: 884, p100: 0.0, c100: 0.0, g100: 100.0 },
  { nombre: 'Huevo entero cocido', porcion: 120, kcal100: 155, p100: 13.0, c100: 1.1, g100: 11.0 },
  { nombre: 'Arepa de maíz asada', porcion: 130, kcal100: 195, p100: 4.5, c100: 41.0, g100: 1.2 },
  { nombre: 'Avena en hojuelas', porcion: 60, kcal100: 389, p100: 16.9, c100: 66.3, g100: 6.9 },
  { nombre: 'Plátano / Banano', porcion: 120, kcal100: 89, p100: 1.1, c100: 22.8, g100: 0.3 },
  { nombre: 'Plátano macho maduro', porcion: 150, kcal100: 122, p100: 1.3, c100: 31.9, g100: 0.4 },
  { nombre: 'Leche entera', porcion: 240, kcal100: 61, p100: 3.2, c100: 4.8, g100: 3.3 },
  { nombre: 'Leche descremada', porcion: 240, kcal100: 35, p100: 3.4, c100: 5.0, g100: 0.1 },
  { nombre: 'Carne de res magra', porcion: 150, kcal100: 215, p100: 26.0, c100: 0.0, g100: 12.0 },
  { nombre: 'Atún al natural', porcion: 120, kcal100: 116, p100: 25.5, c100: 0.0, g100: 1.0 },
  { nombre: 'Salmón a la plancha', porcion: 150, kcal100: 208, p100: 20.4, c100: 0.0, g100: 13.4 },
  { nombre: 'Pasta cocida', porcion: 180, kcal100: 158, p100: 5.8, c100: 30.9, g100: 0.9 },
  { nombre: 'Papa / Patata cocida', porcion: 200, kcal100: 87, p100: 1.9, c100: 20.1, g100: 0.1 },
  { nombre: 'Batata / Camote asado', porcion: 180, kcal100: 90, p100: 2.0, c100: 20.7, g100: 0.2 },
  { nombre: 'Pan integral', porcion: 60, kcal100: 247, p100: 13.0, c100: 41.0, g100: 3.4 },
  { nombre: 'Aguacate / Palta', porcion: 80, kcal100: 160, p100: 2.0, c100: 8.5, g100: 14.7 },
  { nombre: 'Lentejas cocidas', porcion: 180, kcal100: 116, p100: 9.0, c100: 20.1, g100: 0.4 },
  { nombre: 'Frijoles / Caraotas cocidas', porcion: 160, kcal100: 127, p100: 8.7, c100: 22.8, g100: 0.5 },
  { nombre: 'Yogur griego natural', porcion: 170, kcal100: 97, p100: 9.0, c100: 3.9, g100: 5.0 },
  { nombre: 'Frutos secos / Almendras', porcion: 30, kcal100: 579, p100: 21.2, c100: 21.6, g100: 49.9 },
  { nombre: 'Mantequilla de maní', porcion: 25, kcal100: 588, p100: 25.0, c100: 20.0, g100: 50.0 },
  { nombre: 'Proteína Whey (1 scoop)', porcion: 30, kcal100: 390, p100: 78.0, c100: 8.0, g100: 5.0 },
  { nombre: 'Queso blanco / Mozzarella', porcion: 50, kcal100: 280, p100: 22.0, c100: 2.2, g100: 21.0 },
];

/* Calcula metas recomendadas según el peso del atleta (por defecto 49 kg) y su objetivo. */
export function calculateTargetsForGoal(objetivo = 'ganar', pesoKg = 49) {
  const w = Math.max(35, Math.min(180, Number(pesoKg) || 49));
  if (objetivo === 'definir') {
    const kcal = Math.round((w * 30) / 10) * 10;
    const proteina = Math.round(w * 2.2);
    const grasa = Math.round(w * 1.0);
    const carbos = Math.max(60, Math.round((kcal - proteina * 4 - grasa * 9) / 4));
    return { kcal, proteina, carbos, grasa, objetivo: 'definir' };
  }
  if (objetivo === 'mantener') {
    const kcal = Math.round((w * 36) / 10) * 10;
    const proteina = Math.round(w * 1.9);
    const grasa = Math.round(w * 1.2);
    const carbos = Math.max(80, Math.round((kcal - proteina * 4 - grasa * 9) / 4));
    return { kcal, proteina, carbos, grasa, objetivo: 'mantener' };
  }
  const kcal = Math.round((w * 43) / 10) * 10;
  const proteina = Math.round(w * 2.05);
  const grasa = Math.round(w * 1.35);
  const carbos = Math.max(100, Math.round((kcal - proteina * 4 - grasa * 9) / 4));
  return { kcal, proteina, carbos, grasa, objetivo: 'ganar' };
}

export function defaultMealTypeByHour(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 5 && h < 11.5) return 'Desayuno';
  if (h >= 11.5 && h < 16) return 'Almuerzo';
  if (h >= 16 && h < 19.5) return 'Merienda';
  return 'Cena';
}

export function currentTimeHHMM(d = new Date()) {
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function stepForGrams(g) {
  const val = Number(g) || 0;
  if (val <= 25) return 5;
  if (val <= 90) return 10;
  return 20;
}

/* Normaliza un ingrediente para que conserve su densidad nutricional por cada 100 g
 * y permita recalcular sin pérdida de precisión al subir/bajar gramos. */
export function normalizeMealItem(raw) {
  const gramos = Math.max(0, Math.round(Number(raw.gramos) || 100));
  const baseG = gramos > 0 ? gramos : 100;
  const kcal = Math.max(0, Math.round(Number(raw.kcal) || 0));
  const proteina = Math.max(0, Math.round((Number(raw.proteina) || 0) * 10) / 10);
  const carbos = Math.max(0, Math.round((Number(raw.carbos) || 0) * 10) / 10);
  const grasa = Math.max(0, Math.round((Number(raw.grasa) || 0) * 10) / 10);

  const kcal100 = raw.kcal100 != null ? Number(raw.kcal100) : (kcal / baseG) * 100;
  const p100 = raw.p100 != null ? Number(raw.p100) : (proteina / baseG) * 100;
  const c100 = raw.c100 != null ? Number(raw.c100) : (carbos / baseG) * 100;
  const g100 = raw.g100 != null ? Number(raw.g100) : (grasa / baseG) * 100;

  return {
    nombre: String(raw.nombre || 'Alimento').trim(),
    gramos,
    kcal: Math.round((kcal100 * gramos) / 100),
    proteina: Math.round(((p100 * gramos) / 100) * 10) / 10,
    carbos: Math.round(((c100 * gramos) / 100) * 10) / 10,
    grasa: Math.round(((g100 * gramos) / 100) * 10) / 10,
    kcal100,
    p100,
    c100,
    g100,
  };
}

export function recalcItemGrams(item, newGrams) {
  const normalized = normalizeMealItem(item);
  const g = Math.max(0, Math.round(Number(newGrams) || 0));
  return {
    ...normalized,
    gramos: g,
    kcal: Math.round((normalized.kcal100 * g) / 100),
    proteina: Math.round(((normalized.p100 * g) / 100) * 10) / 10,
    carbos: Math.round(((normalized.c100 * g) / 100) * 10) / 10,
    grasa: Math.round(((normalized.g100 * g) / 100) * 10) / 10,
  };
}

export function buildItemFromCatalog(food, customGrams) {
  const g = customGrams != null ? Number(customGrams) : food.porcion;
  return recalcItemGrams(
    {
      nombre: food.nombre,
      gramos: g,
      kcal100: food.kcal100,
      p100: food.p100,
      c100: food.c100,
      g100: food.g100,
    },
    g
  );
}

export function summarizeItems(items = []) {
  let kcal = 0;
  let proteina = 0;
  let carbos = 0;
  let grasa = 0;
  for (const it of items) {
    kcal += Number(it.kcal) || 0;
    proteina += Number(it.proteina) || 0;
    carbos += Number(it.carbos) || 0;
    grasa += Number(it.grasa) || 0;
  }
  return {
    kcal: Math.round(kcal),
    proteina: Math.round(proteina),
    carbos: Math.round(carbos),
    grasa: Math.round(grasa),
  };
}

export function buildMealTitle(items = [], fallback = 'Comida registrada') {
  const names = items.filter((i) => i.gramos > 0 && i.nombre).map((i) => i.nombre.trim());
  if (!names.length) return fallback;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} y ${names[1].toLowerCase()}`;
  return `${names[0]}, ${names[1].toLowerCase()} y ${names[2].toLowerCase()}`;
}

export function getNutritionTargets() {
  const s = state.settings || {};
  return {
    kcal: Number(s.metaKcal) || 2400,
    proteina: Number(s.metaProteina) || 120,
    carbos: Number(s.metaCarbos) || 300,
    grasa: Number(s.metaGrasa) || 80,
    objetivo: s.metaObjetivo || 'ganar',
  };
}

export async function listMealsByDate(fecha = todayISO()) {
  const rows = await db.byIndex('meals', 'fecha', fecha);
  return rows.sort((a, b) => (a.ts || 0) - (b.ts || 0));
}

export async function getMealById(id) {
  return db.get('meals', Number(id));
}

export async function saveMeal(entry) {
  const items = (entry.items || []).map(normalizeMealItem).filter((i) => i.gramos > 0);
  const totals = items.length
    ? summarizeItems(items)
    : {
        kcal: Math.round(Number(entry.kcal) || 0),
        proteina: Math.round(Number(entry.proteina) || 0),
        carbos: Math.round(Number(entry.carbos) || 0),
        grasa: Math.round(Number(entry.grasa) || 0),
      };

  const tipo = MEAL_TYPES.includes(entry.tipo) ? entry.tipo : defaultMealTypeByHour();
  const nombre = (entry.nombre || '').trim() || buildMealTitle(items, tipo);

  const record = {
    fecha: entry.fecha || todayISO(),
    ts: entry.ts || Date.now(),
    hora: entry.hora || currentTimeHHMM(),
    tipo,
    nombre,
    kcal: totals.kcal,
    proteina: totals.proteina,
    carbos: totals.carbos,
    grasa: totals.grasa,
    items,
    origen: entry.origen || 'foto',
  };

  if (entry.id != null) {
    record.id = Number(entry.id);
    await db.put('meals', record);
    return record.id;
  }
  return db.add('meals', record);
}

export async function deleteMeal(id) {
  return db.remove('meals', Number(id));
}

export async function todayMealsSummary(fecha = todayISO()) {
  const meals = await listMealsByDate(fecha);
  const targets = getNutritionTargets();
  const totals = summarizeItems(meals);

  const pct = {
    kcal: targets.kcal > 0 ? Math.min(100, Math.round((totals.kcal / targets.kcal) * 100)) : 0,
    proteina: targets.proteina > 0 ? Math.min(100, Math.round((totals.proteina / targets.proteina) * 100)) : 0,
    carbos: targets.carbos > 0 ? Math.min(100, Math.round((totals.carbos / targets.carbos) * 100)) : 0,
    grasa: targets.grasa > 0 ? Math.min(100, Math.round((totals.grasa / targets.grasa) * 100)) : 0,
  };

  return {
    fecha,
    meals,
    totals,
    targets,
    pct,
    remainingKcal: Math.max(0, targets.kcal - totals.kcal),
    surplusKcal: Math.max(0, totals.kcal - targets.kcal),
  };
}

/* Comprime una imagen en el navegador a JPEG <= 800px (~50 KB) para que la llamada Vision
 * sea ultrarrápida (~1.5–2.5 s) y económica (~250 tokens). No se guarda en base de datos. */
export function compressImageFile(file, maxDim = 800, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No se seleccionó ninguna imagen.'));
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.split(',')[1] || '';
        resolve({ base64, mimeType: 'image/jpeg', previewUrl, width, height });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
    img.src = previewUrl;
  });
}

const NUTRITION_PROMPT = `Eres el nutricionista deportivo de Brother Fit.
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

function extractParsedItems(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (Array.isArray(parsed)) return parsed;
  const arr = parsed.items || parsed.ingredientes || parsed.alimentos;
  return Array.isArray(arr) ? arr : null;
}

/* Autodescubrimiento de modelos Gemini con soporte generateContent en la cuenta del usuario. */
const cachedModelsByKey = new Map();

async function discoverGeminiVisionModels(apiKey) {
  const fallback = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-flash-latest',
  ];
  if (cachedModelsByKey.has(apiKey)) {
    return cachedModelsByKey.get(apiKey);
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
    if (!res.ok) return fallback;
    const data = await res.json();
    const available = (data?.models || [])
      .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map((m) => String(m.name || '').replace(/^models\//, ''))
      .filter((id) => (
        id.startsWith('gemini-') &&
        !id.includes('tts') &&
        !id.includes('embedding') &&
        !id.includes('imagen') &&
        !id.includes('veo') &&
        !id.includes('aqa') &&
        !id.includes('audio') &&
        !id.includes('robotics') &&
        !id.includes('computer-use')
      ));

    if (!available.length) return fallback;

    const scoreModel = (id) => {
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
    };

    available.sort((a, b) => scoreModel(b) - scoreModel(a));
    const topModels = available.slice(0, 5);
    cachedModelsByKey.set(apiKey, topModels);
    return topModels;
  } catch {
    return fallback;
  }
}

function formatApiError(provider, status, rawText) {
  let msg = '';
  try {
    const parsed = JSON.parse(rawText);
    msg = parsed?.error?.message || '';
  } catch {
    msg = String(rawText || '').slice(0, 140);
  }
  if (status === 400 && /api_key_invalid|key not valid/i.test(msg)) {
    return `Tu API Key de ${provider} no es válida. Revísala en el panel de Fit.`;
  }
  if (status === 401 || status === 403) {
    return `Tu API Key de ${provider} fue rechazada (${status}). Verifica que esté activa en Fit.`;
  }
  if (status === 429) {
    return `Se alcanzó el límite de cuota gratuita de ${provider} (429). Espera unos segundos y pulsa Reintentar.`;
  }
  return msg ? `${provider} (${status}): ${msg.slice(0, 110)}` : `Error ${status} al conectar con ${provider}.`;
}

async function callGeminiNutrition({ base64, mimeType, textPrompt, userHint }, apiKey) {
  const models = await discoverGeminiVisionModels(apiKey);
  let lastError = null;

  let promptText = NUTRITION_PROMPT;
  if (userHint) {
    promptText += `\n\nACLARACIÓN IMPORTANTE DEL ATLETA SOBRE ESTE PLATO: "${userHint}". Respeta esta aclaración al identificar los ingredientes, el método de cocción (ej. air fryer = sin aceite extra) y las calorías.`;
  }
  if (textPrompt) {
    promptText += `\n\nDescripción del plato a analizar: "${textPrompt}"`;
  }

  const parts = [];
  if (base64) {
    parts.push({ inline_data: { mime_type: mimeType || 'image/jpeg', data: base64 } });
  }
  parts.push({ text: promptText });

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.15,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        const friendly = formatApiError('Gemini', res.status, errText);
        const err = new Error(friendly);
        err.userMessage = friendly;
        err.status = res.status;
        lastError = err;
        if (res.status === 400 && /api_key_invalid|key not valid/i.test(errText)) {
          throw err;
        }
        continue;
      }

      const data = await res.json();
      const candParts = data?.candidates?.[0]?.content?.parts || [];
      const nonThoughtText = candParts
        .filter((p) => !p.thought && typeof p.text === 'string')
        .map((p) => p.text)
        .join('\n') || candParts.map((p) => p.text || '').join('\n');

      const parsed = extractJsonObject(nonThoughtText);
      const rawItems = extractParsedItems(parsed);

      if (parsed && (parsed.esComida === false || (Array.isArray(rawItems) && rawItems.length === 0))) {
        const notFoodErr = new Error(parsed.motivo || 'No detecté comida ni bebida en la foto.');
        notFoodErr.code = 'NOT_FOOD';
        throw notFoodErr;
      }
      if (rawItems && rawItems.length > 0) {
        return {
          plato: parsed.plato || buildMealTitle(rawItems),
          items: rawItems.map(normalizeMealItem),
        };
      }
    } catch (err) {
      if (err?.code === 'NOT_FOOD') throw err;
      lastError = err;
    }
  }
  throw lastError || new Error('No se pudo analizar la comida con Gemini.');
}

async function callOpenAINutrition({ base64, mimeType, textPrompt, userHint }, apiKey) {
  let promptText = NUTRITION_PROMPT;
  if (userHint) {
    promptText += `\n\nACLARACIÓN IMPORTANTE DEL ATLETA: "${userHint}"`;
  }
  if (textPrompt) {
    promptText += `\n\nDescripción: "${textPrompt}"`;
  }

  const content = [{ type: 'text', text: promptText }];
  if (base64) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${base64}`, detail: 'low' },
    });
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.15,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    const friendly = formatApiError('OpenAI', res.status, errText);
    const err = new Error(friendly);
    err.userMessage = friendly;
    throw err;
  }

  const data = await res.json();
  const parsed = extractJsonObject(data?.choices?.[0]?.message?.content || '{}');
  const rawItems = extractParsedItems(parsed);

  if (parsed && (parsed.esComida === false || (Array.isArray(rawItems) && rawItems.length === 0))) {
    const notFoodErr = new Error(parsed.motivo || 'No detecté comida ni bebida en la foto.');
    notFoodErr.code = 'NOT_FOOD';
    throw notFoodErr;
  }
  if (rawItems && rawItems.length > 0) {
    return {
      plato: parsed.plato || buildMealTitle(rawItems),
      items: rawItems.map(normalizeMealItem),
    };
  }
  throw new Error('OpenAI no devolvió ingredientes válidos.');
}

/* Ejemplo por defecto cuando se abre en modo demostración sin foto. */
export function getDemoPhotoResult() {
  const items = [
    normalizeMealItem({ nombre: 'Papas en air fryer', gramos: 180, kcal: 207, proteina: 4.5, carbos: 43.2, grasa: 2.2 }),
    normalizeMealItem({ nombre: 'Huevo frito', gramos: 60, kcal: 118, proteina: 8.2, carbos: 0.5, grasa: 8.9 }),
    normalizeMealItem({ nombre: 'Carne molida de res', gramos: 130, kcal: 280, proteina: 31.2, carbos: 0, grasa: 16.9 }),
  ];
  return {
    plato: 'Papas en air fryer, huevo frito y carne molida',
    items,
    isDemo: true,
  };
}

export async function analyzeMealImage({ base64, mimeType, userHint = '' }) {
  const cfg = await getAgentConfig();
  const geminiKey = (cfg.geminiKey || '').trim();
  const openaiKey = (cfg.openaiKey || '').trim();

  if (cfg.provider === 'openai' && openaiKey) {
    try {
      return await callOpenAINutrition({ base64, mimeType, userHint }, openaiKey);
    } catch (err) {
      if (err?.code === 'NOT_FOOD') throw err;
      if (geminiKey) return callGeminiNutrition({ base64, mimeType, userHint }, geminiKey);
      throw err;
    }
  }
  if (geminiKey) {
    try {
      return await callGeminiNutrition({ base64, mimeType, userHint }, geminiKey);
    } catch (err) {
      if (err?.code === 'NOT_FOOD') throw err;
      if (openaiKey) return callOpenAINutrition({ base64, mimeType, userHint }, openaiKey);
      throw err;
    }
  }
  if (openaiKey) {
    return callOpenAINutrition({ base64, mimeType, userHint }, openaiKey);
  }

  const err = new Error('Configura tu API Key en Fit para analizar fotos con IA.');
  err.code = 'NO_API_KEY';
  throw err;
}

/* Analiza una descripción escrita o hablada ("me comí dos huevos y una arepa") */
export async function analyzeMealText(text) {
  const clean = String(text || '').trim();
  if (!clean) return getDemoPhotoResult();

  const cfg = await getAgentConfig();
  const geminiKey = (cfg.geminiKey || '').trim();
  const openaiKey = (cfg.openaiKey || '').trim();

  try {
    if (cfg.provider === 'openai' && openaiKey) {
      return await callOpenAINutrition({ textPrompt: clean }, openaiKey);
    }
    if (geminiKey) {
      return await callGeminiNutrition({ textPrompt: clean }, geminiKey);
    }
    if (openaiKey) {
      return await callOpenAINutrition({ textPrompt: clean }, openaiKey);
    }
  } catch (e) {
    if (e?.code === 'NOT_FOOD') throw e;
    console.warn('Fallback a parser local de alimentos:', e);
  }

  /* Parser local inteligente sobre COMMON_FOODS si no hay red o API key */
  const lower = clean.toLowerCase();
  const matched = [];
  for (const food of COMMON_FOODS) {
    const keywords = food.nombre
      .toLowerCase()
      .split(/[\s/]+/)
      .filter((w) => w.length > 3 && !['cocido', 'cocida', 'natural', 'entera', 'entero', 'horno', 'plancha'].includes(w));
    if (keywords.some((kw) => lower.includes(kw))) {
      const regex = new RegExp(`(\\d+)\\s*(?:g|gr|gramos)?\\s*(?:de\\s+)?${keywords[0]}`, 'i');
      const m = clean.match(regex);
      const grams = m ? Number(m[1]) : food.porcion;
      matched.push(buildItemFromCatalog(food, grams));
    }
  }

  if (matched.length > 0) {
    return {
      plato: buildMealTitle(matched, clean),
      items: matched,
    };
  }

  return getDemoPhotoResult();
}

/* Devuelve un bloque de texto estructurado con el diario de comidas de hoy para Fit. */
export async function getMealsContextForFit() {
  try {
    const s = await todayMealsSummary(todayISO());
    const protFalta = Math.max(0, s.targets.proteina - s.totals.proteina);
    const lines = [
      `\n\nNUTRICIÓN Y COMIDAS DE HOY (${s.fecha}):`,
      `- Meta diaria (${s.targets.objetivo}): ${s.targets.kcal} kcal · Proteína ${s.targets.proteina} g · Carbohidratos ${s.targets.carbos} g · Grasa ${s.targets.grasa} g.`,
      `- Consumido hoy: ${s.totals.kcal} kcal · Proteína ${s.totals.proteina} g · Carbohidratos ${s.totals.carbos} g · Grasa ${s.totals.grasa} g.`,
      `- Restante hoy: ${s.remainingKcal} kcal y ${protFalta} g de proteína para llegar a la meta.`,
    ];
    if (s.meals.length === 0) {
      lines.push('- Comidas registradas hoy: Ninguna todavía.');
    } else {
      lines.push('- Comidas registradas hoy:');
      for (const m of s.meals) {
        const itemsDesc = (m.items || []).map((i) => `${i.nombre} ${i.gramos}g`).join(', ');
        lines.push(`  * [ID ${m.id}] ${m.hora} · ${m.tipo}: ${m.nombre} — ${m.kcal} kcal, Proteína ${m.proteina} g${itemsDesc ? ` (${itemsDesc})` : ''}.`);
      }
    }
    return lines.join('\n');
  } catch {
    return '';
  }
}

