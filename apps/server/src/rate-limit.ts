export class PublicDemoRateLimit {
  private readonly counts = new Map<string, number>();

  constructor(private readonly maxRequests: number) {}

  allow(key: string): boolean {
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next <= this.maxRequests;
  }
}
