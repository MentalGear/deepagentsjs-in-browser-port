/**
 * Adapter to bridge just-bash's IFileSystem to isomorphic-git's expected fs interface.
 */

import type { IFileSystem } from "just-bash";

function createFsError(code: string, message: string, path: string): Error & { code: string } {
  const err = new Error(`${code}: ${message}, '${path}'`) as Error & { code: string };
  err.code = code;
  return err;
}

async function wrapFsOp<T>(op: () => Promise<T>, path: string): Promise<T> {
  try {
    return await op();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("no such file") || msg.includes("ENOENT") || msg.includes("not found")) {
      throw createFsError("ENOENT", "no such file or directory", path);
    }
    throw err;
  }
}

class Stats {
  mode: number;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
  uid: number = 1000;
  gid: number = 1000;
  ino: number = 0;
  private _isFile: boolean;
  private _isDirectory: boolean;

  constructor(stat: any) {
    this.mode = stat.mode || (stat.isDirectory ? 0o755 : 0o644);
    this.size = stat.size || 0;
    const mtime = stat.mtime || new Date();
    this.mtimeMs = mtime.getTime();
    this.ctimeMs = mtime.getTime();
    this._isFile = !stat.isDirectory;
    this._isDirectory = !!stat.isDirectory;
  }

  isFile() { return this._isFile; }
  isDirectory() { return this._isDirectory; }
  isSymbolicLink() { return false; }
}

export function createFsAdapter(fs: IFileSystem, cwd: string) {
  const resolvePath = (filepath: string): string => {
    if (filepath.startsWith("/")) return filepath;
    return fs.resolvePath(cwd, filepath);
  };

  return {
    promises: {
      async readFile(filepath: string, options?: any): Promise<Uint8Array | string> {
        const resolved = resolvePath(filepath);
        const encoding = typeof options === "string" ? options : options?.encoding;
        return wrapFsOp(async () => {
          if (encoding === "utf8") return await fs.readFile(resolved, "utf8");
          return await fs.readFileBuffer(resolved);
        }, resolved);
      },
      async writeFile(filepath: string, data: any): Promise<void> {
        const resolved = resolvePath(filepath);
        await wrapFsOp(() => fs.writeFile(resolved, data), resolved);
      },
      async unlink(filepath: string): Promise<void> {
        const resolved = resolvePath(filepath);
        await wrapFsOp(() => fs.rm(resolved), resolved);
      },
      async readdir(filepath: string): Promise<string[]> {
        const resolved = resolvePath(filepath);
        return wrapFsOp(() => fs.readdir(resolved), resolved);
      },
      async mkdir(filepath: string, options?: any): Promise<void> {
        const resolved = resolvePath(filepath);
        const recursive = typeof options === "object" ? options.recursive : false;
        await wrapFsOp(() => fs.mkdir(resolved, { recursive }), resolved);
      },
      async stat(filepath: string): Promise<Stats> {
        const resolved = resolvePath(filepath);
        return wrapFsOp(async () => {
          const stat = await fs.stat(resolved);
          return new Stats(stat);
        }, resolved);
      },
      async lstat(filepath: string): Promise<Stats> {
        return this.stat(filepath);
      }
    }
  };
}
