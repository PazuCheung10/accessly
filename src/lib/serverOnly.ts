/**
 * Asserts that the current code is running on the server.
 * Throws an error if called on the client side.
 *
 * Use this helper to prevent accidental usage of server-only code in client components.
 */
export function assertServer(): void {
  if (typeof window !== 'undefined') {
    throw new Error(
      'This function can only be called on the server. It was called on the client.'
    )
  }
}