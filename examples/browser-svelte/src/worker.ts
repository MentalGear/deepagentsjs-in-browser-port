import { Buffer } from "buffer";
(self as any).Buffer = Buffer;
(self as any).global = self;

import { Bash, defineCommand } from "just-bash";
import { esbuildTool } from "./esbuild-tool.js";
import { biomeTool } from "./biome-tool.js";
import { gitTool } from "./git-tool.ts";

let bash: Bash;
let currentCwd = "/home/user";

// Custom clear command to send clear signal to terminal
const clearCommand = defineCommand("clear", async () => {
  self.postMessage({ type: "clear" });
  return { stdout: "", stderr: "", exitCode: 0 };
});

const helpTool = defineCommand("help", async (args: string[]) => {
    const commands = Object.keys((bash as any).commands).sort();
    return {
      stdout: `Available commands:\n${commands.join(", ")}\n`,
      stderr: "",
      exitCode: 0
    };
});

function initBash(files: Record<string, string> = {}) {
    bash = new Bash({
        customCommands: [clearCommand, gitTool, esbuildTool, biomeTool, helpTool],
        files: {
          "/home/user/.bashrc": 'export PS1="$ "',
          "/home/user/README.txt":
            "Welcome to deepagents browser playground!\n\nThis is a bash interpreter running entirely in your browser.\nAvailable tools: git, esbuild, biome.\n",
          "/home/user/example.json": '{"name": "deepagents", "version": "1.0"}',
          ...files,
        },
        cwd: "/home/user",
        env: {
          HOME: "/home/user",
          USER: "user",
          PATH: "/bin:/usr/bin",
          SHELL: "/bin/bash",
          TERM: "xterm-256color",
        },
    });
    currentCwd = "/home/user";
}

self.onmessage = async (e) => {
    const msg = e.data;

    try {
        if (msg.type === 'INIT_PORT' || msg.type === 'init') {
            initBash(msg.files);
            self.postMessage({ type: 'ready' });
            self.postMessage({ type: 'cwd', cwd: currentCwd });
        } else if (msg.type === 'exec') {
            const cmd = msg.command;
            const separator = "____CWD_SEPARATOR____";
            const wrappedCommand = `${cmd}\necho -n "${separator}"\npwd`;

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

            self.postMessage({
                type: 'result',
                id: msg.id,
                stdout: stdout,
                stderr: result.stderr,
                exitCode: result.exitCode,
            });
            self.postMessage({ type: 'cwd', cwd: currentCwd });
        } else if (msg.type === 'readFile') {
            const content = await bash.fs.readFile(msg.path);
            self.postMessage({ type: 'file', id: msg.id, content });
        } else if (msg.type === 'writeFile') {
            await bash.fs.writeFile(msg.path, msg.content);
            self.postMessage({ type: 'written', id: msg.id });
            self.postMessage({ type: 'log', message: `Added file: ${msg.path}` });
        }
    } catch (err: any) {
        self.postMessage({
            type: 'error',
            id: msg.id,
            message: err.message
        });
    }
};

// Initial init
initBash();
self.postMessage({ type: 'ready' });
self.postMessage({ type: 'cwd', cwd: currentCwd });

export {};
