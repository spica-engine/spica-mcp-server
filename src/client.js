export class SpicaClient {
  constructor(baseUrl, apikey) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apikey = apikey;
  }

  _headers(extra = {}) {
    return {
      Authorization: `APIKEY ${this.apikey}`,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  _qs(params) {
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

  async _request(method, path, { query, body, headers: extra } = {}) {
    const url = `${this.baseUrl}/api${path}${query ? this._qs(query) : ""}`;
    const opts = { method, headers: this._headers(extra) };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);

    if (res.status === 204) return null;

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!res.ok) {
      const msg =
        typeof data === "object" && data !== null
          ? data.message || data.error || JSON.stringify(data)
          : String(data);
      const err = new Error(`Spica API ${res.status}: ${msg}`);
      err.status = res.status;
      err.body = data;
      throw err;
    }

    return data;
  }

  get(path, query) {
    return this._request("GET", path, { query });
  }
  post(path, body) {
    return this._request("POST", path, { body });
  }
  put(path, body) {
    return this._request("PUT", path, { body });
  }
  patch(path, body) {
    return this._request("PATCH", path, { body });
  }
  delete(path, { query, body } = {}) {
    return this._request("DELETE", path, { query, body });
  }
}
