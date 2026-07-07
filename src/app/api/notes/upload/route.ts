import { NextResponse } from "next/server";
import JSZip from "jszip";
import { replaceVault } from "@/lib/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// multipart upload of a .zip of Obsidian .md notes → re-index the vault
// (deletes only source:'vault' chunks; captures + qa survive).
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "no file uploaded" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const zip = await JSZip.loadAsync(buf);

  const files: { filename: string; content: string }[] = [];
  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) continue;
    if (!entry.name.toLowerCase().endsWith(".md")) continue;
    const content = await entry.async("string");
    if (content.trim()) {
      files.push({ filename: entry.name.split("/").pop() || entry.name, content });
    }
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "no .md files found in zip" }, { status: 400 });
  }

  const chunks = await replaceVault(files);
  return NextResponse.json({ notes_loaded: files.length, chunks_indexed: chunks });
}
