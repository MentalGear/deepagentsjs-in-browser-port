# JustBashVFS Access Approach

The `JustBashBackend` provides a virtual POSIX-like filesystem in the browser via the `just-bash` library. There are three main ways to interact with this filesystem:

## 1. Programmatic Access via `bash.fs` (Best for Performance)

The `JustBashBackend` instance exposes (or can be passed) a `Bash` instance, which has a `fs` property implementing the `IFileSystem` interface. This is the most direct and performant way to manipulate files.

### Key Methods:
- `readFile(path: string): Promise<string>` - Reads file as a UTF-8 string.
- `readFileBuffer(path: string): Promise<Uint8Array>` - Reads file as binary data.
- `writeFile(path: string, content: string | Uint8Array): Promise<void>` - Writes string or binary content.
- `readdir(path: string): Promise<string[]>` - Lists directory entries.
- `stat(path: string): Promise<FsStat>` - Gets file metadata (size, mtime, etc.).
- `exists(path: string): Promise<boolean>` - Checks if a path exists.
- `rm(path: string, options?: { recursive?: boolean })`: Removes files or directories.

### Example:
```typescript
const backend = new JustBashBackend();
const fs = (backend as any).bash.fs; // Access internal fs

// Write binary data
const data = new Uint8Array([72, 101, 108, 108, 111]);
await fs.writeFile("/hello.bin", data);

// Read back
const readData = await fs.readFileBuffer("/hello.bin");
```

## 2. Higher-level Backend Methods (Best for Agent Logic)

The `JustBashBackend` implements the `SandboxBackendProtocol`, providing unified methods that handle common agent requirements like line numbering and string replacement.

### Key Methods:
- `read(path, offset, limit)`: Reads file with line numbers, useful for LLM context.
- `write(path, content)`: Writes a new file (fails if exists).
- `edit(path, oldString, newString)`: Performs string replacement.
- `uploadFiles(files)`: Bulk upload of `Uint8Array` data.
- `downloadFiles(paths)`: Bulk download as `Uint8Array`.

## 3. Shell Commands (Best for LLM Execution)

Executing commands via `backend.execute(command)` allows the agent to use standard Unix utilities (ls, cat, grep, sed, etc.) which are polyfilled by `just-bash`.

### Example:
```typescript
await backend.execute("echo 'hello' > test.txt");
const result = await backend.execute("cat test.txt");
// result.output === "hello\n"
```

## Binary Data Support

While the internal filesystem of `just-bash` can store `Uint8Array`, some higher-level shell tools might expect strings. When working with `isomorphic-git`, we recommend bridging the FS by converting `Uint8Array` to/from a binary-safe string representation (like Latin-1) if the underlying tool only supports string-based FS calls, or using the `readFileBuffer`/`writeFile(..., uint8)` methods directly for maximum compatibility.
