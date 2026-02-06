import { describe, it, expect, vi } from "vitest";
import { FileSystemAccessBackend } from "./file-system-access.js";

describe("FileSystemAccessBackend", () => {
  const mockHandle = {
    kind: 'directory',
    name: 'root',
    getFileHandle: vi.fn(),
    getDirectoryHandle: vi.fn(),
    removeEntry: vi.fn(),
    resolve: vi.fn(),
    values: vi.fn(),
  };

  it("should initialize with a directory handle", () => {
    const backend = new FileSystemAccessBackend(mockHandle as any);
    expect(backend.id).toBe("fs-access");
  });

  // More detailed tests would require complex mocking of the Browser FS API
  // which is better handled by our Playwright E2E tests.
});
