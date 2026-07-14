export interface HiddenInputIo {
  read(): Promise<string>;
  write(value: string): void;
}

export function createHiddenInputPrompt(io: HiddenInputIo = defaultHiddenInputIo()): () => Promise<string> {
  return async () => {
    io.write("Credential: ");
    const value = await io.read();
    io.write("\n");
    return value.replace(/\r?\n$/u, "");
  };
}

function defaultHiddenInputIo(): HiddenInputIo {
  return {
    async read() {
      process.stdin.setRawMode?.(false);
      return new Promise((resolve) => {
        process.stdin.once("data", (chunk: Buffer) => resolve(chunk.toString("utf8")));
      });
    },
    write(value) {
      process.stderr.write(value);
    }
  };
}
