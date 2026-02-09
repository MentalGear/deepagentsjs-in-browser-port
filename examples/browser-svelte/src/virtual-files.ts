import { mount } from 'svelte';
import './app.css';
import VirtualFiles from './VirtualFiles.svelte';

const app = mount(VirtualFiles, {
  target: document.getElementById('app')!,
});

export default app;
