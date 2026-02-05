/**
 * Browser-specific utilities for isomorphic execution.
 */

export const isNode = false;

export async function getFs() {
  return null;
}

export async function getFsPromises() {
  return null;
}

export async function getOs() {
  return null;
}

export async function getChildProcess() {
  return null;
}

export function getFsSync() {
  return null;
}

export function getOsSync() {
  return null;
}

export function safeRequire(_moduleName: string) {
  return null;
}
