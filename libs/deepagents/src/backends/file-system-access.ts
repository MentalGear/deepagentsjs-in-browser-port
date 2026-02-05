/**
 * FileSystemAccessBackend: A backend that uses the Browser's File System Access API.
 *
 * This allows the agent to interact with real directories on the user's local
 * machine after the user has granted permission via a directory picker.
 */

import micromatch from "micromatch";
import type {
  BackendProtocol,
  EditResult,
  FileData,
  FileInfo,
  GrepMatch,
  WriteResult,
} from "./protocol.js";
import {
  formatContentWithLineNumbers,
  performStringReplacement,
  checkEmptyContent,
} from "./utils.js";

/**
 * Backend that uses Browser File System Access API.
 */
export class FileSystemAccessBackend implements BackendProtocol {
  private rootHandle: FileSystemDirectoryHandle;

  constructor(rootHandle: FileSystemDirectoryHandle) {
    this.rootHandle = rootHandle;
  }

  /**
   * Resolve a handle for a given path.
   */
  private async getHandle(
    path: string,
    options: { create?: boolean; type?: "file" | "directory" } = {},
  ): Promise<FileSystemFileHandle | FileSystemDirectoryHandle | null> {
    const parts = path.split("/").filter((p) => p !== "");
    let current: FileSystemDirectoryHandle = this.rootHandle;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast && options.type === "file") {
        try {
          return await current.getFileHandle(part, { create: options.create });
        } catch {
          return null;
        }
      }

      try {
        current = await current.getDirectoryHandle(part, {
          create: options.create || (!isLast && options.type === "file"),
        });
      } catch {
        return null;
      }
    }

    return current;
  }

  /**
   * List files and directories in the specified directory.
   */
  async lsInfo(dirPath: string): Promise<FileInfo[]> {
    const handle = await this.getHandle(dirPath, { type: "directory" });
    if (!handle || !(handle instanceof FileSystemDirectoryHandle)) {
      return [];
    }

    const results: FileInfo[] = [];
    // @ts-ignore - values() is part of the API but might not be in all type definitions
    for await (const entry of handle.values()) {
      const fullPath = dirPath.endsWith("/")
        ? dirPath + entry.name
        : dirPath + "/" + entry.name;

      if (entry.kind === "file") {
        const file = await entry.getFile();
        results.push({
          path: fullPath,
          is_dir: false,
          size: file.size,
          modified_at: new Date(file.lastModified).toISOString(),
        });
      } else {
        results.push({
          path: fullPath + "/",
          is_dir: true,
          size: 0,
          modified_at: "",
        });
      }
    }

    results.sort((a, b) => a.path.localeCompare(b.path));
    return results;
  }

  /**
   * Read file content with line numbers.
   */
  async read(
    filePath: string,
    offset: number = 0,
    limit: number = 500,
  ): Promise<string> {
    try {
      const handle = await this.getHandle(filePath, { type: "file" });
      if (!handle || !(handle instanceof FileSystemFileHandle)) {
        return `Error: File '${filePath}' not found`;
      }

      const file = await handle.getFile();
      const content = await file.text();
      const emptyMsg = checkEmptyContent(content);
      if (emptyMsg) {
        return emptyMsg;
      }

      const lines = content.split("\n");
      const startIdx = offset;
      const endIdx = Math.min(startIdx + limit, lines.length);

      if (startIdx >= lines.length) {
        return `Error: Line offset ${offset} exceeds file length (${lines.length} lines)`;
      }

      const selectedLines = lines.slice(startIdx, endIdx);
      return formatContentWithLineNumbers(selectedLines, startIdx + 1);
    } catch (e: any) {
      return `Error reading file '${filePath}': ${e.message}`;
    }
  }

  /**
   * Read file content as raw FileData.
   */
  async readRaw(filePath: string): Promise<FileData> {
    const handle = await this.getHandle(filePath, { type: "file" });
    if (!handle || !(handle instanceof FileSystemFileHandle)) {
      throw new Error(`File '${filePath}' not found`);
    }

    const file = await handle.getFile();
    const content = await file.text();

    return {
      content: content.split("\n"),
      created_at: new Date(file.lastModified).toISOString(),
      modified_at: new Date(file.lastModified).toISOString(),
    };
  }

  /**
   * Create a new file with content.
   */
  async write(filePath: string, content: string): Promise<WriteResult> {
    try {
      const existing = await this.getHandle(filePath, { type: "file" });
      if (existing) {
        return {
          error: `Cannot write to ${filePath} because it already exists. Read and then make an edit, or write to a new path.`,
        };
      }

      const handle = (await this.getHandle(filePath, {
        create: true,
        type: "file",
      })) as FileSystemFileHandle;
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();

      return { path: filePath, filesUpdate: null };
    } catch (e: any) {
      return { error: `Error writing file '${filePath}': ${e.message}` };
    }
  }

  /**
   * Edit a file by replacing string occurrences.
   */
  async edit(
    filePath: string,
    oldString: string,
    newString: string,
    replaceAll: boolean = false,
  ): Promise<EditResult> {
    try {
      const handle = await this.getHandle(filePath, { type: "file" });
      if (!handle || !(handle instanceof FileSystemFileHandle)) {
        return { error: `Error: File '${filePath}' not found` };
      }

      const file = await handle.getFile();
      const content = await file.text();
      const result = performStringReplacement(
        content,
        oldString,
        newString,
        replaceAll,
      );

      if (typeof result === "string") {
        return { error: result };
      }

      const [newContent, occurrences] = result;
      const writable = await handle.createWritable();
      await writable.write(newContent);
      await writable.close();

      return { path: filePath, filesUpdate: null, occurrences: occurrences };
    } catch (e: any) {
      return { error: `Error editing file '${filePath}': ${e.message}` };
    }
  }

  /**
   * Structured search results.
   * Note: This is a slow implementation as it has to read every file.
   * Browser does not have a native fast grep.
   */
  async grepRaw(
    pattern: string,
    dirPath: string = "/",
    glob: string | null = null,
  ): Promise<GrepMatch[] | string> {
    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch (e: any) {
      return `Invalid regex pattern: ${e.message}`;
    }

    const handle = await this.getHandle(dirPath, { type: "directory" });
    if (!handle || !(handle instanceof FileSystemDirectoryHandle)) {
      return [];
    }

    const matches: GrepMatch[] = [];

    async function scan(currentHandle: FileSystemDirectoryHandle, currentPath: string) {
      // @ts-ignore
      for await (const entry of currentHandle.values()) {
        const fullPath = currentPath === "/" ? "/" + entry.name : currentPath + "/" + entry.name;

        if (entry.kind === "file") {
          if (glob && !micromatch.isMatch(entry.name, glob)) continue;

          try {
            const file = await entry.getFile();
            if (file.size > 10 * 1024 * 1024) continue; // Skip large files

            const content = await file.text();
            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                matches.push({ path: fullPath, line: i + 1, text: lines[i] });
              }
            }
          } catch {
            continue;
          }
        } else if (entry.kind === "directory") {
          await scan(entry, fullPath);
        }
      }
    }

    await scan(handle, dirPath);
    return matches;
  }

  /**
   * Structured glob matching returning FileInfo objects.
   */
  async globInfo(pattern: string, searchPath: string = "/"): Promise<FileInfo[]> {
    const handle = await this.getHandle(searchPath, { type: "directory" });
    if (!handle || !(handle instanceof FileSystemDirectoryHandle)) {
      return [];
    }

    const results: FileInfo[] = [];

    async function scan(currentHandle: FileSystemDirectoryHandle, currentPath: string) {
      // @ts-ignore
      for await (const entry of currentHandle.values()) {
        const fullPath = currentPath === "/" ? "/" + entry.name : currentPath + "/" + entry.name;
        const relative = fullPath.substring(searchPath.length).replace(/^\//, "");

        if (micromatch.isMatch(relative, pattern, { dot: true })) {
          if (entry.kind === "file") {
            const file = await entry.getFile();
            results.push({
              path: fullPath,
              is_dir: false,
              size: file.size,
              modified_at: new Date(file.lastModified).toISOString(),
            });
          } else {
             results.push({
              path: fullPath + "/",
              is_dir: true,
              size: 0,
              modified_at: "",
            });
          }
        }

        if (entry.kind === "directory") {
          await scan(entry, fullPath);
        }
      }
    }

    await scan(handle, searchPath);
    results.sort((a, b) => a.path.localeCompare(b.path));
    return results;
  }
}
