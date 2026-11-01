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
  { nombre: 'Arroz blanco cocido', porcion: 180, kcal100: 130, p100: 2.7, c100: 28.2, g100: 0.3 },
  { nombre: 'Pechuga de pollo', porcion: 140, kcal100: 165, p100: 31.0, c100: 0.0, g100: 3.6 },
  { nombre: 'Ensalada mixta', porcion: 90, kcal100: 28, p100: 1.4, c100: 4.5, g100: 0.4 },
  { nombre: 'Aceite de oliva', porcion: 10, kcal100: 884, p100: 0.0, c100: 0.0, g100: 100.0 },
  { nombre: 'Huevo entero cocido', porcion: 120, kcal100: 155, p100: 13.0, c100: 1.1, g100: 11.0 },
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
  { nombre: 'Arepa de maíz asada', porcion: 130, kcal100: 195, p100: 4.5, c100: 41.0, g100: 1.2 },
  { nombre: 'Aguacate / Palta', porcion: 80, kcal100: 160, p100: 2.0, c100: 8.5, g100: 14.7 },
  { nombre: 'Lentejas cocidas', porcion: 180, kcal100: 116, p100: 9.0, c100: 20.1, g100: 0.4 },
  { nombre: 'Frijoles / Caraotas cocidas', porcion: 160, kcal100: 127, p100: 8.7, c100: 22.8, g100: 0.5 },
  { nombre: 'Yogur griego natural', porcion: 170, kcal100: 97, p100: 9.0, c100: 3.9, g100: 5.0 },
  { nombre: 'Frutos secos / Almendras', porcion: 30, kcal100: 579, p100: 21.2, c100: 21.6, g100: 49.9 },
  { nombre: 'Mantequilla de maní', porcion: 25, kcal100: 588, p100: 25.0, c100: 20.0, g100: 50.0 },
  { nombre: 'Proteína Whey (1 scoop)', porcion: 30, kcal100: 390, p100: 78.0, c100: 8.0, g100: 5.0 },
  { nombre: 'Queso blanco / Mozzarella', porcion: 50, kcal100: 280, p100: 22.0, c100: 2.2, g100: 21.0 },
];

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

/* Comprime una imagen en el navegador a JPEG <= 1024px para que la llamada Vision
 * sea rápida (~1.5 s) y económica (~250 tokens). No se guarda en base de datos. */
export function compressImageFile(file, maxDim = 1024, quality = 0.76) {
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
Analiza el plato de comida y devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta:
{
  "plato": "Nombre corto del plato en español",
  "items": [
    {
      "nombre": "Nombre del ingrediente en español (ej. Arroz blanco, Pechuga de pollo, Ensalada mixta, Aceite de oliva)",
      "gramos": 180,
      "kcal": 234,
      "proteina": 5,
      "carbos": 50,
      "grasa": 1
    }
  ]
}
Reglas:
1. Estima pesos realistas en gramos para las porciones visibles en el plato.
2. Si es un plato cocinado, incluye una estimación prudente del aceite o grasa de cocción (ej. Aceite de oliva 10 g).
3. Asegúrate de que las kcal y macros (proteina, carbos, grasa) sean nutricionalmente coherentes con los gramos indicados.`;

function extractJsonObject(raw) {
  const cleaned = String(raw || '').replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Respuesta sin JSON válido.');
  }
}

async function callGeminiNutrition({ base64, mimeType, textPrompt }, apiKey) {
  const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-flash-latest'];
  let lastError = null;

  const parts = [];
  if (base64) {
    parts.push({ inlineData: { mimeType: mimeType || 'image/jpeg', data: base64 } });
  }
  parts.push({
    text: textPrompt
      ? `${NUTRITION_PROMPT}\n\nDescripción del usuario: "${textPrompt}"`
      : NUTRITION_PROMPT,
  });

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        lastError = new Error(`Gemini (${res.status}): ${errText.slice(0, 120)}`);
        continue;
      }

      const data = await res.json();
      const candParts = data?.candidates?.[0]?.content?.parts || [];
      const nonThoughtText = candParts
        .filter((p) => !p.thought && typeof p.text === 'string')
        .map((p) => p.text)
        .join('\n') || candParts.map((p) => p.text || '').join('\n');

      const parsed = extractJsonObject(nonThoughtText);
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        return {
          plato: parsed.plato || buildMealTitle(parsed.items),
          items: parsed.items.map(normalizeMealItem),
        };
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('No se pudo analizar la comida con Gemini.');
}

async function callOpenAINutrition({ base64, mimeType, textPrompt }, apiKey) {
  const content = [{ type: 'text', text: textPrompt ? `${NUTRITION_PROMPT}\n\nDescripción: "${textPrompt}"` : NUTRITION_PROMPT }];
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
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI (${res.status})`);
  }

  const data = await res.json();
  const parsed = extractJsonObject(data?.choices?.[0]?.message?.content || '{}');
  if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
    return {
      plato: parsed.plato || buildMealTitle(parsed.items),
      items: parsed.items.map(normalizeMealItem),
    };
  }
  throw new Error('OpenAI no devolvió ingredientes válidos.');
}

/* Ejemplo por defecto (Arroz, pechuga, ensalada y aceite) cuando se abre en modo demostración. */
export function getDemoPhotoResult() {
  const items = [
    normalizeMealItem({ nombre: 'Arroz blanco', gramos: 180, kcal: 234, proteina: 4.9, carbos: 50.8, grasa: 0.5 }),
    normalizeMealItem({ nombre: 'Pechuga de pollo', gramos: 140, kcal: 231, proteina: 43.4, carbos: 0, grasa: 5.0 }),
    normalizeMealItem({ nombre: 'Ensalada mixta', gramos: 90, kcal: 25, proteina: 1.3, carbos: 4.1, grasa: 0.4 }),
    normalizeMealItem({ nombre: 'Aceite de oliva', gramos: 10, kcal: 88, proteina: 0, carbos: 0, grasa: 10.0 }),
  ];
  return {
    plato: 'Arroz, pollo y ensalada',
    items,
    isDemo: true,
  };
}

export async function analyzeMealImage({ base64, mimeType }) {
  const cfg = await getAgentConfig();
  const geminiKey = (cfg.geminiKey || '').trim();
  const openaiKey = (cfg.openaiKey || '').trim();

  if (cfg.provider === 'openai' && openaiKey) {
    try {
      return await callOpenAINutrition({ base64, mimeType }, openaiKey);
    } catch (err) {
      if (geminiKey) return callGeminiNutrition({ base64, mimeType }, geminiKey);
      throw err;
    }
  }
  if (geminiKey) {
    try {
      return await callGeminiNutrition({ base64, mimeType }, geminiKey);
    } catch (err) {
      if (openaiKey) return callOpenAINutrition({ base64, mimeType }, openaiKey);
      throw err;
    }
  }
  if (openaiKey) {
    return callOpenAINutrition({ base64, mimeType }, openaiKey);
  }

  const err = new Error('Configura tu API Key en Fit para analizar fotos con IA.');
  err.code = 'NO_API_KEY';
  throw err;
}

/* Analiza una descripción escrita o hablada ("200g de arroz con 150g de pollo y 2 huevos") */
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
    console.warn('Fallback a parser local de alimentos:', e);
  }

  /* Parser local inteligente sobre COMMON_FOODS si no hay red o API key */
  const lower = clean.toLowerCase();
  const matched = [];
  for (const food of COMMON_FOODS) {
    const keywords = food.nombre.toLowerCase().split(/[\s/]+/).filter((w) => w.length > 3 && !['cocido', 'cocida', 'natural', 'entera', 'entero'].includes(w));
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

