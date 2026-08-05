import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { formImageFolder } from "../../src/services/formImageService.js";

test("form images use an isolated publishable storage folder", () => {
  assert.equal(formImageFolder("header", "form-1"), "forms/optimized/header/form-1");
  assert.equal(formImageFolder("logo", "form-1"), "forms/optimized/logo/form-1");
  assert.equal(formImageFolder("question", "question-1"), "forms/optimized/question/question-1");
});

test("form image uploads reuse WebP optimization and authenticated Supabase storage", async () => {
  const source = await readFile(new URL("../../src/services/formImageService.js", import.meta.url), "utf8");

  assert.match(source, /optimizeImageForUpload\(file,/);
  assert.match(source, /uploadSupabaseFile\(/);
  assert.match(source, /"gallery"/);
  assert.match(source, /optimized\.file/);
});

test("form builder uploads both banners and logos instead of requiring URLs", async () => {
  const source = await readFile(new URL("../../src/features/forms/FormsDashboard.jsx", import.meta.url), "utf8");

  assert.match(source, /kind === "logo"/);
  assert.match(source, /logoUrl: uploaded\.imageUrl/);
  assert.match(source, /Upload organization logo/);
});

test("embedded public forms retain their configured brand header", async () => {
  const source = await readFile(new URL("../../src/features/forms/FormsDashboard.jsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /!embeddedHeader && <FormBrandHeader/);
  assert.match(source, /!embeddedHeader && <h2>/);
});
