import * as esbuild from "esbuild-wasm";
// @ts-ignore
import { defineCommand } from "just-bash";

let initialized = false;

async function ensureEsbuild() {
  if (initialized) return;
  await esbuild.initialize({
    wasmURL: "https://unpkg.com/esbuild-wasm/esbuild.wasm",
  });
  initialized = true;
}

export const esbuildTool = defineCommand("esbuild", async (args: string[], ctx: any) => {
  await ensureEsbuild();

  // Basic implementation of esbuild command for the vFS
  // usage: esbuild input.ts --outfile=output.js --bundle

  const entryPoints = args.filter(a => !a.startsWith("-"));
  const options: any = {
    bundle: args.includes("--bundle"),
    minify: args.includes("--minify"),
    format: "esm",
    write: false, // We want the output in memory to write to vFS
  };

  const outfileArg = args.find(a => a.startsWith("--outfile="));
  if (outfileArg) {
    options.outfile = outfileArg.split("=")[1];
  }

  // Create a plugin to redirect esbuild's file access to just-bash's vFS
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
        // Remove the 'vfs' prefix if any, but esbuild usually gives absolute paths
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
