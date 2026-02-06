import { describe, it, expect } from "vitest";
import { Bash } from "just-bash";
import { LocalSandboxBackend } from "./local-sandbox.js";
import * as git from "isomorphic-git";
// @ts-ignore
import { defineCommand } from "just-bash";

const gitTool = defineCommand("git", async (args: string[], ctx: any) => {
  const command = args[0];
  // Basic mock
  if (command === "init") {
    return { stdout: "Initialized empty Git repository", stderr: "", exitCode: 0 };
  }
  return { stdout: "", stderr: "unknown", exitCode: 1 };
});

describe("Git Tool", () => {
  it("should work in LocalSandboxBackend", async () => {
    const bash = new Bash();
    bash.registerCommand(gitTool);
    const backend = new LocalSandboxBackend(bash);
    const result = await backend.execute("git init");
    expect(result.exitCode).toBe(0);
  });
});
