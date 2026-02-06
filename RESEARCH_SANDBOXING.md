# Research: Secure Execution with `lofi-web-sandbox`

Evaluating the use of `lofi-web-sandbox` (in worker mode) for sandboxing `deepagents` in the browser.

## Overview
`lofi-web-sandbox` is a security-focused sandbox implementation that leverages Web Workers and/or sandboxed iframes to isolate untrusted code execution. In "worker mode", it provides a clean JS environment without access to the main thread's DOM, cookies, or sensitive globals.

## Suitability for `deepagents`
The current port of `deepagents` is fully isomorphic and does not require Node.js-specific globals or DOM access (except for the optional `FileSystemAccessBackend` which requires user interaction). This makes it a perfect candidate for execution within a `lofi-web-sandbox` worker.

### Advantages
1. **DOM Isolation**: The agent cannot access or manipulate the main page UI, preventing prompt injection attacks from stealing data via DOM scraping or performing unauthorized actions on the user's behalf.
2. **Credential Protection**: The main page's `localStorage`, `sessionStorage`, and non-`HttpOnly` cookies are inaccessible to the worker.
3. **Execution Safety**: If the LLM generates malicious code (e.g., via a hypothetical `eval` tool), the impact is limited to the worker's memory and the virtual filesystem.
4. **WASM Compatibility**: `esbuild-wasm`, `biome`, and `isomorphic-git` all work perfectly within Web Workers, ensuring no loss of functionality.

### Integration Strategy
To securely run the `browser-vite` example in a sandbox:
1. **Host Page**: Handles the UI (terminal, editor) and manages the `lofi-web-sandbox` instance.
2. **Sandbox Worker**:
   - Runs the `deepagents` graph.
   - Hosts the `JustBashBackend` and its virtual filesystem.
   - Executes tools (`git`, `esbuild`, `biome`) within the worker.
3. **Communication**: Uses the sandbox's RPC mechanism to send user inputs to the agent and receive tool outputs/logs for the terminal.
4. **API Proxying**: The host page can optionally proxy LLM requests to add another layer of security (e.g., stripping sensitive headers) and prevent the worker from needing direct internet access to the model provider.

## Evaluation Results
**Recommendation: Highly Recommended.**
Using `lofi-web-sandbox` in worker mode is the best way to transition from the current "playground" implementation to a production-ready, secure agent environment. It provides the necessary security boundaries while maintaining the high performance of the ported library.

## Next Steps
- Implement a prototype `SandboxedBashBackend` that wraps `JustBashBackend` but runs inside a `lofi-web-sandbox` worker.
- Define a standard RPC protocol for tool execution and VFS access between the host and the worker.
- Document CSP recommendations for host pages to further harden the environment.
