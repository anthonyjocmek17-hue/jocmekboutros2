import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";

export const runtime = "nodejs";

const BodySchema = z.object({
  message: z.string().min(1).max(1000),
  context: z
    .object({
      lastMatchedFiles: z.array(z.string()).optional()
    })
    .optional()
});

const FALLBACK =
  "I’m not seeing that on the menu right now, but I can help you find something else.";

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "can",
  "could",
  "do",
  "does",
  "for",
  "from",
  "have",
  "i",
  "im",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "right",
  "that",
  "the",
  "their",
  "there",
  "this",
  "to",
  "we",
  "what",
  "which",
  "please",
  "pls",
  "ok",
  "okay",
  "yeah",
  "yep",
  "thanks",
  "thank",
  "no",
  "with",
  "yes",
  "you",
  "your"
]);

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string): string[] {
  const n = normalizeText(s);
  if (!n) return [];
  return n
    .split(" ")
    .filter(Boolean)
    .map((w) => {
      // Very small stemming: "burgers" -> "burger", "desserts" -> "dessert"
      if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
      return w;
    })
    .filter((w) => !STOPWORDS.has(w));
}

function stripMarkdown(s: string): string {
  return (
    s
      // links: [text](url) -> text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // headings/bullets
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      // emphasis/code
      .replace(/[*_`]/g, "")
      // extra whitespace
      .replace(/\s+\n/g, "\n")
      .trim()
  );
}

function extractH2Titles(md: string): string[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const m = /^\s*##\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const title = stripMarkdown(m[1]).trim();
    if (title) out.push(title);
  }
  return out;
}

function extractSectionH2Titles(md: string, sectionName: string): string[] {
  const want = normalizeText(sectionName);
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inSection = false;
  for (const line of lines) {
    const h1 = /^\s*#\s+(.+?)\s*$/.exec(line);
    if (h1) {
      inSection = normalizeText(h1[1]) === want;
      continue;
    }
    if (!inSection) continue;
    const h2 = /^\s*##\s+(.+?)\s*$/.exec(line);
    if (!h2) continue;
    const title = stripMarkdown(h2[1]).trim();
    if (title) out.push(title);
  }
  return out;
}

function splitParagraphs(md: string): string[] {
  const cleaned = md.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  // split on blank lines
  return cleaned
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function scoreParagraph(queryWords: Set<string>, paragraph: string): number {
  const words = tokenize(paragraph);
  if (words.length === 0) return 0;

  const plain = stripMarkdown(paragraph);
  // Avoid selecting headings-only / ultra-short paragraphs like "# Burgers".
  if (plain.length < 25) return 0;

  // Word overlap with small bonus for repeated hits.
  let hits = 0;
  let uniqueHits = 0;
  const seen = new Set<string>();
  for (const w of words) {
    if (!queryWords.has(w)) continue;
    hits += 1;
    if (!seen.has(w)) {
      uniqueHits += 1;
      seen.add(w);
    }
  }

  // Require at least one meaningful match.
  if (uniqueHits === 0) return 0;

  // Prefer paragraphs that cover more distinct query words.
  return uniqueHits * 5 + hits;
}

function buildReplyFromParagraph(paragraph: string, message: string): string {
  const text = stripMarkdown(paragraph);
  if (!text) return FALLBACK;

  // Softly “conversationalize” by adding a short opener if the paragraph
  // looks like a list of items or a section header followed by details.
  const lower = normalizeText(message);
  const isQuestion = /\b(do|does|is|are|can|what|which|any)\b/.test(lower);
  const opener = isQuestion ? "" : "";

  // If paragraph starts with a title-like line, keep it but make it friendly.
  return `${opener}${text}`.trim();
}

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function baseTopicFromFile(file: string): string {
  const base = file.replace(/\.md$/i, "").replace(/[-_]/g, " ");
  return stripMarkdown(base).trim();
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const message = parsed.data.message;
  const queryTokens = tokenize(message);
  const queryWords = new Set(queryTokens);
  const ctxFilesRaw = parsed.data.context?.lastMatchedFiles ?? [];
  const ctxFiles = ctxFilesRaw
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .map((s) => (s.toLowerCase().endsWith(".md") ? s : `${s}.md`));

  // Allow short follow-ups like "yes please" by falling back to the last matched file(s).
  if (queryWords.size === 0 && ctxFiles.length === 0) {
    return NextResponse.json({ reply: FALLBACK, matchedFiles: [] });
  }

  const kbDir = path.join(process.cwd(), "knowledge-base");

  let entries: string[] = [];
  try {
    entries = (await fs.readdir(kbDir)).filter((f) => f.toLowerCase().endsWith(".md"));
  } catch {
    return NextResponse.json(
      {
        reply: FALLBACK,
        matchedFiles: []
      },
      { status: 200 }
    );
  }

  const files = await Promise.all(
    entries.map(async (file) => {
      const full = path.join(kbDir, file);
      const content = await fs.readFile(full, "utf8");
      return { file, content };
    })
  );

  const candidateFiles =
    ctxFiles.length > 0
      ? files.filter((f) => ctxFiles.includes(f.file.toLowerCase()))
      : files;

  type Hit = { file: string; paragraph: string; score: number };
  let best: Hit | null = null;
  const matched = new Set<string>();

  for (const f of candidateFiles) {
    const fileTokens = tokenize(f.file.replace(/\.md$/i, "").replace(/[-_]/g, " "));
    const fileTokenSet = new Set(fileTokens);
    const paragraphs = splitParagraphs(f.content);
    for (const p of paragraphs) {
      let s = scoreParagraph(queryWords, p);
      if (s <= 0) continue;
      // Small boost if the query matches the filename topic (e.g. burger -> burgers.md).
      for (const qw of queryWords) {
        if (fileTokenSet.has(qw) || fileTokenSet.has(`${qw}s`) || fileTokenSet.has(qw.replace(/s$/, ""))) {
          s += 6;
          break;
        }
      }
      if (!best || s > best.score) best = { file: f.file, paragraph: p, score: s };
    }
  }

  if (!best) {
    // If we couldn't match any paragraph (often because a file contains mostly headings),
    // try to answer list-style questions from section titles.
    const lowerMsg = normalizeText(message);

    // If this is a follow-up and we have a last matched file, answer from that file's titles.
    if (ctxFiles.length > 0) {
      const primary = candidateFiles[0];
      if (primary) {
        const titles = extractH2Titles(primary.content);
        if (titles.length) {
          const topic = baseTopicFromFile(primary.file);
          return NextResponse.json({
            reply: `We have a few ${topic} options, including ${joinList(titles)}. Would you like me to help you choose one?`,
            matchedFiles: [primary.file]
          });
        }
      }
    }
    const wantsCoffee = /\bcoffee\b/.test(lowerMsg);
    const wantsCold = /\b(cold|iced|frap|frappe|beverage|drink)\b/.test(lowerMsg);
    if (wantsCoffee) {
      const drinks = files.find((f) => f.file.toLowerCase() === "drinks.md");
      if (drinks) {
        const titles = extractSectionH2Titles(drinks.content, "Coffee");
        if (titles.length) {
          const joined = joinList(titles);
          return NextResponse.json({
            reply: `Yes — we have coffee options including ${joined}.`,
            matchedFiles: ["drinks.md"]
          });
        }
      }
    }
    if (wantsCold) {
      const drinks = files.find((f) => f.file.toLowerCase() === "drinks.md");
      if (drinks) {
        const titles = extractSectionH2Titles(drinks.content, "Cold Beverages");
        if (titles.length) {
          const joined = joinList(titles);
          return NextResponse.json({
            reply: `Yes — our cold beverages include ${joined}.`,
            matchedFiles: ["drinks.md"]
          });
        }
      }
    }

    const wantsPlatter = /\bplatter\b/.test(lowerMsg);
    if (wantsPlatter) {
      const specials = files.find((f) => f.file.toLowerCase() === "specials.md");
      if (specials) {
        const titles = extractSectionH2Titles(specials.content, "Platters");
        if (titles.length) {
          const joined = joinList(titles);
          return NextResponse.json({
            reply: `We have platters including ${joined}.`,
            matchedFiles: ["specials.md"]
          });
        }
      }
    }
    return NextResponse.json({ reply: FALLBACK, matchedFiles: [] });
  }

  matched.add(best.file);

  const lowerMsg = normalizeText(message);
  const isListQuestion =
    /\bwhat\b.*\b(do you have|options|choices|available)\b/.test(lowerMsg) ||
    /\bwhat\b.*\b(burgers|sandwiches|drinks|desserts)\b/.test(lowerMsg);

  const sourceFile = files.find((f) => f.file === best.file);
  if (isListQuestion && sourceFile) {
    const titles = extractH2Titles(sourceFile.content);
    if (titles.length >= 2) {
      const joined = joinList(titles);
      const topic = baseTopicFromFile(best.file);
      const reply = `We have a few ${topic} options, including ${joined}. Would you like me to help you choose one?`;
      return NextResponse.json({
        reply,
        matchedFiles: Array.from(matched)
      });
    }
  }

  const reply = buildReplyFromParagraph(best.paragraph, message);

  return NextResponse.json({
    reply: reply || FALLBACK,
    matchedFiles: Array.from(matched)
  });
}

