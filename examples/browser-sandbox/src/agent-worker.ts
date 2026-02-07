import { Buffer } from "buffer";
(self as any).Buffer = Buffer;
(self as any).global = self;

import { Bash } from "just-bash";
import { LocalSandboxBackend } from "deepagents";
import { esbuildTool } from "./esbuild-tool.js";
import { biomeTool } from "./biome-tool.js";
import { gitTool } from "./git-tool.js";

let bash: Bash;
let backend: LocalSandboxBackend;
let port: MessagePort;

const helpTool = {
  name: "help",
  execute: async (args: string[]) => {
    const commands = Object.keys((bash as any).commands).sort();
    return {
      stdout: `Available commands:\n${commands.join(", ")}\n`,
      stderr: "",
      exitCode: 0
    };
  }
};

self.onmessage = async (e) => {
  if (e.data.type === 'INIT_PORT') {
    port = e.ports[0];

    try {
        bash = new Bash();
        bash.registerCommand(esbuildTool);
        bash.registerCommand(biomeTool);
        bash.registerCommand(gitTool);
        bash.registerCommand(helpTool);
        backend = new LocalSandboxBackend(bash);

        ['log', 'error', 'warn', 'info'].forEach(level => {
          const original = (console as any)[level];
          (console as any)[level] = (...args: any[]) => {
            if (original) original.apply(console, args);
            port.postMessage({ type: 'LOG', level, args });
          };
        });

        port.onmessage = async (ev) => {
          if (ev.data.type === 'EXECUTE') {
            const command = ev.data.code;
            try {
              const result = await bash.exec(command);

              const cwdOutput = await bash.exec('pwd');
              const cwd = cwdOutput.stdout.trim();
              const allPaths = await bash.fs.getAllPaths();

              port.postMessage({
                type: 'LOG',
                level: 'info',
                args: [`\n$ ${command}\n${result.stdout}${result.stderr}`]
              });

              port.postMessage({
                type: 'STATE',
                cwd,
                files: allPaths.filter((p: string) => !p.startsWith("/.git"))
              });
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

                  const cwdOutput = await bash.exec('pwd');
                  const cwd = cwdOutput.stdout.trim();
                  const allPaths = await bash.fs.getAllPaths();

                  port.postMessage({ type: 'LOG', level: 'info', args: [`Saved ${ev.data.path}`] });
                  port.postMessage({
                      type: 'STATE',
                      cwd,
                      files: allPaths.filter((p: string) => !p.startsWith("/.git"))
                  });
              } catch (err: any) {
                  port.postMessage({ type: 'LOG', level: 'error', args: [`Write error: ${err.message}`] });
              }
          }
        };

        const initialCwdOutput = await bash.exec('pwd');
        const initialCwd = initialCwdOutput.stdout.trim();
        const initialPaths = await bash.fs.getAllPaths();

        port.postMessage({ type: 'LOG', level: 'info', args: ['Agent Worker Ready (Sandboxed)'] });

        port.postMessage({
            type: 'STATE',
            cwd: initialCwd,
            files: initialPaths.filter((p: string) => !p.startsWith("/.git"))
        });
    } catch (err: any) {
        port.postMessage({ type: 'LOG', level: 'error', args: [`Worker initialization failed: ${err.message}`] });
    }
  }
};
export {};
