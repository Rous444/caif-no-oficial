import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

// Almacenamiento de archivos fuera de Postgres (Plan 08).
// En producción `root` es el disco persistente de Render (/var/data, ver render.yaml),
// compartido con la sesión de WhatsApp.
export function createFileStorage(root: string) {
  function resolveSafe(storagePath: string): string {
    if (storagePath.includes("..")) {
      throw new Error(`Ruta de almacenamiento inválida: ${storagePath}`);
    }
    return path.join(root, storagePath);
  }

  return {
    async saveFile(subdir: string, data: Buffer): Promise<string> {
      const relPath = `${subdir}/${randomUUID()}`;
      const absPath = resolveSafe(relPath);
      await fs.mkdir(path.dirname(absPath), { recursive: true });
      await fs.writeFile(absPath, data);
      return relPath;
    },
    async readStoredFile(storagePath: string): Promise<Buffer> {
      return fs.readFile(resolveSafe(storagePath));
    },
    async deleteStoredFile(storagePath: string): Promise<void> {
      await fs.rm(resolveSafe(storagePath), { force: true });
    },
  };
}

const STORAGE_ROOT = process.env.STORAGE_PATH ?? path.join(process.cwd(), ".data", "storage");
export const fileStorage = createFileStorage(STORAGE_ROOT);
