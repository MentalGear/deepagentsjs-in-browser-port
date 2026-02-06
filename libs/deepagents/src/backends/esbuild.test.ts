import { describe, it, expect } from "vitest";
import { Bash } from "just-bash";
import { LocalSandboxBackend } from "./local-sandbox.js";
import * as esbuild from "esbuild-wasm";
// @ts-ignore
import { defineCommand } from "just-bash";

/**
 * A custom tool that uses esbuild-wasm to bundle files in the virtual filesystem.
 */
const esbuildTool = defineCommand("esbuild", async (args: string[], ctx: any) => {
  const entryPoints = args.filter(a => !a.startsWith("-"));
  const options: any = {
    bundle: args.includes("--bundle"),
    minify: args.includes("--minify"),
    format: "esm",
    write: false,
  };

  const outfileArg = args.find(a => a.startsWith("--outfile="));
  if (outfileArg) {
    options.outfile = outfileArg.split("=")[1];
  }

  // Redirect esbuild's file access to the virtual filesystem
  const vfsPlugin = {
    name: 'vfs',
    setup(build: any) {
      build.onResolve({ filter: /.*/ }, (args: any) => {
        return { path: args.path, namespace: 'vfs' }
      })
      build.onLoad({ filter: /.*/, namespace: 'vfs' }, async (args: any) => {
        try {
          const content = await ctx.fs.readFile(args.path);
          return { contents: content, loader: 'ts' }
        } catch (e) {
          return { errors: [{ text: `File not found in vFS: ${args.path}` }] }
        }
      })
    },
  }

  options.plugins = [vfsPlugin];
  options.entryPoints = entryPoints;

  try {
    const result = await esbuild.build(options);

    if (options.outfile && result.outputFiles) {
      for (const file of result.outputFiles) {
        await ctx.fs.writeFile(options.outfile, file.text);
      }
      return { stdout: `Successfully bundled to ${options.outfile}\n`, stderr: "", exitCode: 0 };
    }

    return {
      stdout: result.outputFiles?.[0]?.text || "No output\n",
      stderr: "",
      exitCode: 0
    };
  } catch (e: any) {
    return { stdout: "", stderr: e.message, exitCode: 1 };
  }
});

describe("Esbuild Tool in LocalSandboxBackend", () => {
  it("should bundle a simple TS file in the virtual filesystem", async () => {
    const bash = new Bash();
    bash.registerCommand(esbuildTool);
    const backend = new LocalSandboxBackend(bash);

    await backend.write("/index.ts", "export const hello = 'world';");

    const result = await backend.execute("esbuild /index.ts --bundle --outfile=/dist/bundle.js");

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Successfully bundled to /dist/bundle.js");

    const bundleContent = await backend.readRaw("/dist/bundle.js");
    expect(bundleContent.content.join("\n")).toContain("world");
  });
});
