export class ProtocolRetries {
  private count = 0;

  constructor(private readonly limit: number) {}

  record(): boolean {
    this.count += 1;
    return this.count >= this.limit;
  }
}
