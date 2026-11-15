/**
 * A JSON call to the app's own API that never throws: a network failure comes
 * back as status 0, and a body that isn't JSON as `{}`.
 */
export async function send(url: string, body?: unknown, method = 'POST'): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await fetch(
      url,
      body === undefined
        ? { method }
        : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}
