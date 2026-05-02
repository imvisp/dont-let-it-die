// In production (Vercel): uses real @vercel/kv backed by Upstash Redis
// In local dev without credentials: uses an in-memory Map (resets on server restart)

const memStore = new Map<string, unknown>();
const memLists = new Map<string, unknown[]>();

const devKV = {
  async get<T>(key: string): Promise<T | null> {
    return (memStore.get(key) as T) ?? null;
  },
  async set(key: string, value: unknown, _opts?: { ex?: number }): Promise<void> {
    memStore.set(key, value);
  },
  async lpush(key: string, ...values: unknown[]): Promise<number> {
    const list = memLists.get(key) ?? [];
    list.unshift(...values);
    memLists.set(key, list);
    return list.length;
  },
  async ltrim(key: string, start: number, stop: number): Promise<void> {
    const list = memLists.get(key) ?? [];
    memLists.set(key, list.slice(start, stop + 1));
  },
  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    const list = memLists.get(key) ?? [];
    const end = stop === -1 ? undefined : stop + 1;
    return list.slice(start, end) as T[];
  },
};

type KV = typeof devKV;

let _kv: KV | null = null;

export async function getKV(): Promise<KV> {
  if (_kv) return _kv;
  if (process.env.KV_REST_API_URL) {
    const { kv } = await import('@vercel/kv');
    _kv = kv as unknown as KV;
  } else {
    _kv = devKV;
  }
  return _kv;
}
