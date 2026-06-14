export const IMAGE_CACHE_CONTROL = "max-age=31536000, immutable";
const supportedExtensions = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
const maxOriginalSize = 25 * 1024 * 1024;

const imageProfiles = {
  hero: { maxWidth: 1920, quality: 0.9 },
  site: { maxWidth: 1600, quality: 0.88 },
  website_content: { maxWidth: 1600, quality: 0.88 },
  gallery: { maxWidth: 1600, quality: 0.88 },
  gallery_thumbnail: { maxWidth: 600, quality: 0.84 },
  album_thumbnail: { maxWidth: 900, quality: 0.88 },
  blog_thumbnail: { maxWidth: 1200, quality: 0.88 },
  leader_headshot: { maxWidth: 600, maxHeight: 600, quality: 0.9, cropSquare: true },
  event: { maxWidth: 1200, quality: 0.88 },
  card: { maxWidth: 900, quality: 0.86 }
};

function extensionFor(file) {
  return String(file?.name ?? "").split(".").pop()?.toLowerCase() ?? "";
}

export function detectImageFormat(file) {
  const extension = extensionFor(file);
  if (extension === "jpg") return "jpeg";
  if (supportedExtensions.includes(extension)) return extension;
  if (file?.type?.startsWith("image/")) return file.type.replace("image/", "").toLowerCase();
  return "";
}

export function validateImageFile(file) {
  if (!(file instanceof File)) {
    throw new Error("Please choose a valid image file.");
  }

  const format = detectImageFormat(file);
  const allowedMime = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(file.type);

  if (!supportedExtensions.includes(format) && !allowedMime) {
    throw new Error("Please upload JPG, PNG, WebP, HEIC, or HEIF images only.");
  }

  if (file.size > maxOriginalSize) {
    throw new Error("Please choose an image under 25 MB.");
  }

  return format;
}

function safeBaseName(fileName) {
  return String(fileName ?? "image")
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "image";
}

export function optimizedImagePath(prefix, file, suffix = "") {
  const cleanPrefix = String(prefix ?? "images/optimized").replace(/^\/|\/$/g, "");
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${cleanPrefix}/${unique}-${safeBaseName(file?.name)}${suffix}.webp`;
}

async function convertHeicToJpeg(file) {
  try {
    const converterModule = await import("heic2any");
    const convert = converterModule.default ?? converterModule;
    const converted = await convert({ blob: file, toType: "image/jpeg", quality: 0.92 });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    return new File([blob], `${safeBaseName(file.name)}.jpg`, { type: "image/jpeg" });
  } catch {
    throw new Error(
      "This image format could not be processed on this device. Please try another image, or convert it to JPG/PNG and upload again."
    );
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This image could not be read. Please choose another image."));
    };
    image.src = url;
  });
}

function drawToCanvas(image, profile) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;
  let targetWidth = sourceWidth;
  let targetHeight = sourceHeight;

  if (profile.cropSquare) {
    const side = Math.min(sourceWidth, sourceHeight);
    sx = Math.round((sourceWidth - side) / 2);
    sy = Math.round((sourceHeight - side) / 2);
    sw = side;
    sh = side;
    targetWidth = Math.min(profile.maxWidth, side);
    targetHeight = targetWidth;
  } else {
    const widthRatio = profile.maxWidth ? profile.maxWidth / sourceWidth : 1;
    const heightRatio = profile.maxHeight ? profile.maxHeight / sourceHeight : 1;
    const ratio = Math.min(widthRatio, heightRatio, 1);
    targetWidth = Math.round(sourceWidth * ratio);
    targetHeight = Math.round(sourceHeight * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, targetWidth);
  canvas.height = Math.max(1, targetHeight);
  const context = canvas.getContext("2d", { alpha: true });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  return canvas;
}

function canvasToWebp(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("This image could not be optimized. Please choose another image."));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      Math.min(0.92, Math.max(0.85, quality))
    );
  });
}

export async function optimizeImageForUpload(file, imageType = "site") {
  const originalFormat = validateImageFile(file);
  const readableFile = ["heic", "heif"].includes(originalFormat) ? await convertHeicToJpeg(file) : file;
  const image = await loadImage(readableFile);
  const profile = imageProfiles[imageType] ?? imageProfiles.site;
  const canvas = drawToCanvas(image, profile);
  const blob = await canvasToWebp(canvas, profile.quality);
  const optimizedFile = new File([blob], `${safeBaseName(file.name)}.webp`, { type: "image/webp" });

  return {
    file: optimizedFile,
    width: canvas.width,
    height: canvas.height,
    originalFileName: file.name,
    originalFormat,
    originalSize: file.size,
    optimizedFormat: "webp",
    optimizedSize: optimizedFile.size,
    quality: profile.quality
  };
}

