export function validateLength(value: string | undefined, field: string, max: number = 1000): string | null {
  if (!value?.trim()) return `${field} is required`;
  if (value.length > max) return `${field} must be under ${max} characters`;
  return null;
}
