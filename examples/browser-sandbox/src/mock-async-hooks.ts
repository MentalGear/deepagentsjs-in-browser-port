export class AsyncLocalStorage {
  disable() {}
  getStore() { return undefined; }
  run(store: any, callback: any, ...args: any[]) { return callback(...args); }
  enterWith(store: any) {}
}
