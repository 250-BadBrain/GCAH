import { createInMemoryRepositories } from "../src/index.js";
import { FakeClock, repositoryContract } from "./repository-contract.js";

repositoryContract({
  name: "in-memory",
  create: async () => createInMemoryRepositories(new FakeClock())
});
