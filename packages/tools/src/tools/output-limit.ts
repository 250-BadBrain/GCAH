export interface BoundedOutput {
  text: string;
  truncated: boolean;
}

export function boundOutput(text: string, limitBytes: number): BoundedOutput {
  if (Buffer.byteLength(text, "utf8") <= limitBytes) {
    return { text, truncated: false };
  }
  const bounded = Buffer.from(text, "utf8").subarray(0, limitBytes).toString("utf8");
  return { text: `${bounded}\n[truncated]`, truncated: true };
}
