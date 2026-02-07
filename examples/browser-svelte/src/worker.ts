import { Buffer } from "buffer";
(self as any).Buffer = Buffer;
(self as any).global = self;

import { Bash } from "just-bash";
import { esbuildTool } from "./esbuild-tool.js";
import { biomeTool } from "./biome-tool.js";
import { gitTool } from "./git-tool.js";

let bash: Bash;
let port: MessagePort;
let currentCwd = "/";

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

    bash = new Bash();
    bash.registerCommand(esbuildTool);
    bash.registerCommand(biomeTool);
    bash.registerCommand(gitTool);
    bash.registerCommand(helpTool);

    await bash.exec('cd /');

    // Simple bridge for xterm
    port.onmessage = async (ev) => {
      if (ev.data.type === 'INPUT') {
        const cmd = ev.data.data;
        const separator = "____CWD_SEPARATOR____";

        // We wrap the command to capture the CWD afterwards
        // This ensures cd works across calls
        const wrappedCommand = `${cmd}\necho -n "${separator}"\npwd`;

        try {
            const result = await bash.exec(wrappedCommand, { cwd: currentCwd });

            let stdout = result.stdout;
            if (stdout.includes(separator)) {
                const parts = stdout.split(separator);
                const pwdOutput = parts.pop()?.trim();
                if (pwdOutput) {
                    currentCwd = pwdOutput;
                }
                stdout = parts.join("");
            }

            port.postMessage({
              type: 'OUTPUT',
              stdout: stdout,
              stderr: result.stderr,
              exitCode: result.exitCode,
              cwd: currentCwd
            });
        } catch (err: any) {
            port.postMessage({
                type: 'OUTPUT',
                stdout: "",
                stderr: err.message,
                exitCode: 1,
                cwd: currentCwd
            });
        }
      } else if (ev.data.type === 'WRITE_FILE') {
          try {
              await bash.fs.writeFile(ev.data.path, ev.data.content);
              port.postMessage({ type: 'LOG', message: `Added file: ${ev.data.path}` });
          } catch (err: any) {
              port.postMessage({ type: 'LOG', message: `Error adding file: ${err.message}` });
          }
      }
    };

    port.postMessage({ type: 'READY' });
  }
};
export {};
