const pdfSignature = [0x25, 0x50, 0x44, 0x46];
const supportedImageKinds = new Set(["jpeg", "png", "webp", "heic", "heif"]);

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
  if (brand.includes("ftyp") && /(heic|heif|mif1)/.test(brand + file.name.toLowerCase())) {
    return /heif/i.test(file.type) || /\.heif$/i.test(file.name) ? "heif" : "heic";
  }
  return "unknown";
}

async function browserImageFile(file) {
  if (!["image/heic", "image/heif"].includes(file.type) && !/\.hei[cf]$/i.test(file.name)) return file;
  try {
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    return new File([blob], file.name.replace(/\.hei[cf]$/i, ".jpg"), { type: "image/jpeg" });
  } catch {
    throw new Error(`${file.name} could not be decoded on this device. Please use JPG, PNG, or PDF for this upload.`);
  }
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`${file.name} could not be decoded on this device.`));
    };
    image.src = objectUrl;
  });
}

async function decodeRegistrationImage(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      try {
        return await createImageBitmap(file);
      } catch {
        // Some mobile browsers reject valid camera images through ImageBitmap.
      }
    }
  }
  return loadImageElement(file);
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("The image could not be processed.")),
    type,
    quality
  ));
}

export async function processRegistrationFile(file, settings) {
  if (!(file instanceof File) || file.size === 0) throw new Error("Please choose a valid, non-empty file.");
  const detectedKind = await detectFileKind(file);
  if (detectedKind === "unknown") throw new Error(`${file.name} is not a supported image or PDF.`);
  if (file.size > Number(settings.maxFileSizeMb ?? 8) * 1024 * 1024) {
    throw new Error(`${file.name} exceeds the ${settings.maxFileSizeMb} MB limit.`);
  }
  if (detectedKind === "pdf") {
    if (!settings.acceptedFormats.includes("pdf")) throw new Error("PDF files are not accepted for this question.");
    return { file, previewUrl: null, width: null, height: null, originalFormat: "pdf", processedFormat: null };
  }
  if (!supportedImageKinds.has(detectedKind)) throw new Error("The selected image format is not supported.");

  const readableFile = await browserImageFile(file);
  const bitmap = await decodeRegistrationImage(readableFile);
  const maxEdge = settings.imageCompression === "headshot" ? 1200 : 2000;
  const sourceWidth = bitmap.width || bitmap.naturalWidth;
  const sourceHeight = bitmap.height || bitmap.naturalHeight;
  if (!sourceWidth || !sourceHeight) throw new Error(`${file.name} has invalid image dimensions.`);
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
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
