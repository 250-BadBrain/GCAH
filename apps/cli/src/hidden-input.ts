export interface HiddenInputIo {
  read(): Promise<string>;
  write(value: string): void;
  setRawMode?(enabled: boolean): void;
}

export function createHiddenInputPrompt(io: HiddenInputIo = defaultHiddenInputIo()): () => Promise<string> {
  return async () => {
    io.write("Credential: ");
    io.setRawMode?.(true);
    try {
      const value = await io.read();
      return value.replace(/\r?\n$/u, "");
    } finally {
      io.setRawMode?.(false);
      io.write("\n");
    }
  };
}

function defaultHiddenInputIo(): HiddenInputIo {
  return {
    async read() {
      return new Promise((resolve) => {
        process.stdin.once("data", (chunk: Buffer) => resolve(chunk.toString("utf8")));
      });
    },
    write(value) {
      process.stderr.write(value);
    },
    setRawMode(enabled) {
      process.stdin.setRawMode?.(enabled);
    }
  };
}
