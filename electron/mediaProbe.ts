import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

type ProbeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  channels?: number;
  channel_layout?: string;
  disposition?: { default?: number };
};

export interface MediaTechnicalTags {
  resolution?: string;
  videoCodec?: string;
  audioCodec?: string;
  channels?: string;
  durationSeconds?: number;
}

function videoCodec(name?: string): string | undefined {
  return ({ h264: 'H.264', hevc: 'H.265', av1: 'AV1', vp9: 'VP9', mpeg4: 'MPEG-4', vc1: 'VC-1' } as Record<string, string>)[name?.toLowerCase() ?? ''] ?? name?.toUpperCase();
}

function audioCodec(name?: string): string | undefined {
  return ({ aac: 'AAC', ac3: 'AC-3', eac3: 'E-AC-3', dts: 'DTS', truehd: 'TrueHD', flac: 'FLAC', opus: 'Opus', mp3: 'MP3' } as Record<string, string>)[name?.toLowerCase() ?? ''] ?? name?.toUpperCase();
}

function channelLayout(stream?: ProbeStream): string | undefined {
  const layout = stream?.channel_layout?.match(/^(\d+(?:\.\d+)?)/)?.[1];
  if (layout) return layout;
  return ({ 1: '1.0', 2: '2.0', 6: '5.1', 8: '7.1' } as Record<number, string>)[stream?.channels ?? 0]
    ?? (stream?.channels ? String(stream.channels) : undefined);
}

function preferredStream(streams: ProbeStream[], type: string): ProbeStream | undefined {
  const matching = streams.filter((stream) => stream.codec_type === type);
  return matching.find((stream) => stream.disposition?.default === 1) ?? matching[0];
}

function standardResolution(width?: number, height?: number): string | undefined {
  if (!width || !height) return undefined;
  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);
  // Cinematic encodes commonly crop letterbox pixels (for example 1920x816),
  // so classify HD/UHD by the retained long edge rather than exposing the raw height.
  if (longEdge >= 3000 || shortEdge >= 1600) return '2160p';
  if (longEdge >= 1600 || shortEdge >= 900) return '1080p';
  if (longEdge >= 1100 || shortEdge >= 650) return '720p';
  if (shortEdge >= 540) return '576p';
  if (shortEdge >= 450) return '480p';
  if (shortEdge >= 300) return '360p';
  if (shortEdge >= 200) return '240p';
  return '144p';
}

export function parseProbeOutput(output: string): MediaTechnicalTags {
  const data = JSON.parse(output) as { streams?: ProbeStream[]; format?: { duration?: string } };
  const streams = data.streams ?? [];
  const video = preferredStream(streams, 'video');
  const audio = preferredStream(streams, 'audio');
  const duration = Number(data.format?.duration);
  return {
    resolution: standardResolution(video?.width, video?.height),
    videoCodec: videoCodec(video?.codec_name),
    audioCodec: audioCodec(audio?.codec_name),
    channels: channelLayout(audio),
    durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : undefined,
  };
}

export async function probeMedia(filePath: string, ffprobePath = process.env.FFPROBE_PATH || 'ffprobe'): Promise<MediaTechnicalTags> {
  try {
    const { stdout } = await execFileAsync(ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,channels,channel_layout:stream_disposition=default',
      '-of', 'json',
      filePath,
    ], { encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 30_000 });
    return parseProbeOutput(stdout);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('ffprobe is not installed or FFPROBE_PATH is incorrect.');
    throw error;
  }
}
