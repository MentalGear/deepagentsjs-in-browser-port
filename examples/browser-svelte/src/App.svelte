<script lang="ts">
  import { onMount } from 'svelte';
  import { Terminal } from '@xterm/xterm';
  import { FitAddon } from '@xterm/addon-fit';
  import '@xterm/xterm/css/xterm.css';
  import workerUrl from './worker?worker&url';

  let terminalElement: HTMLDivElement;
  let terminal: Terminal;
  let fitAddon: FitAddon;
  let worker: Worker;
  let isReady = $state(false);
  let statusText = $state('Initializing...');
  let statusClass = $state('');
  let commandBuffer = '';
  let commandHistory: string[] = [];
  let historyIndex = -1;
  let currentLine = "";
  let cwd = $state('/');

  const pendingCallbacks = new Map<string, (result: any) => void>();
  let callbackId = 0;

  onMount(() => {
    terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: "#0f0f23",
        foreground: "#cccccc",
        cursor: "#e94560",
        cursorAccent: "#0f0f23",
        selectionBackground: "#3d3d5c",
        black: "#1a1a2e",
        red: "#e94560",
        green: "#4caf50",
        yellow: "#ff9800",
        blue: "#2196f3",
        magenta: "#9c27b0",
        cyan: "#00bcd4",
        white: "#eee",
        brightBlack: "#666",
        brightRed: "#ff6b6b",
        brightGreen: "#69f0ae",
        brightYellow: "#ffca28",
        brightBlue: "#64b5f6",
        brightMagenta: "#ce93d8",
        brightCyan: "#4dd0e1",
        brightWhite: "#fff",
      },
    });

    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalElement);
    fitAddon.fit();

    window.addEventListener('resize', () => fitAddon.fit());

    worker = new Worker(workerUrl, { type: 'module' });

    worker.onmessage = (event) => {
      const msg = event.data;

      switch (msg.type) {
        case "ready":
          isReady = true;
          setStatus("ready", "Ready");
          terminal.writeln("\x1b[1;32mjust-bash\x1b[0m v1.0 - A bash interpreter in your browser");
          terminal.writeln("Type \x1b[1;36mhelp\x1b[0m for available commands");
          terminal.writeln("");
          prompt();
          break;

        case "result":
          if (pendingCallbacks.has(msg.id)) {
            pendingCallbacks.get(msg.id)!(msg);
            pendingCallbacks.delete(msg.id);
          }
          break;

        case "clear":
          terminal.clear();
          break;

        case "cwd":
            cwd = msg.cwd;
            break;

        case "log":
            terminal.writeln('\r\n\x1b[32m' + msg.message + '\x1b[0m');
            prompt();
            break;

        case "error":
          if (msg.id && pendingCallbacks.has(msg.id)) {
            pendingCallbacks.get(msg.id)!({
              stdout: "",
              stderr: msg.message,
              exitCode: 1,
            });
            pendingCallbacks.delete(msg.id);
          } else {
            terminal.writeln("\x1b[31mError: " + msg.message + "\x1b[0m");
          }
          break;
      }
    };

    worker.onerror = (error) => {
      setStatus("", "Error");
      terminal.writeln("\x1b[31mWorker error: " + error.message + "\x1b[0m");
    };

    terminal.onData((data) => {
      if (!isReady) return;

      const code = data.charCodeAt(0);

      // Enter key
      if (data === "\r") {
        terminal.writeln("");
        processCommand(commandBuffer);
        commandBuffer = "";
        currentLine = "";
        return;
      }

      // Backspace
      if (data === "\x7f") {
        if (commandBuffer.length > 0) {
          commandBuffer = commandBuffer.slice(0, -1);
          terminal.write("\b \b");
        }
        return;
      }

      // Ctrl+C
      if (data === "\x03") {
        terminal.writeln("^C");
        commandBuffer = "";
        prompt();
        return;
      }

      // Ctrl+L (clear)
      if (data === "\x0c") {
        terminal.clear();
        prompt();
        terminal.write(commandBuffer);
        return;
      }

      // Ctrl+U (clear line)
      if (data === "\x15") {
        terminal.write("\r\x1b[K");
        prompt();
        commandBuffer = "";
        return;
      }

      // Arrow keys (escape sequences)
      if (data.startsWith("\x1b[")) {
        // Up arrow
        if (data === "\x1b[A") {
          if (historyIndex > 0) {
            historyIndex--;
            terminal.write("\r\x1b[K");
            prompt();
            commandBuffer = commandHistory[historyIndex];
            terminal.write(commandBuffer);
          }
          return;
        }

        // Down arrow
        if (data === "\x1b[B") {
          if (historyIndex < commandHistory.length - 1) {
            historyIndex++;
            terminal.write("\r\x1b[K");
            prompt();
            commandBuffer = commandHistory[historyIndex];
            terminal.write(commandBuffer);
          } else if (historyIndex === commandHistory.length - 1) {
            historyIndex = commandHistory.length;
            terminal.write("\r\x1b[K");
            prompt();
            commandBuffer = currentLine;
            terminal.write(commandBuffer);
          }
          return;
        }
        return;
      }

      // Regular character
      if (code >= 32 && code < 127) {
        commandBuffer += data;
        terminal.write(data);
      }
    });

    terminal.focus();

    return () => {
      worker.terminate();
    };
  });

  function setStatus(status: string, text: string) {
    statusClass = status;
    statusText = text;
  }

  function prompt() {
    terminal.write(`\x1b[1;34m${cwd}\x1b[0m \x1b[1;32m$\x1b[0m `);
  }

  async function execCommand(command: string): Promise<any> {
    return new Promise((resolve) => {
      const id = String(callbackId++);
      pendingCallbacks.set(id, resolve);
      worker.postMessage({ type: "exec", id, command });
    });
  }

  async function processCommand(cmd: string) {
    const trimmed = cmd.trim();

    if (!trimmed) {
      prompt();
      return;
    }

    if (commandHistory[commandHistory.length - 1] !== trimmed) {
      commandHistory.push(trimmed);
    }
    historyIndex = commandHistory.length;

    setStatus("busy", "Running...");

    try {
      const result = await execCommand(trimmed);

      if (result.stdout) {
        const lines = result.stdout.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (i < lines.length - 1 || lines[i]) {
            terminal.writeln(lines[i].replace(/\n/g, '\r\n'));
          }
        }
      }

      if (result.stderr) {
        const lines = result.stderr.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (i < lines.length - 1 || lines[i]) {
            terminal.writeln("\x1b[31m" + lines[i].replace(/\n/g, '\r\n') + "\x1b[0m");
          }
        }
      }
    } catch (err) {
      terminal.writeln("\x1b[31mError: " + (err instanceof Error ? err.message : err) + "\x1b[0m");
    }

    setStatus("ready", "Ready");
    prompt();
  }

  async function addFile() {
    const filename = window.prompt('Enter filename:', 'hello.txt');
    if (!filename) return;
    const content = window.prompt('Enter content:', 'Hello from Svelte!');
    if (content === null) return;

    worker.postMessage({ type: 'writeFile', path: filename, content });
  }

  function resetShell() {
    if (confirm('Are you sure you want to reset the shell? All unsaved data will be lost.')) {
        terminal.clear();
        worker.postMessage({ type: 'init' });
    }
  }
</script>

<div class="app-container">
  <header>
    <div class="header-content">
        <div>
            <h1>DeepAgents Shell</h1>
            <p>Full POSIX environment in your browser</p>
        </div>
        <div class="header-actions">
            <a href="/virtual-files/" class="nav-link">Virtual Files Demo</a>
            <button onclick={resetShell} class="reset-btn">Reset</button>
            <button onclick={addFile} class="add-file-btn">Add File</button>
        </div>
    </div>
  </header>

  <main>
    <div id="terminal-container" bind:this={terminalElement} onclick={() => terminal.focus()}>
    </div>
  </main>

  <div class="status-bar">
    <div class="status-indicator">
      <div class="status-dot {statusClass}"></div>
      <span>{statusText}</span>
    </div>
    <div class="help-text">Type "help" for available commands</div>
  </div>
</div>

<style>
  :global(html, body) {
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  .app-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #1a1a2e;
    color: #eee;
  }

  header {
    padding: 1rem 2rem;
    background: #16213e;
    border-bottom: 1px solid #0f3460;
    flex-shrink: 0;
  }

  .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
  }

  header h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #e94560;
    margin: 0;
  }

  header p {
    color: #888;
    font-size: 0.9rem;
    margin-top: 0.25rem;
    margin: 0;
  }

  .add-file-btn {
      padding: 0.5rem 1rem;
      cursor: pointer;
      background: #e94560;
      color: white;
      border: none;
      border-radius: 4px;
      font-weight: 600;
      transition: background 0.2s;
  }

  .add-file-btn:hover {
      background: #ff5d7a;
  }

  .header-actions {
      display: flex;
      gap: 1rem;
      align-items: center;
  }

  .nav-link {
      color: #888;
      text-decoration: none;
      font-size: 0.9rem;
  }

  .nav-link:hover {
      color: #eee;
      text-decoration: underline;
  }

  .reset-btn {
      padding: 0.5rem 1rem;
      cursor: pointer;
      background: transparent;
      color: #888;
      border: 1px solid #444;
      border-radius: 4px;
  }

  .reset-btn:hover {
      color: #eee;
      border-color: #666;
  }

  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 1rem;
    min-height: 0;
  }

  #terminal-container {
    flex: 1;
    background: #0f0f23;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #333;
    min-height: 0;
    padding: 4px;
  }

  .status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    background: #16213e;
    border-top: 1px solid #0f3460;
    font-size: 0.85rem;
    flex-shrink: 0;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #888;
  }

  .status-dot.ready {
    background: #4caf50;
  }

  .status-dot.busy {
    background: #ff9800;
  }

  .help-text {
    color: #666;
  }

  @media (max-width: 600px) {
    header {
      padding: 0.75rem 1rem;
    }

    main {
      padding: 0.5rem;
    }
  }
</style>
