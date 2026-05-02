import { NextRequest, NextResponse } from 'next/server';
import { FireState, Visitor, defaultFireState, isAlive, MAX_LOGS } from '@/lib/fire-state';
import { generateVisitorName } from '@/lib/visitors';
import { getKV } from '@/lib/kv';

const FIRE_KEY = 'fire:state';
const VISITORS_KEY = 'fire:visitors';

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

export async function POST(req: NextRequest) {
  const kv = await getKV();
  const ip = getClientIP(req);
  const rateLimitKey = `ratelimit:${ip}`;

  const limited = await kv.get(rateLimitKey);
  if (limited) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  await kv.set(rateLimitKey, 1, { ex: 60 });

  let fire = await kv.get<FireState>(FIRE_KEY);
  const now = Date.now();

  if (!fire) fire = defaultFireState();

  const alive = isAlive(fire);

  if (!alive) {
    const timeAlive = fire.born ? now - fire.born : 0;
    fire = {
      lastFed: now,
      logs: 1,
      totalLogs: fire.totalLogs + 1,
      born: now,
      deaths: (fire.deaths ?? 0) + 1,
      longestAlive: Math.max(fire.longestAlive ?? 0, timeAlive),
    };
  } else if (fire.logs < MAX_LOGS) {
    fire = { ...fire, lastFed: now, logs: fire.logs + 1, totalLogs: fire.totalLogs + 1 };
  } else {
    return NextResponse.json({ error: 'Fire is at max logs' }, { status: 400 });
  }

  const visitorName = generateVisitorName();
  const country = req.headers.get('x-vercel-ip-country') ?? undefined;
  const visitor: Visitor = { name: visitorName, time: now, country };

  await kv.set(FIRE_KEY, fire);
  await kv.lpush(VISITORS_KEY, visitor);
  await kv.ltrim(VISITORS_KEY, 0, 4);

  const visitors = await kv.lrange<Visitor>(VISITORS_KEY, 0, 4);
  return NextResponse.json({ fire, visitors, addedBy: visitorName });
}
