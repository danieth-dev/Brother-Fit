# Política de privacidad de Bía — BORRADOR

> **Borrador para revisar antes de publicar.** No es asesoría legal. Faltan los datos marcados con `[ ]` y elegir la sección 4A o 4B según cómo accedan los usuarios a la IA. Cuando esté lista, se publica como página en una dirección pública fija (Play Console la pide), se pone esa dirección en `js/app-info.js` → `privacyUrl` y se añade la página a la copia de `.github/workflows/deploy.yml`.
>
> Escrita a partir de lo que hace la app en la `v190`. Si cambia lo que se guarda o lo que se envía, esta política se actualiza en el mismo cambio (ver `AGENTS.md`).

**Última actualización:** [fecha]
**Responsable:** [nombre o razón social del editor], [país]
**Contacto:** [correo de soporte]

## 1. Resumen

- Bía no tiene cuentas de usuario, ni publicidad, ni analítica, ni rastreo.
- Tus entrenos, tu creatina, tu peso, tus comidas y lo que Bía recuerda de ti se guardan **solo en tu teléfono**.
- Cuando usas a la asistente Bía o el análisis de comidas, una parte de esa información se envía a un proveedor de inteligencia artificial (Google u OpenAI) para generar la respuesta. Abajo se explica qué se envía y cuándo.
- Puedes borrar todo desde la app en cualquier momento.

## 2. Qué se guarda en tu teléfono

Todo vive en el almacenamiento del navegador de la app (IndexedDB) en tu dispositivo. El editor de Bía no tiene copia.

| Dato | Para qué |
| --- | --- |
| Entrenamientos, series (peso, repeticiones, tipo, esfuerzo), ejercicios propios | Registro, historial y progreso |
| Tomas de creatina | Racha, calendario y saturación |
| Peso corporal | Gráfica de progreso y metas de comida |
| Comidas: nombre, alimentos, gramos, calorías y macros | Diario de nutrición. **Las fotos no se guardan.** |
| Perfil (nombre, peso, estatura, creatina) y rutina semanal, si los escribes | Que Bía te conozca |
| Recuerdos de Bía (notas que tú o Bía guardan) | Que Bía recuerde preferencias, molestias o metas |
| Conversación visible con Bía (últimos 60 mensajes) | Retomar la charla |
| Reportes de respuestas de Bía | Ver qué respuestas marcaste |
| Ajustes y, si la pegas, tu clave de IA | Funcionamiento de la app |

## 3. Permisos del teléfono

| Permiso | Cuándo se pide | Para qué |
| --- | --- | --- |
| Micrófono | Al hablar con Bía | Escuchar lo que dices. No se graba ni se guarda audio en el teléfono. |
| Fotos o cámara | Al escanear una comida | Elegir o tomar la foto del plato. La foto se reduce en el teléfono, se envía para el análisis y se descarta. |
| Notificaciones | Si activas los recordatorios de agua | Avisos locales tras la creatina. No hay notificaciones desde un servidor. |

## 4. Qué se envía fuera del teléfono y a quién

Solo se envía algo cuando usas a Bía o el análisis de comidas. Sin eso, nada sale del teléfono.

**Qué se envía:**

- **Al hablar con Bía:** lo que dices (como texto o audio, según el proveedor), y el contexto para que responda bien: tu perfil, tu rutina, tus recuerdos, tus entrenos recientes, tu peso corporal y el resumen de tus comidas del día. Cuando Bía consulta o anota algo (una serie, la creatina, una comida), la respuesta de esa consulta también se envía al modelo.
- **Reconocimiento de voz:** con Gemini, la app usa el reconocimiento de voz del sistema (Chrome / Android), que procesa el audio en los servidores de **Google** para convertirlo en texto. Con OpenAI, el audio va directo a **OpenAI**.
- **Al analizar una comida:** la foto reducida (unos 50 KB) o el texto que escribiste, y la aclaración si la añades.

### 4A. Si cada usuario usa su propia clave de IA *(modelo actual)*

Los datos van **directamente desde tu teléfono** al proveedor que elijas, con tu propia clave: **Google (Gemini)** u **OpenAI**. El editor de Bía no los recibe ni los guarda. Ese proveedor los trata según sus propias condiciones:

- Google: [enlace a la política de privacidad de Google y a las condiciones de la API de Gemini]
- OpenAI: [enlace a la política de privacidad de OpenAI y a sus condiciones de API]

Al analizar una comida, si el proveedor elegido falla y también guardaste la clave del otro, la app lo intenta con ese otro.

Tu clave se guarda solo en el teléfono y no se incluye en los respaldos.

### 4B. Si Bía usa un servidor del editor *(alternativa)*

Los datos pasan por un servidor de [editor] en [proveedor de alojamiento, región], que los reenvía a [Google / OpenAI] para generar la respuesta. El servidor [no guarda el contenido / lo guarda N días para …]. [Describir registros técnicos: dirección IP, fecha, uso, durante cuánto tiempo y para qué.]

## 5. Respaldos

Si exportas un respaldo, la app crea un archivo con tus datos (sin tus claves de IA) y lo compartes tú, por ejemplo a tu correo o a tu nube. A partir de ahí, ese archivo queda bajo las condiciones del servicio donde lo guardes.

## 6. Reportes de respuestas

Si reportas una respuesta de Bía, el reporte se guarda en tu teléfono. Si la app tiene un correo de soporte, se abre tu aplicación de correo con el reporte escrito: solo se envía si tú lo envías.

## 7. Cómo borrar tus datos

- **Ajustes → Zona de riesgo → Borrar todos los datos** borra todo lo que la app guardó en el teléfono.
- **Bía → Nuevo chat** borra la conversación; **Recuerdos** deja borrar cada recuerdo.
- Desinstalar la app o borrar los datos del sitio también los elimina.
- Lo que ya se envió a un proveedor de IA se rige por sus condiciones (sección 4).

## 8. Menores

Bía no está dirigida a menores de [13/16] años.

## 9. Cambios

Si esta política cambia, se actualizará esta página y la fecha de arriba.

## 10. Contacto

[correo de soporte]

---

## Anexo para Play Console — «Seguridad de los datos» (borrador)

Referencia para rellenar el formulario. Revisar con el modelo de IA elegido.

| Tipo de dato (Play) | ¿Se recopila? | ¿Se comparte? | Notas |
| --- | --- | --- | --- |
| Salud y fitness → Fitness | Sí, si se usa Bía | Con el proveedor de IA (4A) o vía servidor (4B) | Entrenos, peso, comidas enviados como contexto. No se usa para publicidad. |
| Audio → Grabaciones de voz | Sí, al hablar con Bía | Google (reconocimiento) u OpenAI | Procesamiento efímero; la app no guarda audio. |
| Fotos | Sí, al escanear comida | Proveedor de IA | No se guardan. |
| Información personal → Nombre | Opcional | Proveedor de IA, como contexto | Solo si el atleta lo escribe. |
| Identificadores, ubicación, contactos, pagos | No | No | — |

- ¿Datos cifrados en tránsito? Sí (HTTPS / WSS / WebRTC).
- ¿El usuario puede pedir que se borren? Sí, desde la app (sección 7).
- Uso de los datos: funcionalidad de la app. No publicidad, no analítica.
