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

const HALLOWEEN_CHIME: CompletionChimeTone[] = [
  { frequency: 392, start: 0, duration: .32, gain: .07, wave: 'triangle' },
  { frequency: 311.13, start: .13, duration: .38, gain: .065, wave: 'triangle' },
  { frequency: 523.25, start: .3, duration: .5, gain: .055, wave: 'sine' },
];

const CHRISTMAS_CHIME: CompletionChimeTone[] = [
  { frequency: 783.99, start: 0, duration: .3, gain: .07, wave: 'sine' },
  { frequency: 659.25, start: .11, duration: .32, gain: .065, wave: 'sine' },
  { frequency: 698.46, start: .22, duration: .34, gain: .065, wave: 'sine' },
  { frequency: 1046.5, start: .36, duration: .5, gain: .055, wave: 'sine' },
];

export function completionChimeTones(palette: ThemePalette): CompletionChimeTone[] {
  if (palette === 'halloween') return HALLOWEEN_CHIME;
  if (palette === 'christmas') return CHRISTMAS_CHIME;
  return STANDARD_CHIME;
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
