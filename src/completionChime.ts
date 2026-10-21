import type { ThemePalette } from './theme';

export type CompletionChimeTone = {
  frequency: number;
  start: number;
  duration: number;
  gain: number;
  wave: OscillatorType;
};

const STANDARD_CHIME: CompletionChimeTone[] = [
  { frequency: 523.25, start: 0, duration: .22, gain: .09, wave: 'sine' },
  { frequency: 659.25, start: .12, duration: .25, gain: .085, wave: 'sine' },
  { frequency: 783.99, start: .24, duration: .36, gain: .08, wave: 'sine' },
];

function melody(
  frequencies: number[],
  { step = .12, duration = .22, gain = .065, wave = 'sine' as OscillatorType } = {},
): CompletionChimeTone[] {
  return frequencies.map((frequency, index) => ({
    frequency,
    start: index * step,
    duration: index === frequencies.length - 1 ? duration + .12 : duration,
    gain,
    wave,
  }));
}

const HALLOWEEN_CHIME: CompletionChimeTone[] = [
  { frequency: 261.63, start: 0, duration: .15, gain: .065, wave: 'triangle' },
  { frequency: 293.66, start: .15, duration: .15, gain: .065, wave: 'triangle' },
  { frequency: 329.63, start: .3, duration: .15, gain: .065, wave: 'triangle' },
  { frequency: 349.23, start: .45, duration: .15, gain: .065, wave: 'triangle' },
];

const CHRISTMAS_CHIME: CompletionChimeTone[] = [
  ...melody([523.25, 493.88, 440, 392, 349.23, 392, 440, 349.23], {
    step: .12,
    duration: .19,
    gain: .065,
    wave: 'sine',
  }),
];

const SEASONAL_CHIMES: Partial<Record<ThemePalette, CompletionChimeTone[]>> = {
  valentines: melody([523.25, 659.25, 783.99, 1046.5], { duration: .24 }),
  pride: melody([523.25, 587.33, 659.25, 698.46, 783.99, 880], { step: .09, duration: .18 }),
  bonfire: melody([220, 329.63, 440, 659.25], { duration: .25, wave: 'triangle' }),
  'new-year': melody([392, 523.25, 659.25, 783.99, 1046.5], { step: .09, duration: .21 }),
  spring: melody([659.25, 783.99, 880, 783.99], { duration: .24 }),
  summer: melody([440, 554.37, 659.25, 880], { duration: .24 }),
  autumn: melody([659.25, 523.25, 440, 392], { duration: .25, wave: 'triangle' }),
  winter: melody([783.99, 659.25, 523.25], { step: .16, duration: .3 }),
  halloween: HALLOWEEN_CHIME,
  christmas: CHRISTMAS_CHIME,
};

export function completionChimeTones(palette: ThemePalette): CompletionChimeTone[] {
  return SEASONAL_CHIMES[palette] ?? STANDARD_CHIME;
}

export function prepareCompletionChime(palette: ThemePalette): { play: () => void; dispose: () => void } | undefined {
  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) return undefined;
  let context: AudioContext;
  try {
    context = new AudioContextConstructor();
  } catch {
    return undefined;
  }
  void context.resume().catch(() => undefined);
  let used = false;

  return {
    play() {
      if (used) return;
      used = true;
      try {
        const tones = completionChimeTones(palette);
        const origin = context.currentTime + .025;
        for (const tone of tones) {
          const oscillator = context.createOscillator();
          const envelope = context.createGain();
          const start = origin + tone.start;
          const end = start + tone.duration;
          oscillator.type = tone.wave;
          oscillator.frequency.setValueAtTime(tone.frequency, start);
          envelope.gain.setValueAtTime(.0001, start);
          envelope.gain.exponentialRampToValueAtTime(tone.gain, start + .018);
          envelope.gain.exponentialRampToValueAtTime(.0001, end);
          oscillator.connect(envelope).connect(context.destination);
          oscillator.start(start);
          oscillator.stop(end);
        }
        const duration = Math.max(...tones.map((tone) => tone.start + tone.duration));
        window.setTimeout(() => void context.close().catch(() => undefined), (duration + .15) * 1000);
      } catch {
        void context.close().catch(() => undefined);
      }
    },
    dispose() {
      if (used) return;
      used = true;
      void context.close().catch(() => undefined);
    },
  };
}
