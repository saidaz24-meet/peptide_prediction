import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function exportResultsAsPDF(rootSelector = "#results-root") {
  const el = document.querySelector(rootSelector) as HTMLElement;
  if (!el) throw new Error(`Results root '${rootSelector}' not found`);
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, windowWidth: el.scrollWidth });
  const img = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const r = Math.min(pageW / canvas.width, pageH / canvas.height);
  const w = canvas.width * r;
  const h = canvas.height * r;
  pdf.addImage(img, "PNG", (pageW - w) / 2, 20, w, h);
  pdf.save(`peptide_report_${new Date().toISOString().slice(0,10)}.pdf`);
}
