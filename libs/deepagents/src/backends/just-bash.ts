/**
 * JustBashBackend: A backend that uses just-bash's virtual filesystem and shell.
 *
 * This backend is ideal for browser environments as it provides a full
 * POSIX-like environment in-memory, including common utilities like rg, sed, etc.
 */

import { Bash } from "just-bash";
import micromatch from "micromatch";
import type {
  EditResult,
  FileData,
  FileInfo,
  GrepMatch,
  SandboxBackendProtocol,
  WriteResult,
  ExecuteResponse,
  FileUploadResponse,
  FileDownloadResponse,
} from "./protocol.js";
import {
  formatContentWithLineNumbers,
  performStringReplacement,
  checkEmptyContent,
} from "./utils.js";

/**
 * Backend that uses just-bash for all operations.
 * Implements SandboxBackendProtocol to support command execution.
 */
export class JustBashBackend implements SandboxBackendProtocol {
  readonly id = "just-bash";
  private bash: Bash;

  constructor(bashOrOptions?: Bash | any) {
    if (bashOrOptions instanceof Bash) {
      this.bash = bashOrOptions;
    } else {
      this.bash = new Bash(bashOrOptions);
    }
  }

  /**
   * List files and directories in the specified directory (non-recursive).
   */
  async lsInfo(path: string): Promise<FileInfo[]> {
    try {
      const entries = await this.bash.fs.readdir(path);
      const results: FileInfo[] = [];

      for (const name of entries) {
        const fullPath = this.bash.fs.resolvePath(path, name);
        try {
          const stat = await this.bash.fs.stat(fullPath);
          results.push({
            path: stat.isDirectory ? fullPath + "/" : fullPath,
            is_dir: stat.isDirectory,
            size: stat.size,
            modified_at: stat.mtime.toISOString(),
          });
        } catch {
          // Skip entries we can't stat
          continue;
        }
      }

      results.sort((a, b) => a.path.localeCompare(b.path));
      return results;
    } catch {
      return [];
    }
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
      const content = await this.bash.fs.readFile(filePath);
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
    const content = await this.bash.fs.readFile(filePath);
    const stat = await this.bash.fs.stat(filePath);

    return {
      content: content.split("\n"),
      created_at: stat.mtime.toISOString(), // just-bash doesn't have ctime
      modified_at: stat.mtime.toISOString(),
    };
  }

  /**
   * Create a new file with content.
   */
  async write(filePath: string, content: string): Promise<WriteResult> {
    try {
      if (await this.bash.fs.exists(filePath)) {
        return {
          error: `Cannot write to ${filePath} because it already exists. Read and then make an edit, or write to a new path.`,
        };
      }

      await this.bash.fs.writeFile(filePath, content);
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
      const content = await this.bash.fs.readFile(filePath);
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
      await this.bash.fs.writeFile(filePath, newContent);

      return { path: filePath, filesUpdate: null, occurrences: occurrences };
    } catch (e: any) {
      return { error: `Error editing file '${filePath}': ${e.message}` };
    }
  }

  /**
   * Structured search results using ripgrep if possible.
   */
  async grepRaw(
    pattern: string,
    dirPath: string = "/",
    glob: string | null = null,
  ): Promise<GrepMatch[] | string> {
    // We can use just-bash's rg command with --json output
    // Properly quote arguments to handle spaces
    const quote = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;

    let command = `rg --json`;
    if (glob) {
      command += ` -g ${quote(glob)}`;
    }
    command += ` ${quote(pattern)} ${quote(dirPath)}`;

    try {
      const result = await this.bash.exec(command);
      if (result.exitCode !== 0 && result.exitCode !== 1) {
        return result.stderr || "Error running grep";
      }

      const matches: GrepMatch[] = [];
      const lines = result.stdout.split("\n");

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.type !== "match") continue;

          const pdata = data.data || {};
          const fpath = pdata.path?.text;
          const ln = pdata.line_number;
          const lt = pdata.lines?.text?.replace(/\n$/, "") || "";

          if (fpath && ln !== undefined) {
            matches.push({ path: fpath, line: ln, text: lt });
          }
        } catch {
          // Skip invalid JSON
          continue;
        }
      }

      return matches;
    } catch (e: any) {
      return `Error running grep: ${e.message}`;
    }
  }

  /**
   * Structured glob matching returning FileInfo objects.
   */
  async globInfo(pattern: string, searchPath: string = "/"): Promise<FileInfo[]> {
    const allPaths = this.bash.fs.getAllPaths();
    const results: FileInfo[] = [];

    // Filter paths matching searchPath and pattern
    for (const p of allPaths) {
      if (!p.startsWith(searchPath)) continue;

      const relative = p.substring(searchPath.length).replace(/^\//, "");
      if (micromatch.isMatch(relative, pattern, { dot: true })) {
        try {
          const stat = await this.bash.fs.stat(p);
          results.push({
            path: stat.isDirectory ? p + "/" : p,
            is_dir: stat.isDirectory,
            size: stat.size,
            modified_at: stat.mtime.toISOString(),
          });
        } catch {
          continue;
        }
      }
    }

    results.sort((a, b) => a.path.localeCompare(b.path));
    return results;
  }

  /**
   * Execute a command in just-bash.
   */
  async execute(command: string): Promise<ExecuteResponse> {
    const result = await this.bash.exec(command);
    return {
      output: result.stdout + result.stderr,
      exitCode: result.exitCode,
      truncated: false, // just-bash doesn't strictly truncate in its output, but we could add it
    };
  }

  /**
   * Upload multiple files to just-bash.
   */
  async uploadFiles(
    files: Array<[string, Uint8Array]>,
  ): Promise<FileUploadResponse[]> {
    const responses: FileUploadResponse[] = [];
    const decoder = new TextDecoder();

    for (const [filePath, content] of files) {
      try {
        const contentStr = decoder.decode(content);
        await this.bash.fs.writeFile(filePath, contentStr);
        responses.push({ path: filePath, error: null });
      } catch (e: any) {
        responses.push({ path: filePath, error: "invalid_path" });
      }
    }
    return responses;
  }

  /**
   * Download multiple files from just-bash.
   */
  async downloadFiles(paths: string[]): Promise<FileDownloadResponse[]> {
    const responses: FileDownloadResponse[] = [];
    const encoder = new TextEncoder();

    for (const filePath of paths) {
      try {
        const contentStr = await this.bash.fs.readFile(filePath);
        const content = encoder.encode(contentStr);
        responses.push({ path: filePath, content, error: null });
      } catch (e: any) {
        responses.push({ path: filePath, content: null, error: "file_not_found" });
      }
    }
    return responses;
  }
}
