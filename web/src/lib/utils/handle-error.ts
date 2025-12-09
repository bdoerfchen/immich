import { isHttpError } from '@immich/sdk';
import { toastManager } from '@immich/ui';

export function getServerErrorMessage(error: unknown) {
  if (!isHttpError(error)) {
    return;
  }

  // errors for endpoints without return types aren't parsed as json
  let data = error.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      // Not a JSON string
    }
  }

  return data?.message || error.message;
}

export function handleError(error: unknown, message?: string) {
  if ((error as Error)?.name === 'AbortError') {
    return;
  }
  const err = error instanceof Error ? error : new Error(String(error));

  const msg = message || err.message;

  console.error(`[handleError]: ${msg}`, error, err?.stack);

  try {
    let serverMessage = getServerErrorMessage(error);
    if (serverMessage) {
      serverMessage = `${String(serverMessage).slice(0, 75)}\n(Immich Server Error)`;
    }

    const errorMessage = serverMessage || msg;

    toastManager.danger(errorMessage);

    return errorMessage;
  } catch (error) {
    console.error(error);
    return message;
  }
}

export async function handleErrorAsync<T>(fn: () => Promise<T>, message?: string): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error: unknown) {
    handleError(error, message);
    return undefined;
  }
}
