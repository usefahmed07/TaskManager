const errorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

export { errorMessage };
