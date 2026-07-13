export class PathBoundaryError extends Error {
  constructor(message: string, readonly code = "PATH_BOUNDARY_VIOLATION") {
    super(message);
    this.name = "PathBoundaryError";
  }
}
