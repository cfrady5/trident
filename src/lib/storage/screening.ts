/**
 * Upload screening. This is a first line of defence, NOT a guarantee:
 * automated checks cannot reliably identify classified, CUI or export-controlled
 * content, and compressed formats (PDF streams, Office files) hide text from
 * byte-level inspection. Every file therefore stays quarantined until a staff
 * reviewer releases it. See SECURITY.md.
 */
import { env } from "../env";

export const ALLOWED_TYPES: Record<string, { exts: string[]; magic?: number[][] }> = {
  "application/pdf": { exts: ["pdf"], magic: [[0x25, 0x50, 0x44, 0x46]] },
  "image/png": { exts: ["png"], magic: [[0x89, 0x50, 0x4e, 0x47]] },
  "image/jpeg": { exts: ["jpg", "jpeg"], magic: [[0xff, 0xd8, 0xff]] },
  "image/webp": { exts: ["webp"], magic: [[0x52, 0x49, 0x46, 0x46]] },
  "image/svg+xml": { exts: ["svg"] },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { exts: ["pptx"], magic: [[0x50, 0x4b, 0x03, 0x04]] },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { exts: ["docx"], magic: [[0x50, 0x4b, 0x03, 0x04]] },
  "text/plain": { exts: ["txt", "md"] },
};

// Markings that indicate content Trident is not authorized to process.
const RESTRICTED_MARKERS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(TOP\s+SECRET|SECRET\/\/|CONFIDENTIAL\/\/|\/\/NOFORN|NOFORN)\b/i, label: "Classification marking" },
  { pattern: /\bCUI\b|CONTROLLED\s+UNCLASSIFIED/i, label: "Controlled Unclassified Information marking" },
  { pattern: /\bITAR\b|International\s+Traffic\s+in\s+Arms/i, label: "ITAR reference" },
  { pattern: /\bEAR99\b|Export\s+Administration\s+Regulations|EXPORT[\s-]CONTROLLED/i, label: "Export control reference" },
  { pattern: /DISTRIBUTION\s+STATEMENT\s+[B-F]\b/i, label: "Restricted distribution statement" },
  { pattern: /\bFOUO\b|FOR\s+OFFICIAL\s+USE\s+ONLY/i, label: "FOUO marking" },
  { pattern: /PROPRIETARY\s+(INFORMATION\s+)?OF\s+(?!TRIDENT)/i, label: "Third-party proprietary marking" },
];

const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

export interface ScreeningResult {
  scanStatus: "clean" | "flagged" | "infected" | "error" | "pending";
  quarantineStatus: "quarantined" | "held_for_review" | "deleted";
  notes: { check: string; result: "pass" | "flag" | "fail" | "skipped"; detail: string }[];
}

export function validateUpload(name: string, contentType: string, size: number): string | null {
  const max = env().MAX_UPLOAD_MB * 1024 * 1024;
  if (size <= 0) return "The file is empty.";
  if (size > max) return `Files must be ${env().MAX_UPLOAD_MB} MB or smaller.`;
  const spec = ALLOWED_TYPES[contentType];
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (!spec || !spec.exts.includes(ext)) return "Accepted formats: PDF, PNG, JPG, WEBP, SVG, PPTX, DOCX, TXT.";
  return null;
}

export function safeFilename(name: string): string {
  const base = name.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+/, "");
  return (base || "file").slice(-120).toLowerCase();
}

export async function screenUpload(bytes: Uint8Array, contentType: string): Promise<ScreeningResult> {
  const notes: ScreeningResult["notes"] = [];
  const spec = ALLOWED_TYPES[contentType];
  if (spec?.magic) {
    const matches = spec.magic.some((sig) => sig.every((b, i) => bytes[i] === b));
    notes.push({ check: "file_signature", result: matches ? "pass" : "fail", detail: matches ? "Content matches declared type" : "Content does not match declared type" });
    if (!matches) return { scanStatus: "flagged", quarantineStatus: "held_for_review", notes };
  }

  const text = Buffer.from(bytes.subarray(0, Math.min(bytes.length, 5 * 1024 * 1024))).toString("latin1");
  if (text.includes(EICAR)) {
    notes.push({ check: "malware_test_signature", result: "fail", detail: "EICAR test signature detected" });
    return { scanStatus: "infected", quarantineStatus: "deleted", notes };
  }
  if (contentType === "image/svg+xml" && /<script|javascript:|on\w+\s*=/i.test(text)) {
    notes.push({ check: "svg_active_content", result: "flag", detail: "SVG contains script or event handlers" });
  }

  const hits = RESTRICTED_MARKERS.filter((m) => m.pattern.test(text)).map((m) => m.label);
  notes.push({
    check: "restricted_markings",
    result: hits.length ? "flag" : "pass",
    detail: hits.length ? `Possible restricted content: ${hits.join(", ")}` : "No markings found in readable text (compressed content is not inspected)",
  });

  const scanUrl = env().MALWARE_SCAN_URL;
  if (scanUrl) {
    try {
      const res = await fetch(scanUrl, { method: "POST", body: Buffer.from(bytes), headers: { "Content-Type": "application/octet-stream" }, signal: AbortSignal.timeout(30_000) });
      const body = (await res.json()) as { clean?: boolean; signature?: string };
      if (body.clean === false) {
        notes.push({ check: "malware_scan", result: "fail", detail: body.signature ?? "Scanner reported a threat" });
        return { scanStatus: "infected", quarantineStatus: "deleted", notes };
      }
      notes.push({ check: "malware_scan", result: "pass", detail: "External scanner reported clean" });
    } catch (e) {
      notes.push({ check: "malware_scan", result: "fail", detail: `Scanner unavailable: ${(e as Error).message}` });
      return { scanStatus: "error", quarantineStatus: "held_for_review", notes };
    }
  } else {
    notes.push({ check: "malware_scan", result: "skipped", detail: "No malware scanner configured" });
  }

  const flagged = notes.some((n) => n.result === "flag");
  return {
    scanStatus: flagged ? "flagged" : scanUrl ? "clean" : "pending",
    quarantineStatus: flagged ? "held_for_review" : "quarantined",
    notes,
  };
}
