import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createFileStorage } from "@/lib/storage.server";

describe("createFileStorage", () => {
  let root: string;
  let storage: ReturnType<typeof createFileStorage>;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "caif-storage-test-"));
    storage = createFileStorage(root);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("saves a file under the given subdir and returns a relative storagePath", async () => {
    const storagePath = await storage.saveFile("records", Buffer.from("hola"));
    expect(storagePath.startsWith("records/")).toBe(true);
    const onDisk = await fs.readFile(path.join(root, storagePath));
    expect(onDisk.toString()).toBe("hola");
  });

  it("round-trips bytes written and read back", async () => {
    const original = Buffer.from([0, 1, 2, 255, 254, 10]);
    const storagePath = await storage.saveFile("gallery", original);
    const readBack = await storage.readStoredFile(storagePath);
    expect(readBack.equals(original)).toBe(true);
  });

  it("generates distinct paths for two files saved in the same subdir", async () => {
    const a = await storage.saveFile("records", Buffer.from("a"));
    const b = await storage.saveFile("records", Buffer.from("b"));
    expect(a).not.toBe(b);
  });

  it("deletes a stored file so a later read fails", async () => {
    const storagePath = await storage.saveFile("records", Buffer.from("bye"));
    await storage.deleteStoredFile(storagePath);
    await expect(storage.readStoredFile(storagePath)).rejects.toThrow();
  });

  it("deleting a file that does not exist does not throw", async () => {
    await expect(storage.deleteStoredFile("records/never-existed")).resolves.not.toThrow();
  });

  it("rejects a storagePath containing '..' to prevent path traversal", async () => {
    await expect(storage.readStoredFile("../../etc/passwd")).rejects.toThrow(/inválid/i);
  });
});
