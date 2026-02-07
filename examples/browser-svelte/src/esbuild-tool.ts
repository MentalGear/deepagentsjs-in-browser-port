import * as esbuild from "esbuild-wasm";
// @ts-ignore
import { defineCommand } from "just-bash";
// @ts-ignore
import * as svelte from "svelte/compiler";

let initialized = false;

async function ensureEsbuild() {
  if (initialized) return;
  await esbuild.initialize({
    wasmURL: "https://unpkg.com/esbuild-wasm@0.27.2/esbuild.wasm",
  });
  initialized = true;
}

export const esbuildTool = defineCommand("esbuild", async (args: string[], ctx: any) => {
  await ensureEsbuild();

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

  const vfsPlugin = {
    name: 'vfs',
    setup(build: any) {
      // Resolve svelte and other packages to CDN if they are not relative
      build.onResolve({ filter: /^[^.\/]/ }, (args: any) => {
        if (args.path === 'svelte' || args.path.startsWith('svelte/')) {
          return { path: `https://esm.sh/${args.path}`, external: true }
        }
        return null;
      });

      build.onResolve({ filter: /.*/ }, (args: any) => {
        const path = ctx.fs.resolvePath(ctx.cwd || "/", args.path);
        return { path, namespace: 'vfs' }
      })

      build.onLoad({ filter: /\.svelte$/, namespace: 'vfs' }, async (args: any) => {
        try {
          const content = await ctx.fs.readFile(args.path);
          const result = svelte.compile(content, {
            filename: args.path,
            generate: "client",
          });
          return { contents: result.js.code, loader: 'js' }
        } catch (e: any) {
          return { errors: [{ text: `Svelte compilation error in ${args.path}: ${e.message}` }] }
        }
      })

      build.onLoad({ filter: /.*/, namespace: 'vfs' }, async (args: any) => {
        try {
          const content = await ctx.fs.readFile(args.path);
          const ext = args.path.split('.').pop();
          const loader = ['ts', 'tsx', 'js', 'jsx', 'json', 'css'].includes(ext) ? ext : 'ts';
          return { contents: content, loader }
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
