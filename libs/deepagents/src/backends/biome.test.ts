import { describe, it, expect } from "vitest";
import { Bash } from "just-bash";
import { JustBashBackend } from "./just-bash.js";
// @ts-ignore
import init, { Workspace } from "@biomejs/wasm-web";
// @ts-ignore
import { defineCommand } from "just-bash";
import path from "node:path";
import fs from "node:fs";

let initialized = false;
async function ensureBiome() {
  if (initialized) return;
  const wasmPath = path.resolve(process.cwd(), "node_modules/@biomejs/wasm-web/biome_wasm_bg.wasm");
  const wasmBuffer = fs.readFileSync(wasmPath);
  await init({ module_or_path: wasmBuffer });
  initialized = true;
}

const biomeTool = defineCommand("biome", async (args: string[], ctx: any) => {
  await ensureBiome();
  const workspace = new Workspace();

  const { projectKey } = workspace.openProject({
    openUninitialized: true,
    path: "/"
  });

  workspace.updateSettings({
    configuration: {
      linter: { enabled: true, rules: { recommended: true } },
      formatter: { enabled: true, indentStyle: "space", indentWidth: 2 }
    },
    projectKey
  });

  const command = args[0] || "check";
  const filePath = args[1];

  try {
    const content = await ctx.fs.readFile(filePath);
    workspace.openFile({
      content: { content, type: "fromClient", version: 1 },
      path: filePath,
      projectKey
    });

    if (command === "format") {
      const result = workspace.formatFile({
        path: filePath,
        projectKey
      });
      if (result && result.code) {
        await ctx.fs.writeFile(filePath, result.code);
        return { stdout: `Formatted ${filePath}\n`, stderr: "", exitCode: 0 };
      }
    } else if (command === "lint") {
      const diagResult = workspace.pullDiagnostics({
        categories: ["lint"],
        path: filePath,
        projectKey,
        pullCodeActions: true
      });

      if (diagResult.diagnostics.length === 0) {
        return { stdout: `No issues found in ${filePath}\n`, stderr: "", exitCode: 0 };
      }

      return { stdout: `Found ${diagResult.diagnostics.length} issues\n`, stderr: "", exitCode: 1 };
    }
    return { stdout: "", stderr: "Unknown command", exitCode: 1 };
  } finally {
    workspace.closeFile({ path: filePath, projectKey });
    workspace.free();
  }
});

describe("Biome Tool in JustBashBackend", () => {
  it("should format a JS file in the virtual filesystem", async () => {
    const bash = new Bash();
    bash.registerCommand(biomeTool);
    const backend = new JustBashBackend(bash);

    await backend.write("/test.js", "function  test() { console.log('hello') }");

    const result = await backend.execute("biome format /test.js");
    expect(result.exitCode).toBe(0);

    const formattedContent = await backend.readRaw("/test.js");
    // Biome should have normalized the double spaces and added a newline
    expect(formattedContent.content.join("\n")).toContain("function test()");
  });

  it("should find lint issues", async () => {
    const bash = new Bash();
    bash.registerCommand(biomeTool);
    const backend = new JustBashBackend(bash);

    // use of 'var' should trigger a lint warning/error
    await backend.write("/lint.js", "var x = 1;");

    const result = await backend.execute("biome lint /lint.js");
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("Found");
  });
});
