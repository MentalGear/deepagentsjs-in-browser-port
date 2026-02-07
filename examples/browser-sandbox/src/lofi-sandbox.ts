export class LofiSandbox extends HTMLElement {
    private _port: MessagePort | null = null;
    private _worker: Worker | null = null;

    static get observedAttributes() {
        return ['src-url'];
    }

    connectedCallback() {
        this.init();
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if (name === 'src-url' && oldValue !== newValue) {
            this.init();
        }
    }

    private init() {
        if (this._worker) {
            this._worker.terminate();
        }

        const srcUrl = this.getAttribute('src-url');
        if (!srcUrl) return;

        this._worker = new Worker(srcUrl, { type: 'module' });
        const channel = new MessageChannel();
        this._port = channel.port1;

        this._port.onmessage = (e) => {
            if (e.data.type === 'LOG') {
                window.dispatchEvent(new CustomEvent('sandbox-log', { detail: e.data }));
            } else {
                window.dispatchEvent(new CustomEvent('sandbox-message', { detail: e.data }));
            }
        };

        this._worker.postMessage({ type: 'INIT_PORT' }, [channel.port2]);
    }

    postMessage(data: any) {
        if (this._port) {
            this._port.postMessage(data);
        }
    }

    disconnectedCallback() {
        if (this._worker) {
            this._worker.terminate();
        }
    }
}

if (!customElements.get('lofi-sandbox')) {
    customElements.define('lofi-sandbox', LofiSandbox);
}
