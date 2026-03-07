import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function downloadPDF(filename, buildDocFn) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  buildDocFn(doc);
  doc.save(filename);
}

export function addTitle(doc, title, subtitle) {
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  if (subtitle) {
    doc.setFontSize(11);
    doc.text(subtitle, 14, 22);
  }
}

export function addTable(doc, head, body, startY = 28) {
  autoTable(doc, {
    head: [head],
    body,
    startY,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fontStyle: "bold" },
  });
}
