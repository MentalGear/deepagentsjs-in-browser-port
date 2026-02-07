<script lang="ts">
  import { onMount } from 'svelte';
  import { Terminal } from 'xterm';
  import { FitAddon } from 'xterm-addon-fit';
  import 'xterm/css/xterm.css';
  import workerUrl from './worker?worker&url';

  let terminalElement: HTMLDivElement;
  let terminal: Terminal;
  let fitAddon: FitAddon;
  let worker: Worker;
  let port: MessagePort;
  let currentCommand = '';
  let cwd = '/';

  onMount(() => {
    terminal = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#1e1e1e',
      }
    });
    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalElement);
    fitAddon.fit();

    terminal.writeln('DeepAgents Svelte Playground');
    terminal.writeln('Initializing shell...');

    worker = new Worker(workerUrl, { type: 'module' });
    const channel = new MessageChannel();
    port = channel.port1;

    port.onmessage = (e) => {
      const data = e.data;
      if (data.type === 'READY') {
        terminal.writeln('Shell ready.');
        prompt();
      } else if (data.type === 'OUTPUT') {
        if (data.stdout) terminal.write(data.stdout.replace(/\n/g, '\r\n'));
        if (data.stderr) terminal.write('\x1b[31m' + data.stderr.replace(/\n/g, '\r\n') + '\x1b[0m');
        cwd = data.cwd;
        prompt();
      } else if (data.type === 'LOG') {
          terminal.writeln('\r\n\x1b[32m' + data.message + '\x1b[0m');
          prompt();
      }
    };

    worker.postMessage({ type: 'INIT_PORT' }, [channel.port2]);

    terminal.onData(data => {
      if (data === '\r') { // Enter
        terminal.write('\r\n');
        if (currentCommand.trim()) {
          port.postMessage({ type: 'INPUT', data: currentCommand });
        } else {
          prompt();
        }
        currentCommand = '';
      } else if (data === '\u007f') { // Backspace
        if (currentCommand.length > 0) {
          currentCommand = currentCommand.slice(0, -1);
          terminal.write('\b \b');
        }
      } else {
        currentCommand += data;
        terminal.write(data);
      }
    });

    return () => {
      worker.terminate();
    };
  });

  function prompt() {
    terminal.write(`\r\n\x1b[34m${cwd}\x1b[0m $ `);
  }

  async function addFile() {
    const filename = prompt_user('Enter filename:', 'hello.txt');
    if (!filename) return;
    const content = prompt_user('Enter content:', 'Hello from Svelte!');
    if (content === null) return;

    port.postMessage({ type: 'WRITE_FILE', path: filename, content });
  }

  // Wrapper for browser prompt to avoid naming conflict with our prompt() function
  function prompt_user(msg: string, def: string) {
      return window.prompt(msg, def);
  }
</script>

<main style="display: flex; flexDirection: column; height: 100vh; background: #1e1e1e; color: white; padding: 1rem;">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
    <h1 style="margin: 0; font-size: 1.5rem;">DeepAgents Svelte Shell</h1>
    <button
      onclick={addFile}
      style="padding: 0.5rem 1rem; cursor: pointer; background: #444; color: white; border: 1px solid #666; border-radius: 4px;"
    >
      Add File
    </button>
  </div>

  <div bind:this={terminalElement} style="flex: 1; min-height: 0;"></div>
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
</style>
