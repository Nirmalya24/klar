import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getServerEnv } from "@/lib/server/env";

async function ensureDir(path: string) {
  await mkdir(path, { recursive: true });
}

export function getStorageRoot() {
  return join(process.cwd(), getServerEnv().storageDir);
}

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeJsonFile<T>(path: string, payload: T) {
  await ensureDir(dirname(path));
  await writeFile(path, JSON.stringify(payload, null, 2), "utf8");
}

export async function readStoredRecord<T>(group: string, id: string) {
  return readJsonFile<T>(join(getStorageRoot(), group, `${id}.json`));
}

export async function writeStoredRecord<T>(group: string, id: string, payload: T) {
  await writeJsonFile(join(getStorageRoot(), group, `${id}.json`), payload);
}
