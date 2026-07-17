#!/usr/bin/env node
process.on("warning", (warning) => {
  if (warning.name === "ExperimentalWarning" && warning.message.includes("SQLite")) return;
  process.stderr.write(`${warning.name}: ${warning.message}\n`);
});

const { runMain } = await import("./main.js");
const result = await runMain(process.argv.slice(2));
if (result.stdout.length > 0) process.stdout.write(result.stdout);
if (result.stderr.length > 0) process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
