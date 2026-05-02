'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { FireState, Visitor, getHealth, isAlive, getAgeString, formatRelativeTime } from '@/lib/fire-state';
import { FireAudio } from '@/lib/audio';
import { getFlagEmoji } from '@/lib/visitors';

const Stars = dynamic(() => import('@/components/Stars'), { ssr: false });
const FireCanvas = dynamic(() => import('@/components/Fire'), { ssr: false });

const POLL_INTERVAL = 30_000;
const RATE_LIMIT_SECS = 60;

interface ApiResponse {
  fire: FireState;
  visitors: Visitor[];
  addedBy?: string;
}

// Animates a number from its previous value to a new target
function useCountUp(target: number) {
  const [displayed, setDisplayed] = useState(0);
  const prevRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (target === prevRef.current) return;
    const from = prevRef.current;
    const duration = from === 0 ? 1800 : 500;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(from + (target - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = target;
        setDisplayed(target);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);

  return displayed;
}

export default function Page() {
  const [fire, setFire] = useState<FireState | null>(null);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [feeding, setFeeding] = useState(false);
  const [animTick, setAnimTick] = useState(0);
  const [muted, setMuted] = useState(true);
  const [addedBy, setAddedBy] = useState<string | null>(null);
  const [cooldownSec, setCooldownSec] = useState(0);

  const audioRef = useRef<FireAudio | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const health = fire ? getHealth(fire) : 1;
  const alive = fire ? isAlive(fire) : true;
  const canFeed = !feeding && cooldownSec === 0 && (fire === null || fire.logs < 5);
  const atMaxLogs = fire !== null && fire.logs >= 5;

  const totalLogsAnimated = useCountUp(fire?.totalLogs ?? 0);

  const startCooldown = useCallback(() => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setCooldownSec(RATE_LIMIT_SECS);
    const end = Date.now() + RATE_LIMIT_SECS * 1000;
    cooldownRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setCooldownSec(remaining);
      if (remaining === 0 && cooldownRef.current) clearInterval(cooldownRef.current);
    }, 1000);
  }, []);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/fire');
      if (!res.ok) return;
      const data: ApiResponse = await res.json();
      setFire(data.fire);
      setVisitors(data.visitors);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
    pollRef.current = setInterval(fetchState, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [fetchState]);

  useEffect(() => {
    audioRef.current = new FireAudio();
    audioRef.current.init();
    return () => audioRef.current?.destroy();
  }, []);

  useEffect(() => {
    audioRef.current?.setHealth(health);
  }, [health]);

  const handleFeed = async () => {
    if (!canFeed) return;
    setFeeding(true);
    setAnimTick(t => t + 1);
    if (navigator.vibrate) navigator.vibrate(20);
    try {
      const res = await fetch('/api/fire/feed', { method: 'POST' });
      if (res.status === 429) { startCooldown(); return; }
      if (!res.ok) return;
      const data: ApiResponse = await res.json();
      setFire(data.fire);
      setVisitors(data.visitors);
      startCooldown();
      if (data.addedBy) {
        setAddedBy(data.addedBy);
        setTimeout(() => setAddedBy(null), 4000);
      }
    } finally {
      setFeeding(false);
    }
  };

  const toggleSound = () => {
    if (!audioRef.current) return;
    if (muted) { audioRef.current.unmute(); setMuted(false); }
    else { audioRef.current.mute(); setMuted(true); }
  };

  return (
    <main style={{
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overflow: 'hidden',
      position: 'relative',
      zIndex: 1,
    }}>
      <Stars health={health} />

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: 400,
        height: '100%',
        padding: '0 24px',
      }}>

        {/* ── ZONE 1: fire scene ── */}
        <div style={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 14,
        }}>

          {/* Title + tagline */}
          <div style={{
            textAlign: 'center',
            animation: 'fadeUp 0.9s ease both',
          }}>
            <h1 style={{
              fontFamily: 'var(--font-fraunces)',
              fontStyle: 'italic',
              fontWeight: 300,
              fontSize: 'clamp(28px, 8vw, 40px)',
              color: '#E8E4DE',
              letterSpacing: '-0.5px',
              lineHeight: 1.1,
              margin: 0,
              textShadow: '0 0 60px rgba(232,166,74,0.22), 0 0 120px rgba(200,100,30,0.1)',
            }}>
              don&rsquo;t let it die
            </h1>
            <p style={{
              fontFamily: 'var(--font-outfit)',
              fontWeight: 300,
              fontSize: 14,
              color: '#7A736C',
              marginTop: 7,
              letterSpacing: '0.2px',
              lineHeight: 1.4,
            }}>
              one fire for the internet.{' '}
              <span style={{ color: '#B89A6A' }}>keep it alive.</span>
            </p>
          </div>

          {/* Canvas */}
          <div style={{
            animation: 'fadeUp 0.9s ease both',
            animationDelay: '0.15s',
            marginTop: 0,
            overflow: 'hidden',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
          }}>
            {!loading
              ? <FireCanvas health={health} logs={fire?.logs ?? 3} alive={alive} animTick={animTick} />
              : <div style={{ width: 360, height: 300 }} />
            }
          </div>

          {/* Age + stats */}
          <div style={{
            textAlign: 'center',
            marginTop: -12,
            animation: 'fadeUp 0.9s ease both',
            animationDelay: '0.3s',
          }}>
            {fire ? (
              <>
                <p style={{
                  fontFamily: 'var(--font-fraunces)',
                  fontStyle: 'italic',
                  fontWeight: 300,
                  fontSize: 20,
                  color: alive ? '#E8A64A' : '#5A5751',
                  transition: 'color 2s ease',
                  lineHeight: 1.2,
                  margin: 0,
                }}>
                  {alive ? `alive for ${getAgeString(fire.born)}` : 'the fire has gone out'}
                </p>
                <p style={{
                  fontFamily: 'var(--font-outfit)',
                  fontWeight: 300,
                  fontSize: 11,
                  color: '#3E3D3A',
                  marginTop: 4,
                  letterSpacing: '0.3px',
                }}>
                  {fire.logs} log{fire.logs !== 1 ? 's' : ''} burning
                  {' · '}
                  <span style={{ color: '#5A5751', fontVariantNumeric: 'tabular-nums' }}>
                    {totalLogsAnimated.toLocaleString()} added total
                  </span>
                  {fire.deaths > 0 && <span style={{ color: '#3E3D3A' }}>{' · '}died {fire.deaths}×</span>}
                </p>
              </>
            ) : (
              <div style={{ height: 44 }} />
            )}
          </div>

          {/* Button + cooldown */}
          <div style={{
            width: '100%',
            marginTop: 14,
            animation: 'fadeUp 0.9s ease both',
            animationDelay: '0.45s',
          }}>
            <button
              onClick={handleFeed}
              disabled={!canFeed}
              style={{
                width: '100%',
                padding: '13px 32px',
                borderRadius: 32,
                border: `0.5px solid ${canFeed ? '#3A2F1E' : '#1E1D1B'}`,
                background: canFeed ? 'linear-gradient(180deg,#1C160D,#141008)' : '#0F0E0C',
                color: canFeed ? '#E8A64A' : '#3E3D3A',
                fontFamily: 'var(--font-outfit)',
                fontWeight: 300,
                fontSize: 14,
                letterSpacing: '2px',
                textTransform: 'lowercase',
                cursor: canFeed ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s ease',
                transform: feeding ? 'scale(0.97)' : 'scale(1)',
                outline: 'none',
              }}
            >
              {feeding ? 'adding wood...' : atMaxLogs ? 'the fire is well fed' : alive ? 'add wood' : 'relight the fire'}
            </button>

            <div style={{ marginTop: 7, textAlign: 'center', minHeight: 16 }}>
              {cooldownSec > 0 && (
                <p style={{
                  fontFamily: 'var(--font-outfit)',
                  fontWeight: 300,
                  fontSize: 11,
                  color: '#5A5751',
                  letterSpacing: '0.3px',
                  margin: 0,
                  animation: 'fadeUp 0.3s ease both',
                }}>
                  next log in{' '}
                  <span style={{ color: '#B89A6A', fontVariantNumeric: 'tabular-nums' }}>{cooldownSec}s</span>
                </p>
              )}
              {addedBy && cooldownSec > 50 && (
                <p style={{
                  fontFamily: 'var(--font-outfit)',
                  fontWeight: 300,
                  fontSize: 11,
                  color: '#B89A6A',
                  letterSpacing: '0.3px',
                  margin: 0,
                }}>
                  {addedBy} added a log
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── ZONE 2: activity feed ── */}
        <div style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          marginTop: 16,
          animation: 'fadeUp 0.9s ease both',
          animationDelay: '0.55s',
        }}>

          {/* Feed header */}
          <div style={{
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: 10,
            borderBottom: '0.5px solid #1A1918',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                display: 'inline-block',
                width: 5, height: 5,
                borderRadius: '50%',
                background: '#E8A64A',
                animation: 'pulse 2.5s ease infinite',
                flexShrink: 0,
              }} />
              <span style={{
                fontFamily: 'var(--font-outfit)',
                fontSize: 10,
                fontWeight: 400,
                letterSpacing: '3px',
                textTransform: 'uppercase',
                color: '#3E3D3A',
              }}>
                live activity
              </span>
            </div>
            {fire && (
              <span style={{
                fontFamily: 'var(--font-outfit)',
                fontSize: 11,
                fontWeight: 300,
                color: '#3E3D3A',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {totalLogsAnimated.toLocaleString()} logs total
              </span>
            )}
          </div>

          {/* Scrollable rows */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            <div className="feed-scroll" style={{ height: '100%', overflowY: 'auto', paddingBottom: 8 }}>
              {visitors.length === 0 && !loading && (
                <p style={{
                  fontFamily: 'var(--font-outfit)',
                  fontWeight: 300,
                  fontSize: 12,
                  color: '#2E2D2A',
                  padding: '16px 0',
                  textAlign: 'center',
                }}>
                  no one has tended this fire yet
                </p>
              )}
              {visitors.map((v, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 0',
                  borderBottom: '0.5px solid #1A1918',
                  gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>
                      {v.country ? getFlagEmoji(v.country) : '🌍'}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-outfit)',
                      fontWeight: 300,
                      fontSize: 13,
                      color: i === 0 ? '#B89A6A' : '#5A5751',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {v.name}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-outfit)',
                      fontWeight: 300,
                      fontSize: 11,
                      color: '#2E2D2A',
                      flexShrink: 0,
                    }}>
                      added a log
                    </span>
                  </div>
                  <span style={{
                    fontFamily: 'var(--font-outfit)',
                    fontWeight: 300,
                    fontSize: 11,
                    color: '#3E3D3A',
                    flexShrink: 0,
                  }}>
                    {formatRelativeTime(v.time)}
                  </span>
                </div>
              ))}
            </div>

            {/* Bottom fade */}
            <div style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              height: 36,
              background: 'linear-gradient(to top, #0E0E0D, transparent)',
              pointerEvents: 'none',
            }} />
          </div>

          {/* Sound toggle — pinned bottom */}
          <div style={{
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'center',
            paddingTop: 10,
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          }}>
            <button
              onClick={toggleSound}
              style={{
                background: 'none',
                border: '0.5px solid #2A2927',
                borderRadius: 20,
                cursor: 'pointer',
                fontFamily: 'var(--font-outfit)',
                fontWeight: 300,
                fontSize: 11,
                letterSpacing: '1.5px',
                textTransform: 'lowercase',
                color: muted ? '#5A5751' : '#B89A6A',
                padding: '6px 18px',
                outline: 'none',
                transition: 'color 0.3s ease, border-color 0.3s ease',
                borderColor: muted ? '#2A2927' : '#3A2F1E',
              }}
            >
              {muted ? '○ sound off' : '● sound on'}
            </button>
          </div>

        </div>
      </div>
    </main>
  );
}
