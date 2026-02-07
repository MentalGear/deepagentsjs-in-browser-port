import React, { useState, useEffect, useRef } from 'react';
import { LofiSandbox } from './lofi-sandbox.js';
import workerUrl from './agent-worker?worker&url';

export const Playground: React.FC = () => {
    const [output, setOutput] = useState('Sandboxed Agent is ready.\n');
    const [command, setCommand] = useState('');
    const [files, setFiles] = useState<string[]>([]);
    const [cwd, setCwd] = useState('/');
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState('');
    const [workerReady, setWorkerReady] = useState(false);

    const outputEndRef = useRef<HTMLDivElement>(null);
    const initializedRef = useRef(false);

    useEffect(() => {
        if (initializedRef.current) return;

        const handleSandboxLog = (e: any) => {
            const { level, args } = e.detail;
            const text = args.map((a: any) => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
            setOutput(prev => prev + `\n[${level}] ${text}`);

            if (text.includes('Agent Worker Ready')) {
                setWorkerReady(true);
            }
        };

        const handleSandboxMessage = (e: any) => {
            const data = e.detail;
            if (data.type === 'STATE') {
                setCwd(data.cwd);
                setFiles(data.files);
            } else if (data.type === 'FILE_CONTENT') {
                setFileContent(data.content);
            }
        };

        window.addEventListener('sandbox-log' as any, handleSandboxLog);
        window.addEventListener('sandbox-message' as any, handleSandboxMessage);

        initializedRef.current = true;

        return () => {
            window.removeEventListener('sandbox-log' as any, handleSandboxLog);
            window.removeEventListener('sandbox-message' as any, handleSandboxMessage);
            initializedRef.current = false;
        };
    }, []);

    useEffect(() => {
        outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [output]);

    const handleRun = () => {
        if (!command) return;
        const sandbox = document.querySelector('lofi-sandbox') as any;
        if (sandbox) {
            sandbox.postMessage({ type: 'EXECUTE', code: command });
            setCommand('');
        }
    };

    const handleFileClick = (path: string) => {
        setSelectedFile(path);
        const sandbox = document.querySelector('lofi-sandbox') as any;
        if (sandbox) {
            sandbox.postMessage({ type: 'READ_FILE', path });
        }
    };

    const handleSaveFile = () => {
        if (!selectedFile) return;
        const sandbox = document.querySelector('lofi-sandbox') as any;
        if (sandbox) {
            sandbox.postMessage({ type: 'WRITE_FILE', path: selectedFile, content: fileContent });
        }
    };

    const handleDownload = () => {
        if (!selectedFile) return;
        const blob = new Blob([fileContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = selectedFile.split('/').pop() || 'file';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleClear = () => {
        setOutput('Terminal cleared.\n');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '20px', boxSizing: 'border-box', backgroundColor: '#1e1e1e', color: '#d4d4d4', fontFamily: 'monospace' }}>
            <h1>DeepAgents Browser Sandbox (Worker Mode)</h1>

            <lofi-sandbox
                src-url={workerUrl}
                style={{ display: 'none' }}
            ></lofi-sandbox>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: '20px' }}>
                {/* File Explorer */}
                <div style={{ width: '250px', borderRight: '1px solid #333', overflowY: 'auto', padding: '10px' }}>
                    <h3>Files</h3>
                    {files.filter(f => f !== '/').map(f => (
                        <div
                            key={f}
                            onClick={() => handleFileClick(f)}
                            style={{
                                cursor: 'pointer',
                                padding: '4px',
                                backgroundColor: selectedFile === f ? '#37373d' : 'transparent',
                                borderRadius: '4px'
                            }}
                        >
                            {f.startsWith(cwd) ? f.replace(cwd === '/' ? '/' : cwd + '/', '') : f}
                        </div>
                    ))}
                </div>

                {/* Main Content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {selectedFile ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                <span>Editing: {selectedFile}</span>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <button onClick={handleDownload}>Download</button>
                                    <button onClick={handleSaveFile}>Save</button>
                                </div>
                            </div>
                            <textarea
                                value={fileContent}
                                onChange={(e) => setFileContent(e.target.value)}
                                style={{ flex: 1, backgroundColor: '#252526', color: '#d4d4d4', border: '1px solid #333', padding: '10px', fontFamily: 'monospace' }}
                            />
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#000', padding: '10px', borderRadius: '4px', whiteSpace: 'pre-wrap', position: 'relative' }}>
                                <button
                                    onClick={handleClear}
                                    style={{ position: 'absolute', top: '10px', right: '10px', opacity: 0.5 }}
                                >
                                    Clear
                                </button>
                                {output}
                                <div ref={outputEndRef} />
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <span style={{ alignSelf: 'center' }}>{cwd} $</span>
                        <input
                            type="text"
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRun()}
                            style={{ flex: 1, backgroundColor: '#3c3c3c', color: '#fff', border: 'none', padding: '8px' }}
                            placeholder="Type command and press Enter (e.g., ls, help, git init)"
                            disabled={!workerReady}
                        />
                        <button onClick={handleRun} disabled={!workerReady}>Run</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
