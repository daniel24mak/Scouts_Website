import assert from "node:assert/strict";
import test from "node:test";

import { normalizeTotpEnrollment, toMfaQrImageSource } from "../../src/utils/mfaQr.js";

test("MFA QR source supports Supabase SVG and data URL responses", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" /></svg>';
  const xmlSvg = `<?xml version="1.0" encoding="UTF-8"?>${svg}`;
  const dataUrl = "data:image/svg+xml;charset=UTF-8,%3Csvg%3E%3C%2Fsvg%3E";

  assert.match(toMfaQrImageSource(svg), /^data:image\/svg\+xml/);
  assert.match(decodeURIComponent(toMfaQrImageSource(xmlSvg)), /<svg/);
  assert.equal(toMfaQrImageSource(dataUrl), dataUrl);
});

test("MFA enrollment normalization accepts raw and wrapped Supabase payloads", () => {
  const raw = { id: "factor-1", totp: { qr_code: "<svg></svg>", secret: "ABC123" } };
  const wrapped = { data: raw };

  for (const enrollment of [normalizeTotpEnrollment(raw), normalizeTotpEnrollment(wrapped)]) {
    assert.equal(enrollment.id, raw.id);
    assert.equal(enrollment.totp.qr_code, raw.totp.qr_code);
    assert.equal(enrollment.totp.secret, raw.totp.secret);
  }
});
