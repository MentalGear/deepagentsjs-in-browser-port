/**
 * Platform-specific utilities for isomorphic execution.
 */

// Helper to check if we're in Node.js
export const isNode =
  typeof process !== "undefined" &&
  process.versions != null &&
  process.versions.node != null;

/**
 * Lazy-load Node.js modules only when running in Node.
 */
export async function getFs() {
  if (isNode) {
    return import("node:fs");
  }
  return null;
}

export async function getFsPromises() {
  if (isNode) {
    return import("node:fs/promises");
  }
  return null;
}

export async function getOs() {
  if (isNode) {
    return import("node:os");
  }
  return null;
}

export async function getChildProcess() {
  if (isNode) {
    return import("node:child_process");
  }
  return null;
}

/**
 * Safely require a Node.js module without breaking browser bundlers.
 */
export function safeRequire(moduleName: string): any {
  if (isNode) {
    try {
      // Use standard require for CJS or use a dynamic trick for ESM Node
      // Since this is primarily for Node-only backends, we use a more standard approach.
      // Bundlers will be pointed to platform.web.ts anyway.
      return eval(`require('${moduleName}')`);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Synchronous access to Node.js modules.
 */
export function getFsSync(): any {
  return safeRequire("node:fs");
}

export function getOsSync(): any {
  return safeRequire("node:os");
}
