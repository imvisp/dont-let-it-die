import { NextResponse } from 'next/server';
import { FireState, Visitor, defaultFireState } from '@/lib/fire-state';
import { getKV } from '@/lib/kv';

const FIRE_KEY = 'fire:state';
const VISITORS_KEY = 'fire:visitors';

export async function GET() {
  try {
    const kv = await getKV();
    let fire = await kv.get<FireState>(FIRE_KEY);
    if (!fire) {
      fire = defaultFireState();
      await kv.set(FIRE_KEY, fire);
    }
    const visitors = await kv.lrange<Visitor>(VISITORS_KEY, 0, 4);
    return NextResponse.json({ fire, visitors });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch fire state' }, { status: 500 });
  }
}
