import { describe, it, expect, beforeEach } from "vitest";
import { Bash } from "just-bash";
import { LocalSandboxBackend } from "./local-sandbox.js";

describe("LocalSandboxBackend", () => {
  let bash: Bash;
  let backend: LocalSandboxBackend;

  beforeEach(() => {
    bash = new Bash();
    backend = new LocalSandboxBackend(bash);
  });

  it("should list files correctly", async () => {
    await bash.fs.writeFile("/a.txt", "hello");
    await bash.fs.mkdir("/dir");
    await bash.fs.writeFile("/dir/b.txt", "world");

    const infos = await backend.lsInfo("/");
    const paths = infos.map(i => i.path);
    expect(paths).toContain("/a.txt");
    expect(paths).toContain("/dir/");

    const aInfo = infos.find(i => i.path === "/a.txt");
    expect(aInfo?.is_dir).toBe(false);

    const dirInfo = infos.find(i => i.path === "/dir/");
    expect(dirInfo?.is_dir).toBe(true);
  });

  it("should read files with line numbers", async () => {
    await bash.fs.writeFile("/test.txt", "line1\nline2\nline3");
    const result = await backend.read("/test.txt");
    expect(result).toContain("1\tline1");
    expect(result).toContain("2\tline2");
    expect(result).toContain("3\tline3");
  });

  it("should write files", async () => {
    const result = await backend.write("/new.txt", "content");
    expect(result.error).toBeUndefined();
    expect(await bash.fs.readFile("/new.txt")).toBe("content");
  });

  it("should edit files", async () => {
    await bash.fs.writeFile("/edit.txt", "hello world");
    const result = await backend.edit("/edit.txt", "world", "universe");
    expect(result.error).toBeUndefined();
    expect(result.occurrences).toBe(1);
    expect(await bash.fs.readFile("/edit.txt")).toBe("hello universe");
  });

  it("should grep files using ripgrep", async () => {
    await bash.fs.writeFile("/grep.txt", "find me\nhide me");
    await bash.fs.writeFile("/other.txt", "find me too");

    // Use a specific directory to avoid searching system files
    await bash.fs.mkdir("/test-grep");
    await bash.fs.writeFile("/test-grep/grep.txt", "find me\nhide me");
    await bash.fs.writeFile("/test-grep/other.txt", "find me too");

    const result = await backend.grepRaw("find me", "/test-grep");
    expect(Array.isArray(result)).toBe(true);
    if (Array.isArray(result)) {
      expect(result.length).toBe(2);
      expect(result.some(m => m.path === "/test-grep/grep.txt")).toBe(true);
      expect(result.some(m => m.path === "/test-grep/other.txt")).toBe(true);
    }
  });

  it("should glob files", async () => {
    // Just-bash starts with some default files in /bin etc.
    // So let's create a specific directory to test globbing.
    await bash.fs.mkdir("/test-glob");
    await bash.fs.writeFile("/test-glob/app.ts", "content");
    await bash.fs.writeFile("/test-glob/index.ts", "content");
    await bash.fs.writeFile("/test-glob/README.md", "content");

    const infos = await backend.globInfo("**/*.ts", "/test-glob");
    expect(infos.length).toBe(2);
    expect(infos.every(i => i.path.endsWith(".ts"))).toBe(true);
  });

  it("should execute commands", async () => {
    const result = await backend.execute("echo 'hello shell'");
    expect(result.output).toContain("hello shell");
    expect(result.exitCode).toBe(0);
  });

  it("should upload and download files", async () => {
    const encoder = new TextEncoder();
    const content = encoder.encode("binary content");
    const uploadResults = await backend.uploadFiles([["/binary.txt", content]]);
    expect(uploadResults[0].error).toBeNull();

    const downloadResults = await backend.downloadFiles(["/binary.txt"]);
    expect(downloadResults[0].error).toBeNull();
    const decoder = new TextDecoder();
    expect(decoder.decode(downloadResults[0].content!)).toBe("binary content");
  });
});
