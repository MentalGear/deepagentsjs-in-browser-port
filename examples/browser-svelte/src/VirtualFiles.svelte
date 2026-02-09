<script lang="ts">
  import { FileSystemAccessBackend } from 'deepagents';
  import { onMount } from 'svelte';

  let backend: FileSystemAccessBackend | null = null;
  let files = $state<any[]>([]);
  let currentPath = $state('/');
  let status = $state('Select a directory to start');

  async function selectDirectory() {
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker();
      backend = new FileSystemAccessBackend(handle);
      status = 'Directory selected';
      await refresh();
    } catch (e: any) {
      status = `Error: ${e.message}`;
    }
  }

  async function refresh() {
    if (!backend) return;
    try {
      files = await backend.lsInfo(currentPath);
    } catch (e: any) {
      status = `Error: ${e.message}`;
    }
  }

  async function navigate(path: string) {
      currentPath = path;
      await refresh();
  }

  async function goUp() {
      if (currentPath === '/') return;
      const parts = currentPath.split('/').filter(Boolean);
      parts.pop();
      currentPath = '/' + parts.join('/');
      if (currentPath !== '/') currentPath += '/';
      await refresh();
  }
</script>

<div class="vfs-container">
  <header>
    <h1>DeepAgents Virtual Files (Native FSA)</h1>
    <p>Using the Browser File System Access API</p>
  </header>

  <main>
    <div class="controls">
      <button onclick={selectDirectory}>Open Local Directory</button>
      <button onclick={refresh} disabled={!backend}>Refresh</button>
      <span>{status}</span>
    </div>

    <div class="browser">
      <div class="path-nav">
          <button onclick={goUp} disabled={currentPath === '/'}>..</button>
          <span>{currentPath}</span>
      </div>
      <div class="file-list">
        {#each files as file}
          <div class="file-item">
            <span class="icon">{file.is_dir ? '📁' : '📄'}</span>
            <span
                class="name"
                onclick={() => file.is_dir && navigate(file.path)}
                style={file.is_dir ? 'cursor: pointer; text-decoration: underline;' : ''}
            >
                {file.path.split('/').filter(Boolean).pop()}
            </span>
            <span class="size">{file.size} bytes</span>
          </div>
        {:else}
          <div class="empty">No files loaded.</div>
        {/each}
      </div>
    </div>
  </main>
</div>

<style>
  .vfs-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #1a1a2e;
    color: #eee;
    font-family: sans-serif;
  }

  header {
    padding: 1rem 2rem;
    background: #16213e;
    border-bottom: 1px solid #0f3460;
  }

  header h1 {
    color: #e94560;
    margin: 0;
  }

  main {
    padding: 2rem;
    flex: 1;
    overflow-y: auto;
  }

  .controls {
    margin-bottom: 2rem;
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  button {
    padding: 0.5rem 1rem;
    cursor: pointer;
    background: #e94560;
    color: white;
    border: none;
    border-radius: 4px;
  }

  button:disabled {
      background: #444;
      cursor: not-allowed;
  }

  .browser {
      background: #0f0f23;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 1rem;
  }

  .path-nav {
      margin-bottom: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #333;
      display: flex;
      gap: 1rem;
      align-items: center;
  }

  .file-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
  }

  .file-item {
      display: flex;
      gap: 1rem;
      padding: 0.5rem;
      border-radius: 4px;
  }

  .file-item:hover {
      background: #16213e;
  }

  .icon { width: 24px; }
  .name { flex: 1; }
  .size { color: #888; }
  .empty { color: #888; text-align: center; padding: 2rem; }
</style>
