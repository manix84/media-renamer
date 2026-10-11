import type { Episode } from './core/types';

export const demoEpisodes: Episode[] = [
  'The Name', 'The Prototype', 'The Competition', 'Testing', 'Elbonian Trip', 'The Takeover', 'Little People', 'Tower of Babel', 'Y2K', 'The Knack', 'Charity', 'Holiday', 'Infomercial',
].map((title, index) => ({ id: `dilbert-1-${index + 1}`, season: 1, number: index + 1, title }));

export const demoFiles = [
  'Dilbert.S01E01.The.Name.480p.DVDRip.AAC2.0.x264.mkv',
  'Dilbert.S01E02.The.Prototype.480p.DVDRip.AAC2.0.x264.mkv',
  'Dilbert.S01E04.The.Competition.480p.DVDRip.AAC2.0.x264.PROPER.mkv',
  'Dilbert.S01E03.Testing.480p.DVDRip.AAC2.0.x264.mkv',
];
