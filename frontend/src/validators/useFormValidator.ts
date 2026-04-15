import { useState, useCallback } from 'react';
import { ZodSchema, ZodError } from 'zod';

export type FieldErrors = Record<string, string>;

export function useFormValidator<T>() {
  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = useCallback((schema: ZodSchema<T>, data: unknown): data is T => {
    const result = schema.safeParse(data);
    if (!result.success) {
      const zerr = result.error as ZodError;
      const fieldErrors: FieldErrors = {};
      for (const issue of zerr.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) {
          fieldErrors[path] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const getError = useCallback((field: string): string | undefined => {
    return errors[field];
  }, [errors]);

  return { validate, clearErrors, getError, errors };
}
