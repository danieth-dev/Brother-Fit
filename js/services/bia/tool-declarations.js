/* Herramientas que Bía puede pedir al modelo: nombre, descripción y parámetros.
 * Solo datos. Lo que hace cada una está en tools.js. */

export const TOOL_DECLARATIONS = [
  {
    name: 'consultar_entrenamientos',
    description:
      'Lee el registro real de entrenamientos en el teléfono. Úsala SIEMPRE que el atleta pregunte qué hizo ayer, qué entrenó hoy, cuándo fue su último entreno, o pida detalles de ejercicios, series o marcas de sesiones pasadas.',
    parameters: {
      type: 'OBJECT',
      properties: {
        dia: {
          type: 'STRING',
          description: 'ayer, hoy, anteayer, o el grupo muscular consultado (ej. espalda, pierna). Dejar vacío para el más reciente.',
        },
      },
    },
  },
  {
    name: 'registrar_serie',
    description:
      'Registra una serie en el entrenamiento en curso. Úsala cuando el atleta diga las repeticiones y el peso que acaba de hacer. El esfuerzo, si lo dice, responde a «¿Cuántas repeticiones más podrías haber hecho?». No uses RPE.',
    parameters: {
      type: 'OBJECT',
      properties: {
        reps: { type: 'NUMBER', description: 'Número de repeticiones completadas.' },
        ejercicio: { type: 'STRING', description: 'Nombre del ejercicio si el atleta lo dice, con sus palabras. Si no lo dice, no lo envíes: se usa el de la pantalla. No inventes ni elijas un id.' },
        peso: { type: 'NUMBER', description: 'Peso añadido. Si no se indica, usa el de la serie anterior de ese ejercicio. Nunca el peso de la báscula.' },
        corporal: { type: 'BOOLEAN', description: 'True si dice peso corporal o sin peso extra. El peso añadido queda en 0, salvo que también diga un disco o unos kilos: entonces peso es solo ese número.' },
        tipo: { type: 'STRING', description: 'trabajo o calentamiento. Si no lo dice, es trabajo.' },
        rir: { type: 'NUMBER', description: 'Respuesta a «¿Cuántas repeticiones más podrías haber hecho?»: 0 es no salía otra, 1, 2, 3, o 4 o más. No conviertas un RPE a este número.' },
      },
      required: ['reps'],
    },
  },
  {
    name: 'usar_ejercicio',
    description:
      'Deja Entreno en el ejercicio que el atleta nombra, sin anotar una serie. Úsala en cuanto diga cuál va a hacer, antes de las repeticiones. No confirma el de la pantalla.',
    parameters: {
      type: 'OBJECT',
      properties: {
        ejercicio: { type: 'STRING', description: 'Nombre dicho por el atleta, con sus palabras. No inventes otro.' },
      },
      required: ['ejercicio'],
    },
  },
  {
    name: 'anotar_rpe',
    description:
      'Anota la respuesta a «¿Cuántas repeticiones más podrías haber hecho?» en la pregunta abierta. No crea series y no elige cuál: la marca lo dice. No resta ni convierte a RPE.',
    parameters: {
      type: 'OBJECT',
      properties: {
        marca: { type: 'NUMBER', description: 'La marca de la pregunta vigente. No reutilices una marca anterior.' },
        rir: { type: 'NUMBER', description: 'Respuesta a «¿Cuántas repeticiones más podrías haber hecho?»: 0 es no salía otra, 1, 2, 3, o 4 o más.' },
        omitir: { type: 'BOOLEAN', description: 'True solo si el atleta dice que no sabe. No anota esfuerzo.' },
      },
      required: ['marca'],
    },
  },
  {
    name: 'consultar_creatina',
    description:
      'Lee el registro real de creatina en el teléfono. Úsala antes de contestar si el atleta pregunta por la toma de hoy, la racha, la saturación o qué día falló.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'registrar_creatina',
    description:
      'Marca o desmarca la toma de creatina de hoy en la base de datos real (tabla supplements). Úsala cuando el atleta diga "ya tomé la creatina", "anótame la creatina" o pida desmarcarla.',
    parameters: {
      type: 'OBJECT',
      properties: {
        accion: {
          type: 'STRING',
          description: 'registrar (por defecto) para anotar la toma de hoy, o deshacer para borrar la toma de hoy.',
        },
        gramos: {
          type: 'NUMBER',
          description: 'Gramos de la dosis (por defecto 5).',
        },
      },
    },
  },
  {
    name: 'registrar_peso_corporal',
    description:
      'Registra el peso corporal del atleta en la gráfica de Progreso (tabla bodyMetrics) y actualiza su perfil. Úsala SIEMPRE que el atleta diga cuánto pesó hoy o pida registrar su peso corporal. NUNCA uses guardar_recuerdo para anotar pesadas.',
    parameters: {
      type: 'OBJECT',
      properties: {
        peso: {
          type: 'NUMBER',
          description: 'Peso corporal en la unidad activa del atleta (ej. 72.4).',
        },
        fecha: {
          type: 'STRING',
          description: 'Fecha opcional en formato YYYY-MM-DD (por defecto hoy).',
        },
      },
      required: ['peso'],
    },
  },
  {
    name: 'gestionar_entrenamiento',
    description:
      'Inicia una nueva sesión de entrenamiento o finaliza la sesión activa en curso. Úsala cuando el atleta pida empezar a entrenar o diga que ya terminó su entrenamiento.',
    parameters: {
      type: 'OBJECT',
      properties: {
        accion: {
          type: 'STRING',
          description: 'iniciar para abrir el entrenamiento de hoy, o finalizar para cerrar el entrenamiento en curso y obtener el resumen.',
        },
      },
      required: ['accion'],
    },
  },
  {
    name: 'consultar_progreso_ejercicio',
    description:
      'Consulta el récord histórico (PR de peso máximo, repeticiones y 1RM estimado), la última sesión realizada (sin importar hace cuántas semanas fue) y la tendencia de un ejercicio específico.',
    parameters: {
      type: 'OBJECT',
      properties: {
        ejercicio: {
          type: 'STRING',
          description: 'Nombre del ejercicio a consultar (ej. press inclinado, curl martillo, sentadilla).',
        },
      },
      required: ['ejercicio'],
    },
  },
  {
    name: 'guardar_recuerdo',
    description:
      'Guarda una preferencia o un dato personal cualitativo (molestias, lesiones, técnica, objetivos, horarios). NO la uses para peso corporal (usa registrar_peso_corporal), ni para creatina de hoy (usa registrar_creatina), ni para comidas (usa registrar_comida).',
    parameters: {
      type: 'OBJECT',
      properties: {
        contenido: {
          type: 'STRING',
          description: 'El dato o preferencia a recordar de forma concisa.',
        },
      },
      required: ['contenido'],
    },
  },
  {
    name: 'listar_recuerdos',
    description: 'Lista todos los recuerdos guardados del usuario.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'borrar_recuerdo',
    description: 'Elimina un recuerdo específico por su ID numérico.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: { type: 'NUMBER', description: 'ID del recuerdo a borrar.' },
      },
      required: ['id'],
    },
  },
  {
    name: 'consultar_comidas',
    description:
      'Consulta el diario de comidas (hoy, ayer, los últimos 7 días de la semana o una fecha YYYY-MM-DD), las calorías y proteínas consumidas y cuánto falta para la meta.',
    parameters: {
      type: 'OBJECT',
      properties: {
        periodo: {
          type: 'STRING',
          description: 'hoy (por defecto), ayer, semana (últimos 7 días con promedios) o una fecha YYYY-MM-DD.',
        },
      },
    },
  },
  {
    name: 'registrar_comida',
    description:
      'Registra una comida en el diario nutricional de hoy cuando el atleta diga qué comió o pida anotar una comida con sus calorías y proteínas estimadas.',
    parameters: {
      type: 'OBJECT',
      properties: {
        plato: { type: 'STRING', description: 'Nombre del plato o alimentos (ej. Papas en air fryer, huevo frito y carne molida).' },
        tipo: { type: 'STRING', description: 'Desayuno, Almuerzo, Merienda o Cena.' },
        kcal: { type: 'NUMBER', description: 'Calorías totales estimadas.' },
        proteina: { type: 'NUMBER', description: 'Gramos de proteína estimados.' },
        carbos: { type: 'NUMBER', description: 'Gramos de carbohidratos estimados.' },
        grasa: { type: 'NUMBER', description: 'Gramos de grasa estimados.' },
      },
      required: ['plato', 'kcal', 'proteina'],
    },
  },
  {
    name: 'corregir_comida',
    description:
      'Corrige o borra una comida ya registrada hoy (por ejemplo si el atleta dice "eso eran papas en air fryer", "cambia el almuerzo a 500 kcal" o "borra la última comida").',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: { type: 'NUMBER', description: 'ID de la comida a modificar o borrar. Si no se indica, se usa la última comida de hoy.' },
        borrar: { type: 'BOOLEAN', description: 'True para eliminar la comida del diario.' },
        plato: { type: 'STRING', description: 'Nuevo nombre o descripción corregida del plato.' },
        kcal: { type: 'NUMBER', description: 'Nuevas calorías totales estimadas.' },
        proteina: { type: 'NUMBER', description: 'Nuevos gramos de proteína.' },
        carbos: { type: 'NUMBER', description: 'Nuevos gramos de carbohidratos.' },
        grasa: { type: 'NUMBER', description: 'Nuevos gramos de grasa.' },
      },
    },
  },
];
