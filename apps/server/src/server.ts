import { interruptActiveRuns, type Clock, type UnitOfWork } from "@gcah/core";

export async function interruptActiveRunsOnStartup(input: { unitOfWork: UnitOfWork; clock: Clock }): Promise<void> {
  await interruptActiveRuns(input.unitOfWork.repositories, input.clock);
}
