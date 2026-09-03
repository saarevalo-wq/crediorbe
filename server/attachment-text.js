// Extracts text from email attachments WITHOUT any paid AI API — used by the
// free/no-AI classification path (classifyHeuristic in classifier.js).
//
// Two tiers:
//  1. PDF with a text layer (the normal case — autos admisorios generated
//     digitally by the juzgado) — read directly with pdf-parse. Fast,
//     reliable, 100% free, no network call needed.
//  2. Scanned/photographed documents (no text layer, or plain images) —
//     best-effort OCR with tesseract.js (also free, runs locally on the
//     server). This is slower and less accurate than a real AI reading the
//     document, and depends on tesseract's language-data download working
//     from wherever this server is hosted. If it fails for any reason, we
//     don't crash or block classification — we just mark the attachment as
//     unreadable so the app can tell the user to check it manually.

import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";

const MIN_TEXT_LENGTH_TO_SKIP_OCR = 30; // below this, treat the PDF as scanned/no text layer
const OCR_TIMEOUT_MS = 45_000;
const MAX_OCR_PAGES = 3; // cap OCR work per document to keep this affordable in server CPU time

let ocrWorkerPromise = null;
function getOcrWorker() {
  if (!ocrWorkerPromise) ocrWorkerPromise = createWorker("spa");
  return ocrWorkerPromise;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Tiempo agotado (${label})`)), ms)),
  ]);
}

async function ocrImageBuffer(buffer) {
  const worker = await getOcrWorker();
  const { data } = await withTimeout(worker.recognize(buffer), OCR_TIMEOUT_MS, "OCR");
  return data.text || "";
}

/**
 * @param {{filename:string, mimeType:string, data:string}} attachment base64 data
 * @returns {Promise<{filename:string, text:string, scanned:boolean, ocrFailed:boolean}>}
 */
export async function extractAttachmentText(attachment) {
  const buffer = Buffer.from(attachment.data, "base64");

  if (attachment.mimeType === "application/pdf") {
    let parser;
    try {
      parser = new PDFParse({ data: buffer });
      const { text } = await parser.getText();
      const cleaned = (text || "").trim();
      if (cleaned.length >= MIN_TEXT_LENGTH_TO_SKIP_OCR) {
        return { filename: attachment.filename, text: cleaned, scanned: false, ocrFailed: false };
      }
      // No text layer (or barely any) — likely a scanned PDF. Best-effort OCR
      // on the first few pages, rendered to images.
      try {
        const { pages } = await parser.getScreenshot({ scale: 2, first: MAX_OCR_PAGES });
        const pageTexts = [];
        for (const page of pages) {
          pageTexts.push(await ocrImageBuffer(page.data));
        }
        const ocrText = pageTexts.join("\n").trim();
        return { filename: attachment.filename, text: ocrText, scanned: true, ocrFailed: ocrText.length === 0 };
      } catch (ocrErr) {
        console.error(`OCR falló para "${attachment.filename}":`, ocrErr.message);
        return { filename: attachment.filename, text: "", scanned: true, ocrFailed: true };
      }
    } catch (err) {
      console.error(`No se pudo leer el PDF "${attachment.filename}":`, err.message);
      return { filename: attachment.filename, text: "", scanned: true, ocrFailed: true };
    } finally {
      await parser?.destroy().catch(() => {});
    }
  }

  // Plain image attachment (photo of a document, screenshot, etc.)
  try {
    const text = (await ocrImageBuffer(buffer)).trim();
    return { filename: attachment.filename, text, scanned: true, ocrFailed: text.length === 0 };
  } catch (err) {
    console.error(`OCR falló para la imagen "${attachment.filename}":`, err.message);
    return { filename: attachment.filename, text: "", scanned: true, ocrFailed: true };
  }
}

/** Extracts text from every attachment, tolerating individual failures. */
export async function extractAllAttachmentsText(attachments = []) {
  const results = [];
  for (const att of attachments) {
    try {
      results.push(await extractAttachmentText(att));
    } catch (err) {
      console.error(`Fallo inesperado leyendo "${att.filename}":`, err.message);
      results.push({ filename: att.filename, text: "", scanned: true, ocrFailed: true });
    }
  }
  return results;
}
