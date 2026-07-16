import { copyFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const assets = [
  [
    "packages/persistence/src/sqlite/migrations/001-initial.sql",
    "packages/persistence/dist/src/sqlite/migrations/001-initial.sql"
  ]
];

for (const [source, target] of assets) {
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}
