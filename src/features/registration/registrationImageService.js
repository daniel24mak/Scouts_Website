const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const pdfSignature = [0x25, 0x50, 0x44, 0x46];

function startsWith(bytes, signature) {
  return signature.every((value, index) => bytes[index] === value);
}

async function detectFileKind(file) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (startsWith(bytes, pdfSignature)) return "pdf";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "png";
  if (String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  const brand = String.fromCharCode(...bytes.slice(4, 12)).toLowerCase();
  if (brand.includes("ftyp") && /(heic|heif|mif1)/.test(brand + file.name.toLowerCase())) return "heic";
  return "unknown";
}

async function browserImageFile(file) {
  if (!["image/heic", "image/heif"].includes(file.type) && !/\.hei[cf]$/i.test(file.name)) return file;
  const { default: heic2any } = await import("heic2any");
  const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  return new File([blob], file.name.replace(/\.hei[cf]$/i, ".jpg"), { type: "image/jpeg" });
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("The image could not be processed.")),
    type,
    quality
  ));
}

export async function processRegistrationFile(file, settings) {
  const detectedKind = await detectFileKind(file);
  if (detectedKind === "unknown") throw new Error(`${file.name} is not a supported image or PDF.`);
  if (file.size > Number(settings.maxFileSizeMb ?? 8) * 1024 * 1024) {
    throw new Error(`${file.name} exceeds the ${settings.maxFileSizeMb} MB limit.`);
  }
  if (detectedKind === "pdf") {
    if (!settings.acceptedFormats.includes("pdf")) throw new Error("PDF files are not accepted for this question.");
    return { file, previewUrl: null, width: null, height: null, originalFormat: "pdf", processedFormat: null };
  }
  if (!imageTypes.has(file.type) && detectedKind !== "heic") throw new Error("The selected image format is not supported.");

  const readableFile = await browserImageFile(file);
  const bitmap = await createImageBitmap(readableFile, { imageOrientation: "from-image" });
  const maxEdge = settings.imageCompression === "headshot" ? 1200 : 2000;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await canvasBlob(canvas, "image/webp", settings.imageCompression === "document" ? 0.88 : 0.84);
  const processed = new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" });
  return {
    file: processed,
    previewUrl: URL.createObjectURL(processed),
    width,
    height,
    originalFormat: detectedKind,
    processedFormat: "webp"
  };
}

export function releaseRegistrationPreview(item) {
  if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
}
