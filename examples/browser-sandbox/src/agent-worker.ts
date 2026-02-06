import { Buffer } from "buffer";
(self as any).Buffer = Buffer;

import { Bash } from "just-bash";
import { LocalSandboxBackend } from "deepagents";
import { esbuildTool } from "./esbuild-tool.js";
import { biomeTool } from "./biome-tool.js";
import { gitTool } from "./git-tool.js";

let bash: Bash;
let backend: LocalSandboxBackend;
let port: MessagePort;

self.onmessage = async (e) => {
  if (e.data.type === 'INIT_PORT') {
    port = e.ports[0];

    // Initialize bash and backend
    bash = new Bash();
    bash.registerCommand(esbuildTool);
    bash.registerCommand(biomeTool);
    bash.registerCommand(gitTool);
    backend = new LocalSandboxBackend(bash);

    // Patch console to send logs to port
    ['log', 'error', 'warn', 'info'].forEach(level => {
      (console as any)[level] = (...args: any[]) => {
        port.postMessage({ type: 'LOG', level, args });
      };
    });

    port.onmessage = async (ev) => {
      if (ev.data.type === 'EXECUTE') {
        const command = ev.data.code;
        try {
          const result = await bash.exec(command);
          port.postMessage({
            type: 'LOG',
            level: 'info',
            args: [`\n$ ${command}\n${result.stdout}${result.stderr}`]
          });

          const allPaths = await bash.fs.getAllPaths();
          port.postMessage({ type: 'FILES', files: allPaths.filter((p: string) => !p.startsWith("/.git")) });
        } catch (err: any) {
          port.postMessage({ type: 'LOG', level: 'error', args: [err.message] });
        }
      } else if (ev.data.type === 'READ_FILE') {
          try {
              const content = await bash.fs.readFile(ev.data.path);
              port.postMessage({ type: 'FILE_CONTENT', path: ev.data.path, content });
          } catch (err: any) {
              port.postMessage({ type: 'LOG', level: 'error', args: [`Read error: ${err.message}`] });
          }
      } else if (ev.data.type === 'WRITE_FILE') {
          try {
              await bash.fs.writeFile(ev.data.path, ev.data.content);
              port.postMessage({ type: 'LOG', level: 'info', args: [`Saved ${ev.data.path}`] });
              const allPaths = await bash.fs.getAllPaths();
              port.postMessage({ type: 'FILES', files: allPaths.filter((p: string) => !p.startsWith("/.git")) });
          } catch (err: any) {
              port.postMessage({ type: 'LOG', level: 'error', args: [`Write error: ${err.message}`] });
          }
      }
    };

    port.postMessage({ type: 'LOG', level: 'info', args: ['Agent Worker Ready (Sandboxed)'] });

    const allPaths = await bash.fs.getAllPaths();
    port.postMessage({ type: 'FILES', files: allPaths.filter((p: string) => !p.startsWith("/.git")) });
  }
};
