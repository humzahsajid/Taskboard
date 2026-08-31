import axios from "axios";

/**
 * Single axios instance for the whole app.
 * `withCredentials` sends the httpOnly auth cookie with every request.
 * All calls are relative to /api, which nginx (prod) or the Vite dev proxy
 * forwards to the backend.
 */
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

export interface ApiErrorShape {
  message: string;
  details?: { field: string; message: string }[];
}

export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: ApiErrorShape } | undefined;
    if (data?.error?.details?.length) {
      return data.error.details.map((d) => d.message).join(", ");
    }
    if (data?.error?.message) return data.error.message;
    if (err.message) return err.message;
  }
  return "Unexpected error — please try again";
}
