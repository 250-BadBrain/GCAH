export type WorkspaceFenceResult =
  | { ok: true; absolutePath?: string }
  | { ok: false; code: string; message: string };

export interface WorkspaceFencePort {
  validateWorkspace(): Promise<WorkspaceFenceResult>;
  resolveExistingTarget(relativePath: string): Promise<WorkspaceFenceResult>;
  resolveNewTarget(relativePath: string): Promise<WorkspaceFenceResult>;
}
