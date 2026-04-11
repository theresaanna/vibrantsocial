import type { ActionState } from "../types";

// ── Configuration ────────────────────────────────────────────────────

export interface ApiClientConfig {
  baseUrl: string;
  getAuthHeaders: () => Promise<Record<string, string>>;
}

// ── Upload types ─────────────────────────────────────────────────────

export interface UploadResult {
  url: string;
  pathname: string;
}

export interface UploadFile {
  uri: string;
  name: string;
  type: string;
}

// ── API Client ───────────────────────────────────────────────────────

export class VibrantApiClient {
  constructor(private config: ApiClientConfig) {}

  /**
   * Call a server action via the RPC endpoint.
   */
  async rpc<T>(action: string, ...args: unknown[]): Promise<T> {
    const headers = await this.config.getAuthHeaders();
    const res = await fetch(`${this.config.baseUrl}/api/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ action, args }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ApiError(`rpc(${action}) failed: ${res.status}`, res.status, text);
    }
    return res.json() as Promise<T>;
  }

  /**
   * Upload a file (image, video, audio, document).
   * On web: pass a File object. On mobile: pass { uri, name, type }.
   */
  async upload(file: File | UploadFile): Promise<UploadResult> {
    const headers = await this.config.getAuthHeaders();
    const formData = new FormData();

    if (file instanceof File) {
      formData.append("file", file);
    } else {
      // React Native FormData supports { uri, type, name }
      formData.append("file", file as unknown as Blob);
    }

    const res = await fetch(`${this.config.baseUrl}/api/upload`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ApiError(`Upload failed: ${res.status}`, res.status, text);
    }
    return res.json() as Promise<UploadResult>;
  }

  /**
   * Generic GET request to an API route.
   */
  async get<T>(path: string): Promise<T> {
    const headers = await this.config.getAuthHeaders();
    const res = await fetch(`${this.config.baseUrl}${path}`, {
      headers: { "Content-Type": "application/json", ...headers },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ApiError(`GET ${path} failed: ${res.status}`, res.status, text);
    }
    return res.json() as Promise<T>;
  }

  /**
   * Generic POST request to an API route.
   */
  async post<T>(path: string, body?: unknown): Promise<T> {
    const headers = await this.config.getAuthHeaders();
    const res = await fetch(`${this.config.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ApiError(`POST ${path} failed: ${res.status}`, res.status, text);
    }
    return res.json() as Promise<T>;
  }
}

// ── Error class ──────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Helper to check ActionState responses ────────────────────────────

export function isActionError(result: ActionState): boolean {
  return !result.success;
}
