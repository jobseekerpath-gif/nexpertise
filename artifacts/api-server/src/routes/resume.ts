import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
// Import the inner parser to avoid v1.1.1's debug-mode test-PDF loader at import time
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getAI } from "./ai.js";

export const router: IRouter = Router();

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

async function extractText(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === "application/pdf") {
    const data = await pdfParse(buffer);
    return data.text ?? "";
  }
  // DOCX / DOC
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

// POST /api/resume/upload
router.post("/resume/upload", requireAuth, upload.single("resume"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded. Please upload a PDF or DOCX file." });
      return;
    }

    const text = await extractText(file.buffer, file.mimetype);
    if (!text.trim()) {
      res.status(400).json({ error: "Could not extract text from the uploaded file." });
      return;
    }

    const userId = req.session.userId!;
    await db
      .update(usersTable)
      .set({
        resumeText: text,
        resumeFileName: file.originalname,
        resumeAnalysis: null,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, userId));

    res.json({
      success: true,
      fileName: file.originalname,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      charCount: text.length,
    });
  } catch (err) {
    req.log.error({ err }, "Resume upload error");
    res.status(500).json({ error: "Failed to process resume. Please try again." });
  }
});

// POST /api/resume/text — fallback for users who paste resume text directly
router.post("/resume/text", requireAuth, async (req, res) => {
  try {
    const { text } = req.body as Record<string, unknown>;
    if (typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "Resume text is required" });
      return;
    }
    const userId = req.session.userId!;
    await db
      .update(usersTable)
      .set({
        resumeText: text.trim(),
        resumeFileName: "Pasted resume",
        resumeAnalysis: null,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, userId));
    res.json({ success: true, wordCount: text.trim().split(/\s+/).filter(Boolean).length });
  } catch (err) {
    req.log.error({ err }, "Resume text save error");
    res.status(500).json({ error: "Failed to save resume text" });
  }
});

// GET /api/resume/current
router.get("/resume/current", requireAuth, async (req, res) => {
  try {
    const users = await db
      .select({
        resumeText: usersTable.resumeText,
        resumeFileName: usersTable.resumeFileName,
        resumeAnalysis: usersTable.resumeAnalysis,
        experienceSummary: usersTable.experienceSummary,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId!))
      .limit(1);

    const user = users[0];
    if (!user || !user.resumeText) {
      res.json({ hasResume: false });
      return;
    }

    let analysis: unknown = null;
    if (user.resumeAnalysis) {
      try { analysis = JSON.parse(user.resumeAnalysis); } catch { /* ignore */ }
    }

    res.json({
      hasResume: true,
      fileName: user.resumeFileName,
      resumeText: user.resumeText,
      analysis,
      experienceSummary: user.experienceSummary,
    });
  } catch (err) {
    req.log.error({ err }, "Resume fetch error");
    res.status(500).json({ error: "Failed to fetch resume" });
  }
});

// GET /api/resume/download — download resume analysis as plain text file
router.get("/resume/download", requireAuth, async (req, res) => {
  try {
    const users = await db
      .select({
        resumeFileName: usersTable.resumeFileName,
        resumeAnalysis: usersTable.resumeAnalysis,
        experienceSummary: usersTable.experienceSummary,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId!))
      .limit(1);

    const user = users[0];
    if (!user?.resumeAnalysis) {
      res.status(404).json({ error: "No resume analysis found. Please analyse your resume first." });
      return;
    }

    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(user.resumeAnalysis) as Record<string, unknown>; } catch { /* ignore */ }

    const fileName = (user.resumeFileName ?? "resume").replace(/\.[^.]+$/, "");
    const lines: string[] = [
      "══════════════════════════════════════════════════════",
      "          EduBharat — Resume Intelligence Report",
      "══════════════════════════════════════════════════════",
      `File: ${user.resumeFileName ?? "N/A"}`,
      `Generated: ${new Date().toLocaleString("en-IN")}`,
      "",
      `Overall ATS Score: ${parsed.overallScore ?? "N/A"} / 100`,
      "",
      "── Experience Summary ──────────────────────────────",
      user.experienceSummary ?? parsed.experienceSummary as string ?? "Not available",
      "",
      "── Skills Identified ───────────────────────────────",
      ...(Array.isArray(parsed.skills) ? (parsed.skills as string[]).map((s, i) => `  ${i + 1}. ${s}`) : ["  None identified"]),
      "",
      "── Education ────────────────────────────────────────",
      ...(Array.isArray(parsed.education) ? (parsed.education as string[]).map((e, i) => `  ${i + 1}. ${e}`) : ["  None identified"]),
      "",
      "── ATS Keyword Gaps ─────────────────────────────────",
      ...(Array.isArray(parsed.atsGaps) ? (parsed.atsGaps as string[]).map((g, i) => `  ${i + 1}. ${g}`) : ["  None identified"]),
      "",
      "── Formatting Issues ────────────────────────────────",
      ...(Array.isArray(parsed.formattingIssues) ? (parsed.formattingIssues as string[]).map((f, i) => `  ${i + 1}. ${f}`) : ["  None identified"]),
      "",
      "── Actionable Suggestions ───────────────────────────",
      ...(Array.isArray(parsed.suggestions) ? (parsed.suggestions as string[]).map((s, i) => `  ${i + 1}. ${s}`) : ["  None available"]),
      "",
      "══════════════════════════════════════════════════════",
      "    EduBharat — India's AI Career Intelligence Platform",
      "══════════════════════════════════════════════════════",
    ];

    const content = lines.join("\n");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}_edubharat_analysis.txt"`);
    res.send(content);
  } catch (err) {
    req.log.error({ err }, "Resume download error");
    res.status(500).json({ error: "Failed to generate download" });
  }
});

// POST /api/resume/analyse — SSE stream
router.post("/resume/analyse", requireAuth, async (req, res) => {
  try {
    const { targetRole, experienceLevel } = req.body as Record<string, string>;
    const userId = req.session.userId!;

    const users = await db
      .select({
        resumeText: usersTable.resumeText,
        preferredRole: usersTable.preferredRole,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    const user = users[0];
    if (!user?.resumeText) {
      res.status(400).json({ error: "No resume uploaded yet" });
      return;
    }

    const role = targetRole || user.preferredRole || "General";
    const experience = experienceLevel || "Fresher";

    const prompt = `Analyse the following resume for a candidate targeting a "${role}" role in India with ${experience} experience.

RESUME TEXT:
${user.resumeText}

Return a structured JSON analysis with exactly this shape (no markdown, no extra text, valid JSON only):

{
  "overallScore": 0-100,
  "skills": ["skill 1", "skill 2", ...],
  "education": ["degree 1", "degree 2", ...],
  "experienceSummary": "2-3 sentence summary of work experience",
  "atsGaps": ["missing keyword 1", "missing keyword 2", ...],
  "formattingIssues": ["issue 1", "issue 2", ...],
  "suggestions": ["specific actionable suggestion 1", "specific actionable suggestion 2", ...]
}

Ensure the response is valid JSON and can be parsed with JSON.parse().`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const ai = getAI();
    const contents = [
      { role: "user", parts: [{ text: "You are an expert Indian resume reviewer with 15 years of experience." }] },
      { role: "model", parts: [{ text: "Understood." }] },
      { role: "user", parts: [{ text: prompt }] },
    ];

    let fullText = "";
    for (const model of ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash-lite"]) {
      try {
        const stream = await ai.models.generateContentStream({
          model,
          contents,
          config: { maxOutputTokens: 1200 },
        });
        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) {
            fullText += text;
            res.write(`data: ${JSON.stringify({ content: text }) }\n\n`);
          }
        }
        break;
      } catch (err) {
        req.log.warn({ err, model }, "Resume analysis model failed");
        continue;
      }
    }

    // Try to parse final JSON and sync to profile
    try {
      const cleaned = fullText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(cleaned) as {
        overallScore?: number;
        skills?: string[];
        education?: string[];
        experienceSummary?: string;
        atsGaps?: string[];
        formattingIssues?: string[];
        suggestions?: string[];
      };

      await db
        .update(usersTable)
        .set({
          resumeAnalysis: JSON.stringify(parsed),
          experienceSummary: parsed.experienceSummary ?? "",
          skills: JSON.stringify(parsed.skills ?? []),
          education: JSON.stringify(parsed.education ?? []),
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, userId));
    } catch (err) {
      req.log.error({ err, fullText }, "Failed to parse resume analysis JSON");
    }

    res.write(`data: ${JSON.stringify({ done: true }) }\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Resume analysis error");
    res.write(`data: ${JSON.stringify({ error: "Failed to analyse resume" }) }\n\n`);
    res.end();
  }
});

export default router;
