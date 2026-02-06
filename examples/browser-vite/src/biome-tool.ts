// @ts-ignore
import init, { Workspace } from "@biomejs/wasm-web";
// @ts-ignore
import biomeWasmUrl from "@biomejs/wasm-web/biome_wasm_bg.wasm?url";
// @ts-ignore
import { defineCommand } from "just-bash";

let initialized = false;
let workspace: any;

async function ensureBiome() {
  if (initialized) return;
  await init(biomeWasmUrl);
  workspace = new Workspace();

  const { projectKey } = workspace.openProject({
    openUninitialized: true,
    path: "/"
  });

  // Configure biome with some default settings
  workspace.updateSettings({
    configuration: {
      linter: { enabled: true, rules: { recommended: true } },
      formatter: { enabled: true, indentStyle: "space", indentWidth: 2 }
    },
    projectKey
  });

  initialized = true;
}

export const biomeTool = defineCommand("biome", async (args: string[], ctx: any) => {
  await ensureBiome();

  const command = args[0] || "check";
  const rawFilePath = args[1];

  if (!rawFilePath) {
    return { stdout: "", stderr: "Usage: biome <check|format|lint> <file>\n", exitCode: 1 };
  }

  const filePath = ctx.fs.resolvePath(ctx.cwd || "/", rawFilePath);

  try {
    const content = await ctx.fs.readFile(filePath);

    // Open file in workspace
    workspace.openFile({
      content: { content, type: "fromClient", version: 1 },
      path: filePath,
      projectKey: 1 // We assume the first project is key 1
    });

    if (command === "format") {
      const result = workspace.formatFile({
        path: filePath,
        projectKey: 1
      });
      if (result && result.code) {
        await ctx.fs.writeFile(filePath, result.code);
        return { stdout: `Formatted ${filePath}\n`, stderr: "", exitCode: 0 };
      }
    } else if (command === "check" || command === "lint") {
      const diagResult = workspace.pullDiagnostics({
        categories: ["lint"],
        path: filePath,
        projectKey: 1,
        pullCodeActions: true
      });

      if (diagResult.diagnostics.length === 0) {
        return { stdout: `No issues found in ${filePath}\n`, stderr: "", exitCode: 0 };
      }

      // Simple diagnostic output
      const output = diagResult.diagnostics.map((d: any) =>
        `[${d.severity}] ${d.location.path.file}:${d.location.span[0]}: ${d.message[0].content}`
      ).join("\n");

      return { stdout: output + "\n", stderr: "", exitCode: 1 };
    }

    return { stdout: `Unknown biome command: ${command}\n`, stderr: "", exitCode: 1 };
  } catch (e: any) {
    return { stdout: "", stderr: `Biome error: ${e.message}\n`, exitCode: 1 };
  } finally {
    try {
      workspace.closeFile({ path: filePath, projectKey: 1 });
    } catch {}
  }
});
