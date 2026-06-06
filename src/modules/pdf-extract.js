// PDF text extraction and OCR — unchanged from original.

export async function extractTextFromPDF(file) {
  if (!window.pdfjsLib) throw new Error('PDF.js não carregou. Recarregue a página.');
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const lines = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const txt = await page.getTextContent();
    const byY = {};
    txt.items.forEach(it => {
      const y = Math.round(it.transform[5]);
      if (!byY[y]) byY[y] = [];
      byY[y].push({ x: it.transform[4], str: it.str });
    });
    Object.keys(byY).map(Number).sort((a, b) => b - a).forEach(y => {
      const line = byY[y].sort((a, b) => a.x - b.x).map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
      if (line) lines.push(line);
    });
  }
  return lines.join('\n');
}

let tesseractLoaded = false;
function loadTesseract() {
  return new Promise((resolve, reject) => {
    if (tesseractLoaded && window.Tesseract) return resolve();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = () => { tesseractLoaded = true; resolve(); };
    s.onerror = () => reject(new Error('Falha ao carregar Tesseract.'));
    document.head.appendChild(s);
  });
}

export async function extractTextWithOCR(file, progressCb) {
  await loadTesseract();
  if (file.type === 'application/pdf') {
    if (!window.pdfjsLib) throw new Error('PDF.js não carregou.');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const allLines = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      if (progressCb) progressCb('Renderizando página ' + i + ' de ' + pdf.numPages + '...');
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      if (progressCb) progressCb('OCR da página ' + i + ' de ' + pdf.numPages + ' (pode demorar)...');
      const { data } = await window.Tesseract.recognize(canvas, 'por', {
        logger: m => {
          if (m.status === 'recognizing text' && progressCb)
            progressCb('OCR pág ' + i + ': ' + Math.round(m.progress * 100) + '%');
        },
      });
      allLines.push(data.text);
    }
    return allLines.join('\n');
  } else {
    if (progressCb) progressCb('Iniciando OCR...');
    const { data } = await window.Tesseract.recognize(file, 'por', {
      logger: m => {
        if (m.status === 'recognizing text' && progressCb)
          progressCb('OCR: ' + Math.round(m.progress * 100) + '%');
      },
    });
    return data.text;
  }
}
