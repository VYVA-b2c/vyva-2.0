// Shared by the bill reader and Document Help: shrink a photo until it fits the
// reader's request limit without making small print unreadable.
export function compressBillImage(file: File, targetChars = 1_500_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas context unavailable"));

      const emergencyMode = targetChars <= 120_000;
      const qualities = emergencyMode
        ? [0.48, 0.4, 0.32, 0.24, 0.16, 0.1]
        : [0.86, 0.78, 0.68, 0.58, 0.48, 0.38];
      const maxSizes = emergencyMode
        ? [620, 520, 420, 340, 260, 200, 160]
        : [1900, 1600, 1300, 1050, 850];
      let best = "";

      for (const maxSize of maxSizes) {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        for (const quality of qualities) {
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          if (!best || dataUrl.length < best.length) best = dataUrl;
          if (dataUrl.length <= targetChars) {
            resolve(dataUrl);
            return;
          }
        }
      }

      resolve(best);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No he podido abrir el archivo."));
    reader.readAsDataURL(file);
  });
}
