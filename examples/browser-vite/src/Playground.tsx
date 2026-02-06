import React, { useState, useEffect, useRef } from "react";
// @ts-ignore
import { Bash } from "just-bash";
import { esbuildTool } from "./esbuild-tool.js";
import { biomeTool } from "./biome-tool.js";
import { gitTool } from "./git-tool.js";
import { Terminal, Files, Play, Save, Upload, Download } from "lucide-react";

export const Playground = () => {
  const [bash] = useState(() => {
    const b = new Bash();
    b.registerCommand(esbuildTool);
    b.registerCommand(biomeTool);
    b.registerCommand(gitTool);
    return b;
  });

  const [output, setOutput] = useState("");
  const [command, setCommand] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshFiles();
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const refreshFiles = async () => {
    const allPaths = await bash.fs.getAllPaths();
    setFiles(allPaths.filter((p: string) => !p.startsWith("/.git")));
  };

  const handleRun = async () => {
    if (!command) return;
    const result = await bash.exec(command);
    setOutput(prev => prev + `\n$ ${command}\n${result.stdout}${result.stderr}`);
    setCommand("");
    refreshFiles();
  };

  const handleFileClick = async (path: string) => {
    try {
      const content = await bash.fs.readFile(path);
      setCurrentFile(path);
      setFileContent(content);
    } catch (e) {
      // It might be a directory
    }
  };

  const handleSave = async () => {
    if (currentFile) {
      await bash.fs.writeFile(currentFile, fileContent);
      setOutput(prev => prev + `\nSaved ${currentFile}\n`);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        await bash.fs.writeFile(`/${file.name}`, content);
        setOutput(prev => prev + `\nUploaded ${file.name}\n`);
        refreshFiles();
      }
    };
    reader.readAsText(file);
  };

  const handleDownload = async () => {
    if (!currentFile) return;
    try {
      const content = await bash.fs.readFile(currentFile);
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = currentFile.split("/").pop() || "download";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setOutput(prev => prev + `\nDownload error: ${e.message}\n`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-200 font-mono">
      <header className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Play className="text-green-400 w-5 h-5" /> Just-Bash Playground
        </h1>
        <div className="flex gap-4">
          <button onClick={() => window.location.pathname = "/"} className="text-sm hover:underline">Back to Agent</button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
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
              placeholder="Select a file or run a command to generate one..."
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
              {output || "Welcome to Just-Bash Playground.\nType a command below (e.g., 'ls', 'echo hello > world.txt', 'git init')."}
            </div>
            <div className="p-2 bg-slate-800 border-t border-slate-700 flex gap-2">
              <span className="text-green-400">$</span>
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
