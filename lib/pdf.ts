"use client";

function pdfEscape(value: string): string {
  return value.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7E]/g, "?");
}

/** Lightweight, dependency-free, one-page evidence PDF for the demo. */
export function downloadEvidencePdf(filename: string, title: string, lines: string[]): void {
  const wrappedLines = lines.flatMap((line) => {
    const words = line.replace(/\s+/g, " ").trim().split(" ");
    const output: string[] = [];
    let current = "";
    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > 88) { output.push(current); current = word; } else current = candidate;
    });
    if (current) output.push(current);
    return output;
  }).slice(0, 42);
  const commands = [
    "BT /F1 19 Tf 54 760 Td",
    `(${pdfEscape(title)}) Tj`,
    "0 -25 Td /F1 9 Tf",
    ...wrappedLines.flatMap((line) => [`(${pdfEscape(line)}) Tj`, "0 -15 Td"]),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
