import { useMemo, useState } from 'react';
import { Check, ChevronRight, FileVideo, Film, FolderOpen, Search, Settings2, Sparkles, Tv, X } from 'lucide-react';
import { demoEpisodes, demoFiles } from './demo';
import { formatEpisode } from './core/formatter';
import { matchFile } from './core/matcher';

export default function App() {
  const [paths, setPaths] = useState(demoFiles);
  const [titleMatching, setTitleMatching] = useState(true);
  const matches = useMemo(() => paths.map((path) => matchFile(path, demoEpisodes, titleMatching)), [paths, titleMatching]);
  const confident = matches.filter((item) => item.status === 'confident').length;

  async function addFiles() {
    const selected = await window.mediaRenamer?.pickFiles();
    if (selected?.length) setPaths((current) => [...current, ...selected]);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Tv size={18} /></span> Media Renamer <span className="beta">ALPHA</span></div>
        <nav><button className="nav-active"><Tv size={15}/> TV</button><button><Film size={15}/> Movies <span className="soon">soon</span></button></nav>
        <button className="icon-button" aria-label="Settings"><Settings2 size={18}/></button>
      </header>

      <main>
        <section className="hero">
          <div><p className="eyebrow">ACTIVE SHOW</p><h1>Dilbert <span>(1999)</span></h1><p>13 episodes · Season 1 · TVDB</p></div>
          <label className="search"><Search size={17}/><input value="Dilbert" readOnly/><kbd>⌘ K</kbd></label>
        </section>

        <section className="workflow">
          <aside className="episode-panel panel">
            <div className="panel-heading"><div><p className="eyebrow">EPISODES</p><h2>Season 1</h2></div><span className="count">13</span></div>
            <div className="episode-list">
              {demoEpisodes.map((episode) => <div className="episode" key={episode.id}><span>{String(episode.number).padStart(2, '0')}</span><strong>{episode.title}</strong><Check size={14}/></div>)}
            </div>
          </aside>

          <section className="match-panel panel">
            <div className="panel-heading main-heading">
              <div><p className="eyebrow">MATCH &amp; REVIEW</p><h2>{matches.length} imported files</h2></div>
              <button className="secondary" onClick={addFiles}><FolderOpen size={16}/> Add files</button>
            </div>
            <label className="matching-option"><span><Sparkles size={17}/><span><strong>Match episode names</strong><small>Best effort when numbering and titles disagree</small></span></span><input type="checkbox" checked={titleMatching} onChange={(event) => setTitleMatching(event.target.checked)}/></label>
            <div className="match-list">
              {matches.map((item, index) => {
                const output = item.match ? formatEpisode('Dilbert', 1999, item.match.episode, item.tags) : 'No suggested name';
                return <article className="match-row" key={`${item.path}-${index}`}>
                  <div className={`status-dot ${item.status}`}>{item.status === 'confident' ? <Check/> : item.status === 'review' ? '!' : <X/>}</div>
                  <div className="file-pair"><div className="original"><FileVideo size={15}/><span>{item.filename}</span></div><div className="arrow"><ChevronRight size={15}/></div><div className="proposed">{output}<span>.mkv</span></div></div>
                  <div className="score"><strong>{Math.round((item.match?.score ?? 0) * 100)}%</strong><small>{item.status}</small></div>
                </article>;
              })}
            </div>
            <div className="dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
              event.preventDefault();
              const dropped = [...event.dataTransfer.files].map((file) => file.name);
              setPaths((current) => [...current, ...dropped]);
            }}><FolderOpen size={24}/><span>Drop episode files here</span><small>MKV, MP4, AVI and more</small></div>
          </section>
        </section>
      </main>

      <footer><div><span className="legend confident"></span>{confident} ready <span className="legend review"></span>{matches.length - confident} need review</div><div><button className="secondary">Export plan</button><button className="primary" disabled={confident === 0}>Rename {confident} files <ChevronRight size={16}/></button></div></footer>
    </div>
  );
}
