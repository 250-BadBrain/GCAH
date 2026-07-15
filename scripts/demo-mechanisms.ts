import { demoScenarios } from "./demo-scenarios.js";

const output = {
  demo: "gcah-mechanisms",
  generatedAt: "2026-07-14T00:00:00.000Z",
  network: "disabled",
  realCredentials: "not-used",
  scenarios: demoScenarios.map((scenario, index) => ({
    order: index + 1,
    marker: scenario.marker,
    summary: scenario.summary
  }))
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
