export class RequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function request<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const response = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    ...(body && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = typeof data?.error === 'string' ? data.error : data?.message;
    throw new RequestError(response.status, typeof message === 'string' ? message : 'Request failed. Try again.');
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export function messageFor(error: unknown) {
  return error instanceof RequestError ? error.message : 'Could not connect. Try again.';
}
