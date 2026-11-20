import { createHash, randomUUID } from "node:crypto";
import { adminClient } from "@/lib/admin";

// A file or signature attached to a published form. Stored in the private
// "form-uploads" bucket; the answer the form sends is the upload's id.

export const dynamic = "force-dynamic";

const MAX = 4 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};
const json = (status: number, data: unknown) => Response.json(data, { status });

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json(404, { ok: false, error: "This form doesn't exist." });
  const admin = adminClient();
  if (!admin) return json(503, { ok: false, error: "Uploads aren't set up yet." });
  if (Number(request.headers.get("content-length") ?? 0) > MAX + 64 * 1024) return json(413, { ok: false, error: "That file is too big. The limit is 4 MB." });

  const { data: form } = await admin.from("forms").select("id, account_id, status").eq("id", id).maybeSingle();
  if (!form || form.status !== "live") return json(404, { ok: false, error: "This form isn't taking replies right now." });

  let file: File | null = null;
  try {
    const fd = await request.formData();
    const f = fd.get("file");
    file = f instanceof File ? f : null;
  } catch {
    return json(400, { ok: false, error: "That upload didn't come through. Please try again." });
  }
  if (!file || !file.size) return json(400, { ok: false, error: "Choose a file first." });
  if (file.size > MAX) return json(413, { ok: false, error: "That file is too big. The limit is 4 MB." });
  const ext = TYPES[file.type];
  if (!ext) return json(415, { ok: false, error: "Please upload a photo, PDF, Word, Excel or text file." });

  // At most 15 uploads per person per form every 10 minutes.
  const ip = (request.headers.get("x-nf-client-connection-ip") ?? request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const who = createHash("sha256").update(`${ip}|${id}`).digest("hex").slice(0, 32);
  const { count } = await admin.from("form_uploads").select("id", { count: "exact", head: true }).eq("form_id", id).eq("who", who).gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString());
  if ((count ?? 0) >= 15) return json(429, { ok: false, error: "That's a lot of uploads. Please wait a few minutes." });

  const uploadId = randomUUID();
  const path = `${form.account_id}/${id}/${uploadId}.${ext}`;
  const { error: upErr } = await admin.storage.from("form-uploads").upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (upErr) {
    console.error("Form upload failed", upErr.message);
    return json(500, { ok: false, error: "We couldn't save that file. Please try again." });
  }
  const name = (file.name || `upload.${ext}`).replace(/[^\w .()-]/g, "_").slice(0, 120);
  const { error } = await admin.from("form_uploads").insert({ id: uploadId, account_id: form.account_id, form_id: id, path, name, size: file.size, content_type: file.type, who });
  if (error) {
    await admin.storage.from("form-uploads").remove([path]);
    return json(500, { ok: false, error: "We couldn't save that file. Please try again." });
  }
  return json(200, { ok: true, id: uploadId, name });
}
