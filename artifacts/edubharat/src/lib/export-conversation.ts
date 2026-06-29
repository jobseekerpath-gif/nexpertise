import { jsPDF } from "jspdf";

export type ChatTurn = { role: "user" | "ai"; text: string };

function timestamp(): string {
  return new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fileStamp(): string {
  return new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
}

/**
 * Download the conversation as a real PDF using jsPDF.
 * Wraps long lines and paginates automatically.
 */
export function exportConversationPdf(
  history: ChatTurn[],
  opts: { title?: string; aiName?: string; userName?: string } = {},
): void {
  const title = opts.title ?? "EduBharat — Conversation";
  const aiName = opts.aiName ?? "Tutor";
  const userName = opts.userName ?? "You";

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxW = pageW - margin * 2;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(234, 88, 12); // brand orange
  doc.text(title, margin, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`Saved ${timestamp()}`, margin, y);
  y += 24;

  const lineH = 15;
  for (const turn of history) {
    const speaker = turn.role === "user" ? userName : aiName;
    const isUser = turn.role === "user";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(isUser ? 30 : 234, isUser ? 64 : 88, isUser ? 175 : 12);
    if (y + lineH > pageH - margin) { doc.addPage(); y = margin; }
    doc.text(`${speaker}:`, margin, y);
    y += lineH;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(turn.text, maxW) as string[];
    for (const line of lines) {
      if (y + lineH > pageH - margin) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += lineH;
    }
    y += 8;
  }

  doc.save(`edubharat-conversation-${fileStamp()}.pdf`);
}

/**
 * Download the conversation as a Word (.doc) document.
 * Uses an HTML payload with the Word MIME type — opens cleanly in
 * Microsoft Word, Google Docs, and LibreOffice on every device.
 */
export function exportConversationWord(
  history: ChatTurn[],
  opts: { title?: string; aiName?: string; userName?: string } = {},
): void {
  const title = opts.title ?? "EduBharat — Conversation";
  const aiName = opts.aiName ?? "Tutor";
  const userName = opts.userName ?? "You";

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const rows = history
    .map((t) => {
      const speaker = t.role === "user" ? userName : aiName;
      const color = t.role === "user" ? "#1e40af" : "#ea580c";
      return `<p style="margin:0 0 10px 0;"><b style="color:${color};">${esc(speaker)}:</b> <span>${esc(t.text)}</span></p>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(title)}</title></head>
<body style="font-family:Calibri,Arial,sans-serif;font-size:12pt;color:#282828;">
<h1 style="color:#ea580c;font-size:18pt;margin:0 0 4px 0;">${esc(title)}</h1>
<p style="color:#787878;font-size:10pt;margin:0 0 18px 0;">Saved ${esc(timestamp())}</p>
${rows}
</body></html>`;

  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `edubharat-conversation-${fileStamp()}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}
