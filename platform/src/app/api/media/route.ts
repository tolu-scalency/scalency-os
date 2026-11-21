import { randomUUID } from "node:crypto";
import { adminClient } from "@/lib/admin";
import { can, getWorkspace } from "@/lib/data";
import { signInComplete } from "@/lib/login-code-server";

// Uploads a picture for a page. Signed-in people who can build pages only.
// JPG, PNG, WebP or GIF up to 5 MB, checked by the file's first bytes, not just its name.

const MAX = 5 * 1024 * 1024;

function kind(b: Uint8Array): { ext: string; type: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", type: "image/png" };
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { ext: "gif", type: "image/gif" };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { ext: "webp", type: "image/webp" };
  return null;
}

export async function POST(req: Request) {
  if (!(await signInComplete())) return Response.json({ error: "Enter the code we emailed you first." }, { status: 401 });
  const ws = await getWorkspace().catch(() => null);
  if (!ws) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!can(ws, "sites.manage")) return Response.json({ error: "You don't have access to build pages." }, { status: 403 });
  const admin = adminClient();
  if (!admin) return Response.json({ error: "Uploads aren't set up yet (SUPABASE_SECRET_KEY in Netlify)." }, { status: 500 });

  const fd = await req.formData().catch(() => null);
  const file = fd?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose a picture to upload." }, { status: 400 });
  if (file.size > MAX) return Response.json({ error: "That picture is over 5 MB. Try a smaller one." }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const k = kind(bytes);
  if (!k) return Response.json({ error: "Use a JPG, PNG, WebP or GIF picture." }, { status: 415 });

  const path = `${ws.account.id}/${randomUUID()}.${k.ext}`;
  const { error } = await admin.storage.from("page-media").upload(path, bytes, { contentType: k.type, cacheControl: "31536000", upsert: false });
  if (error) return Response.json({ error: "The upload failed. Please try again." }, { status: 500 });
  const { data } = admin.storage.from("page-media").getPublicUrl(path);
  return Response.json({ url: data.publicUrl });
}
