export function normalizeTotpEnrollment(response) {
  const payload = response?.data ?? response ?? {};
  const totp = payload.totp ?? payload.data?.totp ?? {};

  return {
    ...payload,
    id: payload.id ?? response?.id ?? "",
    totp: {
      ...totp,
      qr_code: totp.qr_code ?? totp.qrCode ?? payload.qr_code ?? payload.qrCode ?? "",
      secret: totp.secret ?? payload.secret ?? "",
      uri: totp.uri ?? payload.uri ?? ""
    }
  };
}

export function toMfaQrImageSource(qrCode) {
  const value = String(qrCode ?? "").trim();
  if (!value) return "";
  if (/^(?:data:image\/|blob:|https?:\/\/)/i.test(value)) return value;

  const svgStart = value.search(/<svg\b/i);
  if (svgStart === -1) return "";

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(value.slice(svgStart))}`;
}
