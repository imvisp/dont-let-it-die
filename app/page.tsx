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
      if (res.status === 429) {
        startCooldown();
        return;
      }
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

  const atMaxLogs = fire !== null && fire.logs >= 5;

  return (
    <main style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px 48px',
      position: 'relative',
      zIndex: 1,
    }}>
      <Stars health={health} />

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: 400,
      }}>

        {/* Title */}
        <div style={{
          textAlign: 'center',
          marginBottom: 4,
          animation: 'fadeUp 0.9s ease both',
          animationDelay: '0s',
        }}>
          <h1 style={{
            fontFamily: 'var(--font-fraunces)',
            fontStyle: 'italic',
            fontWeight: 300,
            fontSize: 'clamp(32px, 9vw, 42px)',
            color: '#E8E4DE',
            letterSpacing: '-0.5px',
            lineHeight: 1.1,
            margin: 0,
            textShadow: '0 0 60px rgba(232, 166, 74, 0.22), 0 0 120px rgba(200, 100, 30, 0.1)',
          }}>
            don&rsquo;t let it die
          </h1>
          <p style={{
            fontFamily: 'var(--font-outfit)',
            fontWeight: 300,
            fontSize: 12,
            color: '#4A4742',
            marginTop: 8,
            letterSpacing: '0.3px',
          }}>
            one fire for the internet. keep it alive.
          </p>
        </div>

        {/* Fire canvas */}
        <div style={{
          animation: 'fadeUp 0.9s ease both',
          animationDelay: '0.15s',
          display: 'flex',
          justifyContent: 'center',
          marginTop: 4,
        }}>
          {!loading && (
            <FireCanvas
              health={health}
              logs={fire?.logs ?? 3}
              alive={alive}
              animTick={animTick}
            />
          )}
          {loading && <div style={{ width: 360, height: 300 }} />}
        </div>

        {/* Age + stats */}
        {fire && (
          <div style={{
            textAlign: 'center',
            marginTop: -4,
            animation: 'fadeUp 0.9s ease both',
            animationDelay: '0.3s',
          }}>
            <p style={{
              fontFamily: 'var(--font-fraunces)',
              fontStyle: 'italic',
              fontWeight: 300,
              fontSize: 22,
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
              fontSize: 12,
              color: '#3E3D3A',
              marginTop: 5,
              letterSpacing: '0.3px',
            }}>
              {fire.logs} log{fire.logs !== 1 ? 's' : ''} burning
              {' · '}
              <span style={{ color: '#5A5751' }}>
                {fire.totalLogs.toLocaleString()} added total
              </span>
              {fire.deaths > 0 && (
                <span style={{ color: '#3E3D3A' }}>
                  {' · '}died {fire.deaths}×
                </span>
              )}
            </p>
          </div>
        )}

        {/* Add wood button */}
        <div style={{
          marginTop: 24,
          animation: 'fadeUp 0.9s ease both',
          animationDelay: '0.45s',
          width: '100%',
        }}>
          <button
            onClick={handleFeed}
            disabled={!canFeed}
            style={{
              width: '100%',
              padding: '15px 32px',
              borderRadius: 32,
              border: `0.5px solid ${canFeed ? '#3A2F1E' : '#1E1D1B'}`,
              background: canFeed
                ? 'linear-gradient(180deg, #1C160D 0%, #141008 100%)'
                : '#0F0E0C',
              color: canFeed ? '#E8A64A' : '#3E3D3A',
              fontFamily: 'var(--font-outfit)',
              fontWeight: 300,
              fontSize: 15,
              letterSpacing: '2px',
              textTransform: 'lowercase',
              cursor: canFeed ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s ease',
              transform: feeding ? 'scale(0.97)' : 'scale(1)',
              outline: 'none',
            }}
          >
            {feeding
              ? 'adding wood...'
              : atMaxLogs
              ? 'the fire is well fed'
              : alive
              ? 'add wood'
              : 'relight the fire'}
          </button>

          {/* Cooldown indicator */}
          <div style={{
            marginTop: 10,
            textAlign: 'center',
            minHeight: 18,
          }}>
            {cooldownSec > 0 && (
              <p style={{
                fontFamily: 'var(--font-outfit)',
                fontWeight: 300,
                fontSize: 12,
                color: '#5A5751',
                letterSpacing: '0.5px',
                animation: 'fadeUp 0.3s ease both',
              }}>
                next log in{' '}
                <span style={{ color: '#B89A6A', fontVariantNumeric: 'tabular-nums' }}>
                  {cooldownSec}s
                </span>
              </p>
            )}
            {addedBy && cooldownSec === 0 && (
              <p style={{
                fontFamily: 'var(--font-outfit)',
                fontWeight: 300,
                fontSize: 12,
                color: '#B89A6A',
                letterSpacing: '0.3px',
                animation: 'fadeUp 0.3s ease both',
              }}>
                {addedBy} added a log
              </p>
            )}
          </div>
        </div>

        {/* Activity feed */}
        {visitors.length > 0 && (
          <div style={{
            marginTop: 28,
            width: '100%',
            animation: 'fadeUp 0.9s ease both',
            animationDelay: '0.55s',
          }}>
            {/* Feed header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  display: 'inline-block',
                  width: 5,
                  height: 5,
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
                  recent keepers
                </span>
              </div>
              {fire && (
                <span style={{
                  fontFamily: 'var(--font-outfit)',
                  fontSize: 11,
                  fontWeight: 300,
                  color: '#3E3D3A',
                  letterSpacing: '0.3px',
                }}>
                  {fire.totalLogs.toLocaleString()} total
                </span>
              )}
            </div>

            {/* Feed rows */}
            <div style={{
              borderTop: '0.5px solid #1A1918',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {visitors.map((v, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '0.5px solid #1A1918',
                  gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>
                      {v.country ? getFlagEmoji(v.country) : '🌍'}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-outfit)',
                      fontWeight: 300,
                      fontSize: 13,
                      color: i === 0 ? '#B89A6A' : '#5A5751',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
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
                    letterSpacing: '0.3px',
                  }}>
                    {formatRelativeTime(v.time)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sound toggle */}
        <button
          onClick={toggleSound}
          style={{
            marginTop: 36,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-outfit)',
            fontWeight: 300,
            fontSize: 11,
            letterSpacing: '2px',
            textTransform: 'lowercase',
            color: '#2E2D2A',
            padding: '8px 0',
            animation: 'fadeUp 0.9s ease both',
            animationDelay: '0.65s',
            outline: 'none',
            transition: 'color 0.3s ease',
          }}
        >
          {muted ? 'sound off' : 'sound on ·'}
        </button>

      </div>
    </main>
  );
}
