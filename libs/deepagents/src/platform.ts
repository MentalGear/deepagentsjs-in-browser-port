/**
 * Platform-specific utilities for isomorphic execution.
 */

import * as nodeFs from "node:fs";
import * as nodeFsPromises from "node:fs/promises";
import * as nodeOs from "node:os";
import * as nodeChildProcess from "node:child_process";

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
 * Synchronous access to Node.js modules.
 * These are swapped out in the browser via package.json browser field.
 */
export function getFsSync(): typeof nodeFs | null {
  return isNode ? nodeFs : null;
}

export function getOsSync(): typeof nodeOs | null {
  return isNode ? nodeOs : null;
}

/**
 * Safely require a Node.js module without breaking browser bundlers.
 */
export function safeRequire(moduleName: string): any {
  if (isNode) {
    if (moduleName === "node:fs" || moduleName === "fs") return nodeFs;
    if (moduleName === "node:fs/promises" || moduleName === "fs/promises")
      return nodeFsPromises;
    if (moduleName === "node:os" || moduleName === "os") return nodeOs;
    if (moduleName === "node:child_process" || moduleName === "child_process")
      return nodeChildProcess;
  }
  return null;
}
