function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildExcelWorkbook({ sheetName = "Responses", headers = [], rows = [] }) {
  const safeSheetName = String(sheetName).replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Responses";
  const tableRows = [headers, ...rows]
    .map((row) => `<Row>${row.map((value) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join("")}</Row>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(safeSheetName)}"><Table>${tableRows}</Table></Worksheet>
</Workbook>`;
}

export function downloadExcelFile({ fileName = "responses.xls", sheetName, headers, rows }) {
  const workbook = buildExcelWorkbook({ sheetName, headers, rows });
  const blob = new Blob(["\uFEFF", workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".xls") ? fileName : `${fileName}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}
