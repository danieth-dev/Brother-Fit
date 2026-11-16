/* Imágenes en el navegador. Usa <canvas>, así que es interfaz y no servicio. */

/* Comprime una foto en el navegador a JPEG de 800 px como máximo (~50 KB) para que el análisis
 * de comida sea rápido (~1,5–2,5 s) y barato (~250 tokens). La foto nunca se guarda. */
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
