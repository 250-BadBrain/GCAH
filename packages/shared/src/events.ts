import { z } from "zod";

import { RunEventSchema } from "./entities.js";

export { RunEventSchema };
export type { RunEvent } from "./entities.js";

export const RunEventCursorSchema = z.coerce.number().int().positive();

export type RunEventCursor = z.infer<typeof RunEventCursorSchema>;
