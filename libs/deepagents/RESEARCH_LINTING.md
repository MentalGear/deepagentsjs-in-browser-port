# Research: Linting Tools for Browser-Based AI Agents

To provide high-quality code generation and editing, AI agents need a way to lint the code they produce. In a browser-based environment with a virtual filesystem (like `just-bash`), the linting tool must meet specific requirements:

1.  **Browser Compatibility**: Must run purely in JS/WASM without requiring Node.js APIs (like `fs`, `child_process`).
2.  **Virtual Filesystem Support**: Must be able to read files from a memory-based or virtual filesystem.
3.  **Speed**: Agents often iterate quickly; the linter must be near-instant.
4.  **Zero-Config (Ideally)**: Easy to set up without a complex dependency tree of plugins.

## Candidates

### 1. Biome (Recommended)
[Biome](https://biomejs.dev/) is a high-performance toolchain for web projects, written in Rust.

-   **Pros**:
    -   **Single WASM Binary**: Biome can be compiled to a single WASM file that includes the linter, formatter, and analyzer.
    -   **Speed**: Extremely fast (10-100x faster than ESLint).
    -   **Batteries Included**: Comes with built-in rules for JS, TS, JSON, and CSS. No need to install `eslint-plugin-react`, `eslint-plugin-import`, etc.
    -   **Playground Proven**: Already powers its own browser playground.
-   **Cons**: Smaller ecosystem than ESLint; not all specific ESLint rules are available.

### 2. ESLint
The industry standard for JavaScript linting.

-   **Pros**:
    -   **Maturity**: Huge ecosystem and thousands of rules.
    -   **Familiarity**: Most developers already use and configuration it.
-   **Cons**:
    -   **Orchestration Overhead**: ESLint is designed around the Node.js module resolution system. Running it in the browser requires polyfilling `fs`, `path`, and the module system itself.
    -   **Plugin Complexity**: To get React or TypeScript support, you must bundle many separate packages, which significantly increases bundle size.
    -   **Performance**: Can be slow in large codebases.

### 3. quick-lint-js
A extremely fast, dependency-free linter for JavaScript.

-   **Pros**:
    -   **WASM Optimized**: Specifically designed to be portable.
    -   **Speed**: Faster than almost any other linter.
-   **Cons**: Very limited scope (doesn't support TypeScript well, fewer rules than Biome or ESLint).

## Conclusion and Recommendation

**Biome** is the best fit for `deepagents` and `just-bash`.

1.  **Architecture**: It aligns with the "batteries-included" philosophy of `just-bash`.
2.  **Portability**: It is natively designed to be cross-platform via WASM.
3.  **Developer Experience**: The agent can run `biome check --apply` to automatically fix formatting and linting issues in the virtual filesystem with a single command.

## Next Steps for Implementation
1.  Add `@biomejs/wasm-browser` dependency to the playground.
2.  Create a `biome` custom command for `JustBashBackend` that initializes the WASM runtime and executes checks against the vFS.
