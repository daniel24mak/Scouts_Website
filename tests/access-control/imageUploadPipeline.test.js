import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCEPTED_IMAGE_EXTENSIONS,
  ACCEPTED_IMAGE_INPUT,
  detectImageFormat,
  optimizedImagePath
} from "../../src/services/imageOptimizationService.js";
import { REGISTRATION_FILE_FORMATS } from "../../src/features/registration/registrationModel.js";

test("shared image uploads accept the supported camera and web image formats", () => {
  assert.deepEqual(
    ACCEPTED_IMAGE_EXTENSIONS,
    ["jpg", "jpeg", "png", "webp", "heic", "heif"]
  );
  assert.match(ACCEPTED_IMAGE_INPUT, /\.heif/);
  assert.equal(detectImageFormat({ name: "camera.HEIF", type: "image/heif" }), "heif");
  assert.ok(REGISTRATION_FILE_FORMATS.includes("heif"));
});

test("optimized image uploads always use a WebP storage path", () => {
  const path = optimizedImagePath("site-images/optimized/home", { name: "Header Photo.PNG" });

  assert.match(path, /^site-images\/optimized\/home\//);
  assert.match(path, /header-photo\.webp$/);
});
