const recognisableFields: Array<[RegExp, string]> = [
  [/\{\{show\.name\}\}/i, 'Show'],
  [/\{\{movie\.name\}\}/i, 'Movie'],
  [/\{\{show\.year\}\}/i, 'Year'],
  [/\{\{movie\.year\}\}/i, 'Year'],
  [/\{\{episode\.range\}\}/i, 'S01E01'],
  [/\{\{title\}\}|\{\{episode\.title\}\}/i, 'Title'],
  [/\{\{technical\}\}/i, 'Technical'],
  [/\{\{show\.tvdbId\}\}/i, 'TVDB'],
  [/\{\{movie\.tmdbId\}\}/i, 'TMDB'],
  [/\{\{release\.edition\}\}/i, 'Edition'],
  [/\{\{release\.audioCodec\}\}/i, 'Audio'],
  [/\{\{audio\.languageCodes3\}\}/i, 'Languages'],
];

export function automaticEpisodeTemplateName(template: string): string {
  const fields = recognisableFields.flatMap(([pattern, label]) => {
    const index = template.search(pattern);
    return index < 0 ? [] : [{ index, label }];
  }).sort((left, right) => left.index - right.index).map(({ label }) => label);
  return fields.length ? fields.slice(0, 6).join(' · ') : 'Custom episode template';
}

export function episodeTemplateFavouriteName(favourite: { name: string; template: string }): string {
  return favourite.name.trim() || automaticEpisodeTemplateName(favourite.template);
}
