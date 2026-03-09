import type { RequestOptions } from "./types";

export class SpicaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "SpicaApiError";
  }
}

export class SpicaClient {
  private readonly baseUrl: string;
  private readonly apikey: string;

  constructor(baseUrl: string, apikey: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apikey = apikey;
  }

  private _headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Authorization: `APIKEY ${this.apikey}`,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  private _qs(params: Record<string, unknown>): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        for (const item of v) sp.append(k, String(item));
      } else {
        sp.append(k, String(v));
      }
    }
    const s = sp.toString();
    return s ? `?${s}` : "";
  }

  async _request(
    method: string,
    path: string,
    { query, body, headers: extra }: RequestOptions = {},
  ): Promise<unknown> {
    const url = `${this.baseUrl}${path}${query ? this._qs(query) : ""}`;
    const opts: RequestInit = { method, headers: this._headers(extra) };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);

    if (res.status === 204) return null;

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!res.ok) {
      const d = data as Record<string, unknown> | null;
      const msg =
        typeof d === "object" && d !== null && typeof d["message"] === "string"
          ? d["message"]
          : typeof d === "object" &&
              d !== null &&
              typeof d["error"] === "string"
            ? d["error"]
            : typeof d === "object" && d !== null
              ? JSON.stringify(d)
              : String(data);
      throw new SpicaApiError(
        `Spica API ${res.status}: ${msg}`,
        res.status,
        data,
      );
    }

    return data;
  }

  get(
    path: string,
    query?: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<unknown> {
    return this._request("GET", path, { query, headers });
  }

  post(path: string, body?: unknown): Promise<unknown> {
    return this._request("POST", path, { body });
  }

  put(path: string, body?: unknown): Promise<unknown> {
    return this._request("PUT", path, { body });
  }

  patch(path: string, body?: unknown): Promise<unknown> {
    return this._request("PATCH", path, { body });
  }

  delete(
    path: string,
    { query, body }: { query?: Record<string, unknown>; body?: unknown } = {},
  ): Promise<unknown> {
    return this._request("DELETE", path, { query, body });
  }
}
