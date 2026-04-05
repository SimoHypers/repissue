import { ZodError } from 'zod';

export class RepissueError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RepissueError';
  }
}

export const rethrowValidationErrorIfZodError = (
  err: unknown,
  context: string,
): void => {
  if (err instanceof ZodError) {
    const messages = err.issues
      // e.path is (string | number)[] — String() avoids importing Zod v4's internal $ZodIssue type
      .map((e) => `  ${String(e.path.join('.'))}: ${e.message}`)
      .join('\n');
    throw new RepissueError(`${context}\n${messages}`, { cause: err });
  }
};
