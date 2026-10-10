import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAudio } from '../src/game/audio.js';

// Minimal Web Audio + DOM fakes: every node method is a no-op, and the context's
// resume() can be scripted to fail like iOS does outside a user gesture.
const node = () =>
  new Proxy(
    { frequency: { value: 0, setTargetAtTime() {} }, gain: { value: 0, setTargetAtTime() {} }, Q: { value: 0 } },
    { get: (t, k) => (k in t ? t[k] : k === 'connect' ? () => node() : () => {}) },
  );

class FakeContext {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.sampleRate = 8000;
    this.destination = node();
    this.resumeCalls = 0;
    FakeContext.last = this;
  }
  createGain = node;
  createOscillator = node;
  createBiquadFilter = node;
  createBufferSource = node;
  createBuffer = () => ({ getChannelData: () => new Float32Array(8000) });
  resume() {
    this.resumeCalls++;
    if (FakeContext.allowResume) {
      this.state = 'running';
      return Promise.resolve();
    }
    return Promise.reject(new Error('NotAllowedError'));
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
}

let listeners;
let unhandled;
const onUnhandled = (e) => unhandled.push(e);
const fire = (type) => (listeners[type] ?? []).forEach((fn) => fn());
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  listeners = {};
  unhandled = [];
  process.on('unhandledRejection', onUnhandled);
  FakeContext.allowResume = false;
  globalThis.window = { AudioContext: FakeContext };
  globalThis.document = {
    hidden: false,
    addEventListener: (type, fn) => (listeners[type] ??= []).push(fn),
  };
});
afterEach(() => {
  process.off('unhandledRejection', onUnhandled);
  delete globalThis.window;
  delete globalThis.document;
});

describe('audio resume', () => {
  it('swallows a refused resume and retries on the next tap', async () => {
    const audio = createAudio();
    audio.start();
    audio.start(); // second start tries resume() while it is still refused
    await flush();
    expect(unhandled).toHaveLength(0);
    expect(audio.state).toBe('suspended');

    FakeContext.allowResume = true;
    fire('pointerdown');
    await flush();
    expect(audio.state).toBe('running');
  });

  it('recovers from an iOS "interrupted" context on the next key press', async () => {
    FakeContext.allowResume = true;
    const audio = createAudio();
    audio.start();
    audio.start();
    await flush();
    FakeContext.last.state = 'interrupted'; // e.g. a phone call
    fire('keydown');
    await flush();
    expect(audio.state).toBe('running');
  });

  it('does not resume while the game is paused', async () => {
    FakeContext.allowResume = true;
    const audio = createAudio();
    audio.start();
    audio.suspend();
    const calls = FakeContext.last.resumeCalls;
    fire('pointerdown');
    fire('visibilitychange');
    await flush();
    expect(FakeContext.last.resumeCalls).toBe(calls);
    expect(audio.state).toBe('suspended');
  });

  it('plays silently when the AudioContext cannot be created', () => {
    globalThis.window = {
      AudioContext: class {
        constructor() {
          throw new Error('NotSupportedError');
        }
      },
    };
    const audio = createAudio();
    expect(() => audio.start()).not.toThrow();
    expect(audio.state).toBe('unavailable');
    expect(() => audio.update({ speed: 10, spec: { maxSpeed: 40 }, slip: 0 }, true)).not.toThrow();
  });
});
