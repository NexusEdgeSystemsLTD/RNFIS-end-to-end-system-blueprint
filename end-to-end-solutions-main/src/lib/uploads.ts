import { supabase } from "@/integrations/supabase/client";

export async function uploadToBucket(bucket: "compliance-docs" | "appeal-evidence", file: File, prefix = ""): Promise<{ path: string; signedUrl: string }> {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `${prefix ? prefix + "/" : ""}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600", upsert: false, contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
  return { path, signedUrl: signed?.signedUrl ?? "" };
}

export async function getSignedUrl(bucket: string, path: string, expiresInSeconds = 3600): Promise<string | null> {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl ?? null;
}
