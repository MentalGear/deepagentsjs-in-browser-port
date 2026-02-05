export const promises = {};
export const constants = {};
export function existsSync() { return false; }
export function mkdirSync() {}
export function readFileSync() { return ""; }
export function statSync() { return {}; }
export function readdirSync() { return []; }
export function realpathSync(p) { return p; }
export default { promises, constants, existsSync, mkdirSync, readFileSync, statSync, readdirSync, realpathSync };
