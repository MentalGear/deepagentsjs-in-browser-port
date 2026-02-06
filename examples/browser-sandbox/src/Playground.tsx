import React, { useState, useEffect, useRef } from "react";
import { Terminal, Files, Play, Save, Upload, Download, Shield } from "lucide-react";
import "../vendor/lofi-web-sandbox/src/host";
import agentWorkerUrl from "./agent-worker?worker&url";

export const Playground = () => {
  const [output, setOutput] = useState("");
  const [command, setCommand] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);
  const sandboxRef = useRef<any>(null);

  useEffect(() => {
    if (sandboxRef.current) {
        sandboxRef.current.setConfig({
            mode: 'worker',
            workerUrl: agentWorkerUrl
        });

        const handleSandboxLog = (e: any) => {
            const { level, args } = e.detail;
            const text = args.map((a: any) => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
            setOutput(prev => prev + `\n[${level}] ${text}`);
        };

        const handleFiles = (e: MessageEvent) => {
            if (e.data.type === 'FILES') {
                setFiles(e.data.files);
            } else if (e.data.type === 'FILE_CONTENT') {
                setCurrentFile(e.data.path);
                setFileContent(e.data.content);
            }
        };

        window.addEventListener('sandbox-log' as any, handleSandboxLog);

        // We need to listen to messages from the sandbox port.
        // LofiSandbox should ideally expose the port or bubble these up.
        // For now, we'll use a hack to get the port from the private field or modify host.ts to bubble up non-LOG messages.
        // Actually, let's modify host.ts to bubble up all messages.
    }

    return () => {
        window.removeEventListener('sandbox-log' as any, () => {});
    };
  }, []);

  // Modify host.ts to bubble up all messages from the port
  useEffect(() => {
      const interval = setInterval(() => {
          if (sandboxRef.current && sandboxRef.current._port) {
              const originalOnMessage = sandboxRef.current._port.onmessage;
              sandboxRef.current._port.onmessage = (e: MessageEvent) => {
                  originalOnMessage(e);
                  if (e.data.type === 'FILES') {
                      setFiles(e.data.files);
                  } else if (e.data.type === 'FILE_CONTENT') {
                      setCurrentFile(e.data.path);
                      setFileContent(e.data.content);
                  }
              };
              clearInterval(interval);
          }
      }, 100);
      return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const handleRun = async () => {
    if (!command || !sandboxRef.current) return;
    sandboxRef.current.execute(command);
    setCommand("");
  };

  const handleFileClick = async (path: string) => {
    if (sandboxRef.current && sandboxRef.current._port) {
        sandboxRef.current._port.postMessage({ type: 'READ_FILE', path });
    }
  };

  const handleSave = async () => {
    if (currentFile && sandboxRef.current && sandboxRef.current._port) {
      sandboxRef.current._port.postMessage({ type: 'WRITE_FILE', path: currentFile, content: fileContent });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result;
      if (typeof content === "string" && sandboxRef.current && sandboxRef.current._port) {
        sandboxRef.current._port.postMessage({ type: 'WRITE_FILE', path: `/${file.name}`, content });
      }
    };
    reader.readAsText(file);
  };

  const handleDownload = async () => {
    if (!currentFile) return;
    const blob = new Blob([fileContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentFile.split("/").pop() || "download";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-200 font-mono">
      <header className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Shield className="text-blue-400 w-5 h-5" /> Sandboxed Agent Playground
        </h1>
        <div className="flex gap-4">
          <button onClick={() => window.location.pathname = "/"} className="text-sm hover:underline">Back to Agent</button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Hidden Sandbox Component */}
        <lofi-sandbox ref={sandboxRef} style={{ display: 'none' }}></lofi-sandbox>

        {/* Sidebar: Files */}
        <aside className="w-64 border-r border-slate-700 p-4 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Files className="w-4 h-4" /> Files
            </h2>
            <label className="cursor-pointer hover:text-white" title="Upload File">
              <Upload className="w-4 h-4" />
              <input type="file" className="hidden" onChange={handleUpload} />
            </label>
          </div>
          <ul className="space-y-1 flex-1 overflow-y-auto">
            {files.map(f => (
              <li
                key={f}
                onClick={() => handleFileClick(f)}
                className={`cursor-pointer hover:text-white truncate p-1 rounded ${currentFile === f ? 'bg-slate-800' : ''}`}
              >
                {f}
              </li>
            ))}
          </ul>
        </aside>

        {/* Main Content: Editor and Terminal */}
        <main className="flex-1 flex flex-col">
          {/* Editor */}
          <div className="flex-1 p-4 flex flex-col bg-slate-950">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-slate-500">{currentFile || "No file selected"}</span>
              <div className="flex gap-4">
                {currentFile && (
                  <>
                    <button onClick={handleDownload} className="text-xs flex items-center gap-1 hover:text-white">
                      <Download className="w-3 h-3" /> Download
                    </button>
                    <button onClick={handleSave} className="text-xs flex items-center gap-1 hover:text-white">
                      <Save className="w-3 h-3" /> Save
                    </button>
                  </>
                )}
              </div>
            </div>
            <textarea
              className="flex-1 bg-transparent border-none outline-none resize-none text-slate-300"
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              placeholder="Select a file or run a command in the terminal below. Execution happens inside a secure Web Worker sandbox."
            />
          </div>

          {/* Terminal */}
          <div className="h-64 border-t border-slate-700 flex flex-col">
            <div className="flex items-center gap-2 p-2 bg-slate-800 text-xs uppercase tracking-wider text-slate-500">
              <Terminal className="w-3 h-3" /> Terminal
            </div>
            <div
              ref={outputRef}
              className="flex-1 overflow-y-auto p-4 text-sm whitespace-pre-wrap selection:bg-slate-700"
            >
              {output || "Sandboxed Agent is ready.\nCommands run in an isolated environment."}
            </div>
            <div className="p-2 bg-slate-800 border-t border-slate-700 flex gap-2">
              <span className="text-blue-400">$</span>
              <input
                className="flex-1 bg-transparent border-none outline-none"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRun()}
                placeholder="type command..."
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'lofi-sandbox': any;
    }
  }
}
