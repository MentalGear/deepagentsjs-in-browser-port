# Security in Deep Agents

Deep Agents empower LLMs with the ability to interact with the world through a filesystem and a shell. While this unlocks significant capabilities, it also introduces a large attack surface. This document outlines the risk surfaces, security boundaries, and recommended mitigation strategies.

## Risk Surfaces

When an LLM is granted tool access, it becomes a proxy for potential malicious actions. The primary risks include:

1.  **Arbitrary Code Execution**: An LLM can be prompted (or decide) to write and execute scripts that perform unintended actions on the host system.
2.  **Data Exfiltration**: If the agent has network access (e.g., through `curl` or `internet_search`), it could read sensitive files and send them to a remote server.
3.  **Destructive Actions**: The agent could delete critical system files, wipe databases, or overwrite configuration files.
4.  **Resource Exhaustion (DoS)**: An agent could start infinite loops, allocate massive amounts of memory, or fork-bomb the host system.
5.  **Indirect Prompt Injection**: If an agent reads a file from the internet or a shared workspace that contains malicious instructions, the agent may "follow" those instructions and compromise the system.

## Security Boundaries

`deepagents` is designed with pluggable backends that define the security boundary between the agent and the user system.

### 1. The Virtual Filesystem Boundary (`LocalSandboxBackend`)
This is the **safest** boundary for browser-based applications.
-   **Isolation**: The filesystem exists entirely in the browser's memory (or IndexedDB). It has no access to the user's real files.
-   **Execution**: Commands run in a simulated shell environment (`just-bash`) implemented in TypeScript/WASM. It cannot spawn real processes or access host OS APIs.
-   **Network**: Network access is disabled by default and can be restricted to specific URL allow-lists.

### 2. The Native Browser Boundary (`FileSystemAccessBackend`)
This uses the Browser File System Access API.
-   **User Control**: The agent can only access directories explicitly selected by the user through a system picker.
-   **Permission Persistence**: Permissions are scoped to the session and require explicit user re-approval for subsequent sessions.
-   **System Isolation**: The browser's intrinsic sandbox prevents the agent from escaping the selected directory or interacting with other parts of the OS (like `/etc/` or Registry).

### 3. The Node.js Host Boundary (`FilesystemBackend`)
This is the **highest risk** boundary and requires significant host-level mitigation.
-   **Implicit Trust**: By default, this backend runs as the user executing the Node.js process. It can access anything the user can.
-   **Traversal Protection**: While `deepagents` includes logic to prevent path traversal (`..`), this should not be relied upon as the sole security layer.

## Recommended Mitigations

### For Node.js Deployments (Server-side)

1.  **Containerization**: ALWAYS run the agent in a container (e.g., Docker). Use a minimal base image.
2.  **Unprivileged User**: Never run the agent as `root`. Create a dedicated user with restricted permissions.
3.  **Restricted Workspace**: Mount only the necessary workspace directory into the container. Use read-only mounts for libraries or reference data.
4.  **Network Sandboxing**: Use tools like `iptables` or cloud-provider security groups to block all outbound traffic except to authorized LLM providers and specific APIs.
5.  **Kernel Isolation**: For high-security environments, consider using `gVisor` or `Kata Containers` to provide a stronger boundary between the agent container and the host kernel.
6.  **Monitoring and Timeouts**: Implement strict timeouts on tool execution and monitor CPU/Memory usage to kill runaway agents.

### For Browser Deployments (Client-side)

1.  **Content Security Policy (CSP)**: Implement a strict CSP that limits the origins the browser tab can connect to. This prevents an agent from "calling home" with stolen data.
2.  **Virtualization by Default**: Prefer `LocalSandboxBackend` for general tasks. Only use `FileSystemAccessBackend` when the user explicitly needs the agent to modify their local files.
3.  **Human-in-the-Loop (HITL)**: Use the `interruptOn` configuration for sensitive tools (like `write_file` or `execute`). This forces the agent to ask for user approval before proceeding.

### For Both Environments

1.  **Prompt Engineering**: Use the system prompt to define the agent's "rules of engagement," but remember that prompts can be bypassed via injection.
2.  **Sanitized Outputs**: When displaying agent activity to the user, ensure all outputs are sanitized to prevent Cross-Site Scripting (XSS).
3.  **Audit Logging**: Log every tool call, including arguments and results, to a secure location for later review.

## Summary: Choosing a Backend

| Backend | Environment | Security Level | Best Use Case |
| :--- | :--- | :--- | :--- |
| **LocalSandboxBackend** | Browser | **High** | Safe, ephemeral playgrounds and sandboxed execution. |
| **StateBackend** | Browser / Node | **High** | Ephemeral file storage within the agent's state. |
| **FileSystemAccessBackend**| Browser | **Medium** | User-controlled modification of local directories. |
| **FilesystemBackend** | Node | **Low** | Local CLI tools or server-side agents (requires Docker). |

## Browser Sandboxing Architectures

When deploying `deepagents` in a browser, you must decide whether to run the agent in the main thread or in an isolated context (Web Worker or Iframe).

### Option 1: Whole System in a Web Worker (Recommended)
Running the entire agent logic, including orchestrations and `LocalSandboxBackend`, inside a Web Worker.
-   **Pros**:
    -   **UI Responsiveness**: Graph execution and heavy tool calls (like complex `rg` searches) happen off-thread.
    -   **Credential Isolation**: You can pass the API key into the worker and keep it out of the reach of most main-thread-focused XSS attacks.
    -   **Logical Isolation**: Prevents the agent's internal state (which might contain sensitive tool results) from being easily inspected by main-thread scripts.
-   **Cons**: No direct access to the DOM or certain browser APIs (requires message passing).

### Option 2: Whole System in an Iframe (Strongest Isolation)
Running the agent in a cross-origin Iframe.
-   **Pros**:
    -   **Origin Isolation**: The agent runs in a completely different origin. It cannot access the parent site's cookies, LocalStorage, or IndexedDB.
    -   **XSS Protection**: Malicious output from the agent (e.g., in a preview) is trapped in the Iframe sandbox.
-   **Cons**: Highest complexity; requires a robust `postMessage` bridge for all interactions.

### Option 3: Tool-only Sandboxing (Default)
Running the agent in the main thread, but using a sandboxed backend like `LocalSandboxBackend`.
-   **Pros**: Easiest to implement; standard integration.
-   **Cons**: If a vulnerability exists in the orchestration layer (LangGraph/LangChain) that allows for remote code execution via a tool result, the attacker could gain control of the main thread and steal the user's API keys or session cookies.

### Verdict: Which should you use?
For production browser applications, **Option 1 (Web Worker)** is the sweet spot between security and ease of use. It protects the UI thread and provides a meaningful boundary for secrets. Use **Option 2 (Iframe)** if your agent will handle extremely sensitive user data or run untrusted code that requires protection against origin-level attacks.
