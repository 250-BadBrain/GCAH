import type { EventEmitter } from "node:events";

export interface HiddenInputIo {
  read(): Promise<string>;
  write(value: string): void;
  setRawMode?(enabled: boolean): void;
  isRawMode?(): boolean;
}

export function createHiddenInputPrompt(io: HiddenInputIo = defaultHiddenInputIo()): () => Promise<string> {
  return async () => {
    io.write("Credential: ");
    const previousRawMode = io.isRawMode?.() ?? false;
    io.setRawMode?.(true);
    try {
      const value = await io.read();
      return value.replace(/\r?\n$/u, "");
    } finally {
      io.setRawMode?.(previousRawMode);
      io.write("\n");
    }
  };
}

function defaultHiddenInputIo(): HiddenInputIo {
  return {
    read: createRawModeLineReader(process.stdin),
    write(value) {
      process.stderr.write(value);
    },
    setRawMode(enabled) {
      process.stdin.setRawMode?.(enabled);
    },
    isRawMode() {
      return process.stdin.isRaw;
    }
  };
}

export function createRawModeLineReader(input: EventEmitter): () => Promise<string> {
  return async () => new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk: Buffer): void => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\u0003") {
          cleanup();
          reject(new Error("input cancelled"));
          return;
        }
        if (char === "\r" || char === "\n") {
          cleanup();
          resolve(value);
          return;
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };
    const cleanup = (): void => {
      input.off("data", onData);
      if ("pause" in input && typeof input.pause === "function") input.pause();
    };
    if ("resume" in input && typeof input.resume === "function") input.resume();
    input.on("data", onData);
  });
}
