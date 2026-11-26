/**
 * Private object storage. Bytes live in Supabase Storage (production) or on the
 * local filesystem (development). Metadata and access control live in
 * public.files under RLS; storage objects are never publicly readable and are
 * only reachable through short-lived signed URLs issued after an RLS check.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { env } from "../env";
import { signPayload } from "../crypto";

export interface StorageDriver {
  put(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(path: string): Promise<Uint8Array>;
  remove(path: string): Promise<void>;
  signedUrl(path: string, opts: { ttlSeconds: number; filename: string; contentType: string }): Promise<string>;
}

function assertSafePath(path: string) {
  if (!/^[a-z0-9/_.-]+$/i.test(path) || path.includes("..") || path.startsWith("/")) throw new Error("unsafe storage path");
}

class LocalDriver implements StorageDriver {
  private root = resolve(env().LOCAL_STORAGE_DIR);
  private abs(path: string) {
    assertSafePath(path);
    const p = resolve(join(this.root, path));
    if (!p.startsWith(this.root)) throw new Error("unsafe storage path");
    return p;
  }
  async put(path: string, bytes: Uint8Array) {
    const p = this.abs(path);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, bytes);
  }
  async get(path: string) {
    return new Uint8Array(await readFile(this.abs(path)));
  }
  async remove(path: string) {
    await rm(this.abs(path), { force: true });
  }
  async signedUrl(path: string, opts: { ttlSeconds: number; filename: string; contentType: string }) {
    assertSafePath(path);
    const token = signPayload({ path, name: opts.filename, type: opts.contentType }, "download", opts.ttlSeconds);
    return `/api/files/blob?token=${encodeURIComponent(token)}`;
  }
}

class SupabaseDriver implements StorageDriver {
  private client = createClient(env().NEXT_PUBLIC_SUPABASE_URL!, env().SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  private bucket = env().STORAGE_BUCKET;
  async put(path: string, bytes: Uint8Array, contentType: string) {
    assertSafePath(path);
    const { error } = await this.client.storage.from(this.bucket).upload(path, bytes, { contentType, upsert: false });
    if (error) throw new Error(`storage upload failed: ${error.message}`);
  }
  async get(path: string) {
    const { data, error } = await this.client.storage.from(this.bucket).download(path);
    if (error || !data) throw new Error(`storage download failed: ${error?.message}`);
    return new Uint8Array(await data.arrayBuffer());
  }
  async remove(path: string) {
    await this.client.storage.from(this.bucket).remove([path]);
  }
  async signedUrl(path: string, opts: { ttlSeconds: number; filename: string }) {
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUrl(path, opts.ttlSeconds, { download: opts.filename });
    if (error || !data) throw new Error(`signed url failed: ${error?.message}`);
    return data.signedUrl;
  }
}

let driver: StorageDriver | undefined;
export function storage(): StorageDriver {
  driver ??= env().STORAGE_PROVIDER === "supabase" ? new SupabaseDriver() : new LocalDriver();
  return driver;
}
