import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type AppLanguage = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt-BR' | 'ja' | 'ko' | 'zh-CN';
export type LanguagePreference = 'system' | AppLanguage;

export const LANGUAGE_OPTIONS: Array<{ value: LanguagePreference; label: string }> = [
  { value: 'system', label: 'Automatic' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'zh-CN', label: '简体中文' },
];

const en = {
  'nav.tv': 'TV', 'nav.movies': 'Movies',
  'common.automatic': 'Automatic', 'common.light': 'Light', 'common.dark': 'Dark', 'common.choose': 'Choose', 'common.change': 'Change', 'common.cancel': 'Cancel',
  'hero.activeShow': 'ACTIVE SHOW', 'hero.activeMovie': 'ACTIVE MOVIE', 'hero.chooseShow': 'Choose a TV show', 'hero.chooseMovie': 'Choose a movie',
  'hero.searchShow': 'Search TV shows', 'hero.searchMovie': 'Search movies', 'hero.showPlaceholder': 'Show name, tvdb-482771, or tmdb-…', 'hero.moviePlaceholder': 'Movie name or tmdb-…',
  'panel.episodes': 'EPISODES', 'panel.selectShow': 'Select a show', 'panel.searchShow': 'Search for a show to begin.', 'panel.searchMovie': 'Search for a movie to begin.',
  'panel.matchReview': 'MATCH & REVIEW', 'panel.importedFiles': '{count} imported files', 'panel.moveFiles': 'Move files', 'panel.inPlace': 'In place', 'panel.batchMetadata': 'Batch metadata',
  'panel.refreshMedia': 'Refresh media', 'panel.clearAll': 'Clear all', 'panel.addFiles': 'Add files', 'panel.addFolder': 'Add folder',
  'footer.ready': '{count} ready', 'footer.blocked': '{count} blocked', 'footer.undo': 'Undo last rename', 'footer.export': 'Export plan', 'footer.rename': 'Rename {count} files',
  'prefs.settings': 'SETTINGS', 'prefs.title': 'Preferences', 'prefs.language': 'Language', 'prefs.languageHelp': 'Follow the system language or choose an override.',
  'prefs.systemLanguage': 'System language', 'prefs.appearance': 'Appearance', 'prefs.appearanceHelp': 'Choose how Media Renamer looks.', 'prefs.colourTheme': 'Colour theme',
  'prefs.colourHelp': 'Works with Automatic, Light, and Dark', 'prefs.fileList': 'File list', 'prefs.fileListHelp': 'Choose how much information each imported file displays.',
  'prefs.fileMoves': 'File moves', 'prefs.fileMovesHelp': 'Choose what happens to source folders after files are moved.', 'prefs.afterRename': 'After renaming',
  'prefs.afterRenameHelp': 'Choose what happens after every file in a batch is renamed successfully.', 'prefs.shows': 'Shows', 'prefs.movies': 'Movies',
  'prefs.close': 'Close preferences', 'prefs.removeEmpty': 'Remove empty source folders', 'prefs.removeEmptyHelp': "Delete a moved file's immediate parent folder only when it is empty",
  'prefs.clearJunk': 'Clear source junk after moving', 'prefs.clearJunkHelp': 'Delete recognized YTS/YIFY promotions and empty subtitle files so source folders can be removed; this cannot be undone',
  'prefs.autoClear': 'Clear completed batches automatically', 'prefs.autoClearHelp': 'Remove the finished batch from the workspace while keeping Undo available',
  'prefs.completionChime': 'Play a chime when complete', 'prefs.completionChimeHelp': 'Plays once when enabled, with matching Halloween and Christmas sounds',
  'prefs.completionReport': 'Show a completion report', 'prefs.completionReportHelp': 'Summarise processed files, removed folders, warnings, and logs',
  'prefs.saveLog': 'Save a timestamped operation log', 'prefs.saveLogHelp': 'Off by default; rename success is not blocked if this optional log cannot be written',
  'debug.title': 'Debug console', 'debug.empty': 'No activity recorded yet.', 'debug.session': '{count} events · local session only',
} as const;

type TranslationKey = keyof typeof en;
type Dictionary = Partial<Record<TranslationKey, string>>;

const translations: Record<AppLanguage, Dictionary> = {
  en,
  es: { 'nav.movies':'Películas','common.automatic':'Automático','common.light':'Claro','common.dark':'Oscuro','common.choose':'Elegir','common.change':'Cambiar','common.cancel':'Cancelar','hero.activeShow':'SERIE ACTIVA','hero.activeMovie':'PELÍCULA ACTIVA','hero.chooseShow':'Elige una serie','hero.chooseMovie':'Elige una película','hero.searchShow':'Buscar series','hero.searchMovie':'Buscar películas','panel.episodes':'EPISODIOS','panel.selectShow':'Selecciona una serie','panel.searchShow':'Busca una serie para empezar.','panel.searchMovie':'Busca una película para empezar.','panel.matchReview':'REVISAR COINCIDENCIAS','panel.importedFiles':'{count} archivos importados','panel.moveFiles':'Mover archivos','panel.inPlace':'En su sitio','panel.batchMetadata':'Metadatos del lote','panel.refreshMedia':'Actualizar medios','panel.clearAll':'Borrar todo','panel.addFiles':'Añadir archivos','panel.addFolder':'Añadir carpeta','footer.ready':'{count} listos','footer.blocked':'{count} bloqueados','footer.undo':'Deshacer último cambio','footer.export':'Exportar plan','footer.rename':'Renombrar {count} archivos','prefs.settings':'AJUSTES','prefs.title':'Preferencias','prefs.language':'Idioma','prefs.languageHelp':'Usa el idioma del sistema o elige otro.','prefs.systemLanguage':'Idioma del sistema','prefs.appearance':'Apariencia','prefs.fileList':'Lista de archivos','prefs.fileMoves':'Movimiento de archivos','prefs.afterRename':'Después de renombrar','prefs.shows':'Series','prefs.movies':'Películas','prefs.close':'Cerrar preferencias','debug.title':'Consola de depuración','debug.empty':'Todavía no hay actividad.','debug.session':'{count} eventos · solo sesión local' },
  fr: { 'nav.movies':'Films','common.automatic':'Automatique','common.light':'Clair','common.dark':'Sombre','common.choose':'Choisir','common.change':'Modifier','common.cancel':'Annuler','hero.activeShow':'SÉRIE ACTIVE','hero.activeMovie':'FILM ACTIF','hero.chooseShow':'Choisir une série','hero.chooseMovie':'Choisir un film','hero.searchShow':'Rechercher des séries','hero.searchMovie':'Rechercher des films','panel.episodes':'ÉPISODES','panel.selectShow':'Sélectionner une série','panel.searchShow':'Recherchez une série pour commencer.','panel.searchMovie':'Recherchez un film pour commencer.','panel.matchReview':'VÉRIFICATION','panel.importedFiles':'{count} fichiers importés','panel.moveFiles':'Déplacer','panel.inPlace':'Sur place','panel.batchMetadata':'Métadonnées du lot','panel.refreshMedia':'Actualiser','panel.clearAll':'Tout effacer','panel.addFiles':'Ajouter des fichiers','panel.addFolder':'Ajouter un dossier','footer.ready':'{count} prêts','footer.blocked':'{count} bloqués','footer.undo':'Annuler le dernier renommage','footer.export':'Exporter le plan','footer.rename':'Renommer {count} fichiers','prefs.settings':'PARAMÈTRES','prefs.title':'Préférences','prefs.language':'Langue','prefs.languageHelp':'Suivre la langue du système ou choisir une autre langue.','prefs.systemLanguage':'Langue du système','prefs.appearance':'Apparence','prefs.fileList':'Liste des fichiers','prefs.fileMoves':'Déplacement des fichiers','prefs.afterRename':'Après le renommage','prefs.shows':'Séries','prefs.movies':'Films','prefs.close':'Fermer les préférences','debug.title':'Console de débogage','debug.empty':'Aucune activité enregistrée.','debug.session':'{count} événements · session locale uniquement' },
  de: { 'nav.movies':'Filme','common.automatic':'Automatisch','common.light':'Hell','common.dark':'Dunkel','common.choose':'Auswählen','common.change':'Ändern','common.cancel':'Abbrechen','hero.activeShow':'AKTIVE SERIE','hero.activeMovie':'AKTIVER FILM','hero.chooseShow':'TV-Serie auswählen','hero.chooseMovie':'Film auswählen','hero.searchShow':'Serien suchen','hero.searchMovie':'Filme suchen','panel.episodes':'EPISODEN','panel.selectShow':'Serie auswählen','panel.searchShow':'Suche eine Serie, um zu beginnen.','panel.searchMovie':'Suche einen Film, um zu beginnen.','panel.matchReview':'ZUORDNUNG PRÜFEN','panel.importedFiles':'{count} importierte Dateien','panel.moveFiles':'Dateien verschieben','panel.inPlace':'Am selben Ort','panel.batchMetadata':'Stapel-Metadaten','panel.refreshMedia':'Medien aktualisieren','panel.clearAll':'Alles löschen','panel.addFiles':'Dateien hinzufügen','panel.addFolder':'Ordner hinzufügen','footer.ready':'{count} bereit','footer.blocked':'{count} blockiert','footer.undo':'Letzte Umbenennung rückgängig','footer.export':'Plan exportieren','footer.rename':'{count} Dateien umbenennen','prefs.settings':'EINSTELLUNGEN','prefs.title':'Einstellungen','prefs.language':'Sprache','prefs.languageHelp':'Systemsprache verwenden oder überschreiben.','prefs.systemLanguage':'Systemsprache','prefs.appearance':'Darstellung','prefs.fileList':'Dateiliste','prefs.fileMoves':'Dateiverschiebung','prefs.afterRename':'Nach dem Umbenennen','prefs.shows':'Serien','prefs.movies':'Filme','prefs.close':'Einstellungen schließen','debug.title':'Debug-Konsole','debug.empty':'Noch keine Aktivität.','debug.session':'{count} Ereignisse · nur lokale Sitzung' },
  it: { 'nav.movies':'Film','common.automatic':'Automatico','common.light':'Chiaro','common.dark':'Scuro','common.choose':'Scegli','common.change':'Cambia','common.cancel':'Annulla','hero.activeShow':'SERIE ATTIVA','hero.activeMovie':'FILM ATTIVO','hero.chooseShow':'Scegli una serie TV','hero.chooseMovie':'Scegli un film','hero.searchShow':'Cerca serie TV','hero.searchMovie':'Cerca film','panel.episodes':'EPISODI','panel.selectShow':'Seleziona una serie','panel.searchShow':'Cerca una serie per iniziare.','panel.searchMovie':'Cerca un film per iniziare.','panel.matchReview':'VERIFICA ABBINAMENTI','panel.importedFiles':'{count} file importati','panel.moveFiles':'Sposta file','panel.inPlace':'Sul posto','panel.batchMetadata':'Metadati del gruppo','panel.refreshMedia':'Aggiorna media','panel.clearAll':'Cancella tutto','panel.addFiles':'Aggiungi file','panel.addFolder':'Aggiungi cartella','footer.ready':'{count} pronti','footer.blocked':'{count} bloccati','footer.undo':'Annulla ultima rinomina','footer.export':'Esporta piano','footer.rename':'Rinomina {count} file','prefs.settings':'IMPOSTAZIONI','prefs.title':'Preferenze','prefs.language':'Lingua','prefs.languageHelp':'Usa la lingua di sistema o scegline un’altra.','prefs.systemLanguage':'Lingua di sistema','prefs.appearance':'Aspetto','prefs.fileList':'Elenco file','prefs.fileMoves':'Spostamento file','prefs.afterRename':'Dopo la rinomina','prefs.shows':'Serie','prefs.movies':'Film','prefs.close':'Chiudi preferenze','debug.title':'Console di debug','debug.empty':'Nessuna attività registrata.','debug.session':'{count} eventi · solo sessione locale' },
  'pt-BR': { 'nav.movies':'Filmes','common.automatic':'Automático','common.light':'Claro','common.dark':'Escuro','common.choose':'Escolher','common.change':'Alterar','common.cancel':'Cancelar','hero.activeShow':'SÉRIE ATIVA','hero.activeMovie':'FILME ATIVO','hero.chooseShow':'Escolha uma série','hero.chooseMovie':'Escolha um filme','hero.searchShow':'Buscar séries','hero.searchMovie':'Buscar filmes','panel.episodes':'EPISÓDIOS','panel.selectShow':'Selecione uma série','panel.searchShow':'Busque uma série para começar.','panel.searchMovie':'Busque um filme para começar.','panel.matchReview':'REVISAR CORRESPONDÊNCIAS','panel.importedFiles':'{count} arquivos importados','panel.moveFiles':'Mover arquivos','panel.inPlace':'No local','panel.batchMetadata':'Metadados do lote','panel.refreshMedia':'Atualizar mídia','panel.clearAll':'Limpar tudo','panel.addFiles':'Adicionar arquivos','panel.addFolder':'Adicionar pasta','footer.ready':'{count} prontos','footer.blocked':'{count} bloqueados','footer.undo':'Desfazer última renomeação','footer.export':'Exportar plano','footer.rename':'Renomear {count} arquivos','prefs.settings':'CONFIGURAÇÕES','prefs.title':'Preferências','prefs.language':'Idioma','prefs.languageHelp':'Use o idioma do sistema ou escolha outro.','prefs.systemLanguage':'Idioma do sistema','prefs.appearance':'Aparência','prefs.fileList':'Lista de arquivos','prefs.fileMoves':'Movimentação de arquivos','prefs.afterRename':'Após renomear','prefs.shows':'Séries','prefs.movies':'Filmes','prefs.close':'Fechar preferências','debug.title':'Console de depuração','debug.empty':'Nenhuma atividade registrada.','debug.session':'{count} eventos · somente sessão local' },
  ja: { 'nav.movies':'映画','common.automatic':'自動','common.light':'ライト','common.dark':'ダーク','common.choose':'選択','common.change':'変更','common.cancel':'キャンセル','hero.activeShow':'選択中の番組','hero.activeMovie':'選択中の映画','hero.chooseShow':'テレビ番組を選択','hero.chooseMovie':'映画を選択','hero.searchShow':'テレビ番組を検索','hero.searchMovie':'映画を検索','panel.episodes':'エピソード','panel.selectShow':'番組を選択','panel.searchShow':'番組を検索して開始します。','panel.searchMovie':'映画を検索して開始します。','panel.matchReview':'一致を確認','panel.importedFiles':'インポート済み {count} ファイル','panel.moveFiles':'ファイルを移動','panel.inPlace':'その場で変更','panel.batchMetadata':'一括メタデータ','panel.refreshMedia':'メディアを更新','panel.clearAll':'すべて消去','panel.addFiles':'ファイルを追加','panel.addFolder':'フォルダーを追加','footer.ready':'準備完了 {count}','footer.blocked':'ブロック {count}','footer.undo':'最後の名前変更を元に戻す','footer.export':'プランをエクスポート','footer.rename':'{count} ファイルの名前を変更','prefs.settings':'設定','prefs.title':'環境設定','prefs.language':'言語','prefs.languageHelp':'システム言語を使用するか、言語を指定します。','prefs.systemLanguage':'システム言語','prefs.appearance':'外観','prefs.fileList':'ファイル一覧','prefs.fileMoves':'ファイル移動','prefs.afterRename':'名前変更後','prefs.shows':'番組','prefs.movies':'映画','prefs.close':'環境設定を閉じる','debug.title':'デバッグコンソール','debug.empty':'まだアクティビティはありません。','debug.session':'{count} 件 · ローカルセッションのみ' },
  ko: { 'nav.movies':'영화','common.automatic':'자동','common.light':'라이트','common.dark':'다크','common.choose':'선택','common.change':'변경','common.cancel':'취소','hero.activeShow':'선택된 프로그램','hero.activeMovie':'선택된 영화','hero.chooseShow':'TV 프로그램 선택','hero.chooseMovie':'영화 선택','hero.searchShow':'TV 프로그램 검색','hero.searchMovie':'영화 검색','panel.episodes':'에피소드','panel.selectShow':'프로그램 선택','panel.searchShow':'프로그램을 검색해 시작하세요.','panel.searchMovie':'영화를 검색해 시작하세요.','panel.matchReview':'일치 항목 검토','panel.importedFiles':'가져온 파일 {count}개','panel.moveFiles':'파일 이동','panel.inPlace':'현재 위치','panel.batchMetadata':'일괄 메타데이터','panel.refreshMedia':'미디어 새로 고침','panel.clearAll':'모두 지우기','panel.addFiles':'파일 추가','panel.addFolder':'폴더 추가','footer.ready':'준비 {count}','footer.blocked':'차단 {count}','footer.undo':'마지막 이름 변경 실행 취소','footer.export':'계획 내보내기','footer.rename':'파일 {count}개 이름 변경','prefs.settings':'설정','prefs.title':'환경설정','prefs.language':'언어','prefs.languageHelp':'시스템 언어를 따르거나 언어를 선택하세요.','prefs.systemLanguage':'시스템 언어','prefs.appearance':'모양','prefs.fileList':'파일 목록','prefs.fileMoves':'파일 이동','prefs.afterRename':'이름 변경 후','prefs.shows':'프로그램','prefs.movies':'영화','prefs.close':'환경설정 닫기','debug.title':'디버그 콘솔','debug.empty':'아직 기록된 활동이 없습니다.','debug.session':'이벤트 {count}개 · 로컬 세션만' },
  'zh-CN': { 'nav.movies':'电影','common.automatic':'自动','common.light':'浅色','common.dark':'深色','common.choose':'选择','common.change':'更改','common.cancel':'取消','hero.activeShow':'当前剧集','hero.activeMovie':'当前电影','hero.chooseShow':'选择电视剧','hero.chooseMovie':'选择电影','hero.searchShow':'搜索电视剧','hero.searchMovie':'搜索电影','panel.episodes':'剧集','panel.selectShow':'选择电视剧','panel.searchShow':'搜索电视剧以开始。','panel.searchMovie':'搜索电影以开始。','panel.matchReview':'匹配与检查','panel.importedFiles':'已导入 {count} 个文件','panel.moveFiles':'移动文件','panel.inPlace':'原地重命名','panel.batchMetadata':'批量元数据','panel.refreshMedia':'刷新媒体','panel.clearAll':'全部清除','panel.addFiles':'添加文件','panel.addFolder':'添加文件夹','footer.ready':'{count} 个就绪','footer.blocked':'{count} 个受阻','footer.undo':'撤销上次重命名','footer.export':'导出计划','footer.rename':'重命名 {count} 个文件','prefs.settings':'设置','prefs.title':'偏好设置','prefs.language':'语言','prefs.languageHelp':'跟随系统语言或选择其他语言。','prefs.systemLanguage':'系统语言','prefs.appearance':'外观','prefs.fileList':'文件列表','prefs.fileMoves':'文件移动','prefs.afterRename':'重命名后','prefs.shows':'电视剧','prefs.movies':'电影','prefs.close':'关闭偏好设置','debug.title':'调试控制台','debug.empty':'尚无活动记录。','debug.session':'{count} 个事件 · 仅限本地会话' },
};

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === 'system' || LANGUAGE_OPTIONS.some((option) => option.value === value);
}

export function resolveLanguage(preference: LanguagePreference, locales: readonly string[] = navigator.languages): AppLanguage {
  if (preference !== 'system') return preference;
  for (const locale of locales) {
    const normalized = locale.toLowerCase();
    if (normalized.startsWith('pt')) return 'pt-BR';
    if (normalized.startsWith('zh')) return 'zh-CN';
    const base = normalized.split('-')[0] as AppLanguage;
    if (LANGUAGE_OPTIONS.some((option) => option.value === base)) return base;
  }
  return 'en';
}

const I18nContext = createContext<{ language: AppLanguage; preference: LanguagePreference; setPreference: (value: LanguagePreference) => void; t: (key: TranslationKey, values?: Record<string, string | number>) => string } | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<LanguagePreference>('system');
  const [hydrated, setHydrated] = useState(false);
  const language = resolveLanguage(preference);

  useEffect(() => {
    let active = true;
    window.mediaRenamer?.loadPreferences().then((saved) => { if (active && isLanguagePreference(saved.languagePreference)) setPreferenceState(saved.languagePreference); }).catch(() => undefined).finally(() => { if (active) setHydrated(true); });
    if (!window.mediaRenamer?.loadPreferences) setHydrated(true);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = 'ltr';
  }, [language]);

  useEffect(() => {
    if (hydrated) void window.mediaRenamer?.savePreferences({ languagePreference: preference }).catch(() => undefined);
  }, [hydrated, preference]);

  const value = useMemo(() => ({ language, preference, setPreference: setPreferenceState, t: (key: TranslationKey, values: Record<string, string | number> = {}) => {
    let text: string = translations[language][key] ?? en[key];
    for (const [name, replacement] of Object.entries(values)) text = text.replaceAll(`{${name}}`, String(replacement));
    return text;
  } }), [language, preference]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider.');
  return context;
}
