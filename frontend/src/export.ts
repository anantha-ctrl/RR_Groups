// Reusable table export: CSV, Excel (.xls), and PDF.
// jsPDF is imported dynamically so it only loads when the user exports a PDF.

export type ExportFormat = 'csv' | 'excel' | 'pdf';

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function cell<T>(col: ExportColumn<T>, row: T): string {
  const v = col.value(row);
  return v == null ? '' : String(v);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV<T>(filename: string, columns: ExportColumn<T>[], rows: T[]) {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [
    columns.map((c) => esc(c.header)).join(','),
    ...rows.map((r) => columns.map((c) => esc(cell(c, r))).join(',')),
  ];
  triggerDownload(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
}

function exportExcel<T>(filename: string, columns: ExportColumn<T>[], rows: T[]) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const head = `<tr>${columns.map((c) => `<th style="background:#a87615;color:#fff;">${esc(c.header)}</th>`).join('')}</tr>`;
  const body = rows
    .map((r) => `<tr>${columns.map((c) => `<td>${esc(cell(c, r))}</td>`).join('')}</tr>`)
    .join('');
  const html =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">` +
    `<head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>` +
    `<x:Name>Sheet1</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>` +
    `</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>` +
    `<body><table border="1">${head}${body}</table></body></html>`;
  triggerDownload(new Blob([html], { type: 'application/vnd.ms-excel' }), `${filename}.xls`);
}

async function exportPDF<T>(filename: string, title: string, columns: ExportColumn<T>[], rows: T[]) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const landscape = columns.length > 6;
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait' });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString('en-IN')} · ${rows.length} record(s)`, 14, 22);
  autoTable(doc, {
    startY: 27,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => cell(c, r))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [168, 118, 21], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 248, 251] },
    margin: { left: 14, right: 14 },
  });
  doc.save(`${filename}.pdf`);
}

export async function exportData<T>(
  format: ExportFormat,
  opts: { filename: string; title: string; columns: ExportColumn<T>[]; rows: T[] },
) {
  const { filename, title, columns, rows } = opts;
  if (format === 'csv') exportCSV(filename, columns, rows);
  else if (format === 'excel') exportExcel(filename, columns, rows);
  else await exportPDF(filename, title, columns, rows);
}
