declare module "node:fs/promises" {
  export function readFile(path: string | URL, encoding: "utf8"): Promise<string>;
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
}

declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
}
