export class FailureWindow {
  private lastFingerprint: string | null = null;
  private count = 0;

  constructor(private readonly limit: number) {}

  record(fingerprint: string): boolean {
    if (fingerprint === this.lastFingerprint) {
      this.count += 1;
    } else {
      this.lastFingerprint = fingerprint;
      this.count = 1;
    }
    return this.count >= this.limit;
  }
}
