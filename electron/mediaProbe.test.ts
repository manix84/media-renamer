import { describe, expect, it } from 'vitest';
import { parseProbeOutput } from './mediaProbe.js';

describe('media probe', () => {
  it('normalizes the default video and audio streams', () => {
    expect(parseProbeOutput(JSON.stringify({ format: { duration: '2694.125000', tags: { title: 'The Pilot' } }, streams: [
      { codec_type: 'video', codec_name: 'hevc', width: 3840, height: 2160 },
      { codec_type: 'audio', codec_name: 'aac', channels: 2, channel_layout: 'stereo', tags: { language: 'eng' } },
      { codec_type: 'audio', codec_name: 'eac3', channels: 6, channel_layout: '5.1(side)', disposition: { default: 1 }, tags: { language: 'jpn' } },
      { codec_type: 'audio', codec_name: 'aac', channels: 2, tags: { language: 'ENG' } },
    ] }))).toEqual({ resolution: '2160p', videoCodec: 'H.265', audioCodec: 'E-AC-3', channels: '5.1', audioLanguages: [
      { name: 'English', code3: 'eng', code2: 'en' },
      { name: 'Japanese', code3: 'jpn', code2: 'ja' },
    ], durationSeconds: 2694.125, embeddedTitle: 'The Pilot' });
  });

  it('normalizes two-letter and bibliographic language codes and ignores undefined language', () => {
    expect(parseProbeOutput(JSON.stringify({ streams: [
      { codec_type: 'audio', tags: { language: 'fr' } },
      { codec_type: 'audio', tags: { language: 'ger' } },
      { codec_type: 'audio', tags: { language: 'und' } },
    ] })).audioLanguages).toEqual([
      { name: 'French', code3: 'fra', code2: 'fr' },
      { name: 'German', code3: 'deu', code2: 'de' },
    ]);
  });

  it('falls back to channel counts and tolerates missing streams', () => {
    expect(parseProbeOutput(JSON.stringify({ streams: [{ codec_type: 'audio', codec_name: 'flac', channels: 8 }] })))
      .toEqual({ resolution: undefined, videoCodec: undefined, audioCodec: 'FLAC', channels: '7.1', durationSeconds: undefined });
  });

  it.each([
    [1920, 816, '1080p'],
    [1920, 800, '1080p'],
    [1280, 536, '720p'],
    [720, 576, '576p'],
    [720, 480, '480p'],
  ])('maps a %ix%i cropped frame to the standard %s class', (width, height, resolution) => {
    expect(parseProbeOutput(JSON.stringify({ streams: [{ codec_type: 'video', width, height }] })).resolution)
      .toBe(resolution);
  });
});
