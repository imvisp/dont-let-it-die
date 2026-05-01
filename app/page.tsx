'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { FireState, Visitor, getHealth, isAlive, getAgeString, formatRelativeTime } from '@/lib/fire-state';
import { FireAudio } from '@/lib/audio';

const Stars = dynamic(() => import('@/components/Stars'), { ssr: false });
const FireCanvas = dynamic(() => import('@/components/Fire'), { ssr: false });

const POLL_INTERVAL = 30_000;

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
  const [rateLimited, setRateLimited] = useState(false);
  const [animTick, setAnimTick] = useState(0);
  const [muted, setMuted] = useState(true);
  const [addedBy, setAddedBy] = useState<string | null>(null);

  const audioRef = useRef<FireAudio | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const health = fire ? getHealth(fire) : 1;
  const alive = fire ? isAlive(fire) : true;

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
    if (feeding || rateLimited) return;
    setFeeding(true);
    setAnimTick(t => t + 1);

    if (navigator.vibrate) navigator.vibrate(20);

    try {
      const res = await fetch('/api/fire/feed', { method: 'POST' });
      if (res.status === 429) {
        setRateLimited(true);
        setTimeout(() => setRateLimited(false), 60_000);
        return;
      }
      if (!res.ok) return;
      const data: ApiResponse = await res.json();
      setFire(data.fire);
      setVisitors(data.visitors);
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
    if (muted) {
      audioRef.current.unmute();
      setMuted(false);
    } else {
      audioRef.current.mute();
      setMuted(true);
    }
  };

  const canFeed = !feeding && !rateLimited && fire && fire.logs < 5;

  return (
    <main style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 24px 40px',
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
        gap: 0,
      }}>

        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: 8,
          animation: 'fadeUp 0.8s ease both',
          animationDelay: '0s',
        }}>
          <p style={{
            fontFamily: 'var(--font-outfit)',
            fontSize: 11,
            fontWeight: 400,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: '#5A5751',
          }}>
            {alive ? 'still burning' : 'the fire has died'}
          </p>
        </div>

        {/* Fire canvas */}
        <div style={{
          animation: 'fadeUp 0.8s ease both',
          animationDelay: '0.15s',
          display: 'flex',
          justifyContent: 'center',
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

        {/* Age stat */}
        {fire && (
          <div style={{
            textAlign: 'center',
            marginTop: -8,
            animation: 'fadeUp 0.8s ease both',
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
            }}>
              {alive
                ? `alive for ${getAgeString(fire.born)}`
                : 'the fire has gone out'}
            </p>
            <p style={{
              fontFamily: 'var(--font-outfit)',
              fontWeight: 300,
              fontSize: 12,
              color: '#5A5751',
              marginTop: 4,
              letterSpacing: '0.5px',
            }}>
              {fire.totalLogs.toLocaleString()} log{fire.totalLogs !== 1 ? 's' : ''} added
              {fire.deaths > 0 && ` · died ${fire.deaths} time${fire.deaths !== 1 ? 's' : ''}`}
            </p>
          </div>
        )}

        {/* Add wood button */}
        <div style={{
          marginTop: 28,
          animation: 'fadeUp 0.8s ease both',
          animationDelay: '0.45s',
          width: '100%',
        }}>
          <button
            onClick={handleFeed}
            disabled={!canFeed}
            style={{
              width: '100%',
              padding: '16px 32px',
              borderRadius: 32,
              border: `0.5px solid ${alive && canFeed ? '#3A2F1E' : '#1E1D1B'}`,
              background: alive && canFeed
                ? 'linear-gradient(180deg, #1A150D 0%, #141008 100%)'
                : '#0F0E0C',
              color: alive && canFeed ? '#E8A64A' : '#3E3D3A',
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
            {rateLimited
              ? 'you already tended this fire'
              : fire && fire.logs >= 5
              ? 'the fire is well fed'
              : feeding
              ? 'adding wood...'
              : alive
              ? 'add wood'
              : 'relight the fire'}
          </button>
        </div>

        {/* Added by toast */}
        {addedBy && (
          <p style={{
            marginTop: 12,
            fontFamily: 'var(--font-outfit)',
            fontWeight: 300,
            fontSize: 12,
            color: '#B89A6A',
            textAlign: 'center',
            animation: 'fadeUp 0.4s ease both',
            letterSpacing: '0.5px',
          }}>
            {addedBy} added a log
          </p>
        )}

        {/* Recent keepers */}
        {visitors.length > 0 && (
          <div style={{
            marginTop: 32,
            width: '100%',
            animation: 'fadeUp 0.8s ease both',
            animationDelay: '0.55s',
          }}>
            <p style={{
              fontFamily: 'var(--font-outfit)',
              fontSize: 10,
              fontWeight: 400,
              letterSpacing: '3px',
              textTransform: 'uppercase',
              color: '#3E3D3A',
              marginBottom: 12,
            }}>
              recent keepers
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visitors.map((v, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-outfit)',
                    fontWeight: 300,
                    fontSize: 13,
                    color: '#5A5751',
                  }}>
                    {v.name}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-outfit)',
                    fontWeight: 300,
                    fontSize: 11,
                    color: '#3E3D3A',
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
            marginTop: 40,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-outfit)',
            fontWeight: 300,
            fontSize: 11,
            letterSpacing: '2px',
            textTransform: 'lowercase',
            color: '#3E3D3A',
            padding: '8px 0',
            animation: 'fadeUp 0.8s ease both',
            animationDelay: '0.65s',
            outline: 'none',
          }}
        >
          {muted ? 'sound off' : 'sound on'}
        </button>
      </div>
    </main>
  );
}
