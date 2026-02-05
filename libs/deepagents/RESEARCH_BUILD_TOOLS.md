# Research: Build Tools for Svelte in Browser-Based AI Agents

To support modern web development within an AI agent's virtual environment, the build tool must be able to compile and bundle component frameworks like **Svelte**.

## Requirements
1.  **In-Browser Execution**: Must run without Node.js (WASM or pure JS).
2.  **Svelte Compilation**: Must integrate with the Svelte compiler to transform `.svelte` files into JavaScript and CSS.
3.  **Performance**: Agents need fast feedback loops.
4.  **TypeScript Support**: Native or easy integration.

## Candidates

### 1. esbuild-wasm (Recommended)
`esbuild` is a "next-generation" bundler written in Go and compiled to WASM for the browser.

-   **Pros**:
    -   **Extreme Speed**: Orders of magnitude faster than traditional bundlers.
    -   **All-in-One**: Handles bundling, minification, and TypeScript out of the box.
    -   **Single Binary**: Only one WASM file to load and manage.
    -   **Plugin Support**: Can be extended to support Svelte via a simple browser-compatible plugin.
-   **Cons**: Svelte support is not native; requires a small amount of glue code to bridge the Svelte compiler and the esbuild plugin API.

### 2. Rollup (Browser Version)
Rollup is the traditional choice for Svelte projects and powers the official Svelte REPL.

-   **Pros**:
    -   **Standard for Svelte**: The most "native" feeling for Svelte developers.
    -   **Plugin Richness**: Massive ecosystem of plugins.
-   **Cons**:
    -   **Complex Browser Deployment**: Requires multiple files and often polyfills for Node built-ins.
    -   **Slower Performance**: Bundle times are noticeably higher than esbuild.
    -   **Manual Minification**: Requires an additional plugin (like Terser) for production-ready builds.

### 3. Svelte Compiler + Custom Orchestrator
Using the `svelte/compiler` directly without a heavy bundler.

-   **Pros**: Lowest overhead if only one file is needed.
-   **Cons**: Doesn't handle imports, CSS bundling, or TypeScript without significant additional effort.

---

## Evaluation: Why esbuild is the best choice

For the `deepagents` project, **esbuild-wasm** is the superior choice for the following reasons:

1.  **Architectural Fit**: It matches the high-performance, lightweight goals of the SDK.
2.  **Developer Experience**: The agent can use a single `esbuild` command to handle everything from TS compilation to Svelte component bundling.
3.  **Svelte 5 Readiness**: Svelte 5's compiler is highly optimized and works perfectly in the browser. Integrating it as an esbuild plugin allows us to leverage Svelte 5's speed while keeping the bundling layer fast.

## Implementation Strategy for Svelte support

To enable Svelte support in our existing `esbuild` command:

1.  Load the browser-compatible Svelte compiler:
    ```javascript
    import * as svelte from 'svelte/compiler';
    ```
2.  Define a plugin for esbuild:
    ```javascript
    const sveltePlugin = {
      name: 'svelte',
      setup(build) {
        build.onLoad({ filter: /\.svelte$/ }, async (args) => {
          const content = await vfs.readFile(args.path);
          const { js } = svelte.compile(content, {
            css: 'included',
            generate: 'dom',
            hydratable: true
          });
          return { contents: js.code };
        });
      }
    };
    ```

This approach gives the agent a "Pro-level" build toolchain that is both faster and easier to use than traditional setups.
