import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { createDeepAgent, JustBashBackend, FileSystemAccessBackend } from "deepagents";
import { ChatAnthropic } from "@langchain/anthropic";
// @ts-ignore
import { Bash } from "just-bash";
import { esbuildTool } from "./esbuild-tool.js";
import { biomeTool } from "./biome-tool.js";
import { gitTool } from "./git-tool.js";
import { Playground } from "./Playground.js";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

const App = () => {
  const [apiKey, setApiKey] = useState(localStorage.getItem("anthropic_api_key") || "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [backendType, setBackendType] = useState<"just-bash" | "fs-access">("just-bash");
  const agentRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem("anthropic_api_key", apiKey);
  }, [apiKey]);

  const initAgent = async () => {
    if (!apiKey) return alert("Please enter an Anthropic API Key");

    const model = new ChatAnthropic({
      anthropicApiKey: apiKey,
      modelName: "claude-3-5-sonnet-20241022",
      clientOptions: {
        dangerouslyAllowBrowser: true,
      }
    });

    let backend: any;
    if (backendType === "just-bash") {
      const bash = new Bash();
      bash.registerCommand(esbuildTool);
      bash.registerCommand(biomeTool);
      bash.registerCommand(gitTool);
      backend = new JustBashBackend(bash);
    } else {
      // @ts-ignore
      const handle = await window.showDirectoryPicker();
      backend = new FileSystemAccessBackend(handle);
    }

    agentRef.current = createDeepAgent({
      model: model as any,
      backend: () => backend,
    });

    setMessages([{ role: "assistant", content: `Agent initialized with ${backendType} backend. How can I help you today?` }]);
  };

  const handleSend = async () => {
    if (!input || !agentRef.current) return;

    const userMsg: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await agentRef.current.invoke({
        messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
      });

      const lastMsg = response.messages[response.messages.length - 1];
      setMessages(prev => [...prev, { role: "assistant", content: lastMsg.content as string }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 font-sans">
      <header className="mb-8 border-b pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-slate-800">Deep Agents Browser Example</h1>
          <p className="text-slate-500">Run fully autonomous AI agents in your browser tab.</p>
        </div>
        <button
          onClick={() => {
            window.history.pushState({}, "", "/playground");
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
          className="text-sm bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded text-slate-600 mb-1"
        >
          Open Playground
        </button>
      </header>

      {!agentRef.current ? (
        <div className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
          <div>
            <label htmlFor="api-key" className="block text-sm font-medium mb-1">Anthropic API Key</label>
            <input
              id="api-key"
              type="password"
              className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="sk-ant-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="backend-type" className="block text-sm font-medium mb-1">Backend Type</label>
            <select
              id="backend-type"
              className="w-full border rounded p-2"
              value={backendType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBackendType(e.target.value as any)}
            >
              <option value="just-bash">Virtual Filesystem (In-Memory Just-Bash)</option>
              <option value="fs-access">Native Local Directory (File System Access API)</option>
            </select>
          </div>
          <button
            onClick={initAgent}
            className="w-full bg-blue-600 text-white rounded p-2 font-medium hover:bg-blue-700 transition"
          >
            Initialize Agent
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white border rounded-lg h-[500px] overflow-y-auto p-4 space-y-4 shadow-sm">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg p-3 ${m.role === "user" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                  <p className="whitespace-pre-wrap text-sm font-medium mb-1 opacity-70 uppercase text-[10px] tracking-wider">{m.role}</p>
                  <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-lg p-3 animate-pulse">
                  <p className="text-sm text-slate-400 italic">Agent is thinking and executing tools...</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {["List files", "Create a Svelte component and bundle it", "Format code with biome", "Search for 'agent' in src"].map(prompt => (
              <button
                key={prompt}
                onClick={() => setInput(prompt)}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded"
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ask the agent to do something..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              className="bg-blue-600 text-white rounded-lg px-6 font-medium hover:bg-blue-700 transition disabled:opacity-50"
              disabled={isLoading}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const Root = () => {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  if (path === "/playground") {
    return <Playground />;
  }

  return <App />;
};

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>
  );
}
