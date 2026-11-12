import { useEffect, useMemo, useState } from 'react'

type ReleaseAsset = {
  name: string
  browser_download_url: string
  size: number
}

type Release = {
  tag_name: string
  html_url: string
  published_at: string
  assets: ReleaseAsset[]
}

type Platform = 'Windows' | 'macOS' | 'Linux'

const REPOSITORY = 'https://github.com/manix84/media-renamer'
const LATEST_RELEASE = `${REPOSITORY}/releases/latest`

const platformRules: Record<Platform, RegExp> = {
  Windows: /\.exe$/i,
  macOS: /\.(dmg|zip)$/i,
  Linux: /\.(AppImage|deb|rpm|tar\.gz)$/i,
}

const platformDescriptions: Record<Platform, string> = {
  Windows: 'Installer or no-install portable edition',
  macOS: 'Drag-to-Applications DMG or ZIP archive',
  Linux: 'AppImage, Debian, RPM, or USB-portable',
}

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function friendlyAssetName(name: string) {
  if (/setup\.exe$/i.test(name)) return 'Windows installer'
  if (/portable\.exe$/i.test(name)) return 'Windows portable'
  if (/\.dmg$/i.test(name)) return 'macOS disk image'
  if (/\.zip$/i.test(name)) return 'macOS ZIP'
  if (/\.AppImage$/i.test(name)) return 'Linux AppImage'
  if (/\.deb$/i.test(name)) return 'Debian / Ubuntu / Mint'
  if (/\.rpm$/i.test(name)) return 'Fedora / RHEL / openSUSE'
  if (/portable\.tar\.gz$/i.test(name)) return 'Linux USB-portable'
  return name
}

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
}

function DownloadIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 20h14" /></svg>
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
}

function App() {
  const [release, setRelease] = useState<Release | null>(null)
  const [releaseError, setReleaseError] = useState(false)
  const [activePlatform, setActivePlatform] = useState<Platform>(() => {
    const platform = navigator.platform.toLowerCase()
    if (platform.includes('mac')) return 'macOS'
    if (platform.includes('win')) return 'Windows'
    return 'Linux'
  })

  useEffect(() => {
    const controller = new AbortController()
    fetch('https://api.github.com/repos/manix84/media-renamer/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Release unavailable')
        return response.json() as Promise<Release>
      })
      .then(setRelease)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setReleaseError(true)
      })
    return () => controller.abort()
  }, [])

  const assets = useMemo(
    () => release?.assets.filter((asset) => platformRules[activePlatform].test(asset.name)) ?? [],
    [activePlatform, release],
  )

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Media Renamer home">
          <img src={`${import.meta.env.BASE_URL}media-renamer-icon.png`} alt="" />
          <span>Media Renamer</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#why">Why it works</a>
          <a href="#downloads">Downloads</a>
          <a href="#trust">Trust &amp; privacy</a>
          <a className="nav-source" href={REPOSITORY}>View source <ArrowIcon /></a>
        </nav>
      </header>

      <main id="top">
        <section className="hero section-wrap">
          <div className="hero-copy">
            <p className="eyebrow"><span /> Free · Open source · Local first</p>
            <h1>Your media names,<br/><em>finally under control.</em></h1>
            <p className="hero-intro">A confidence-first desktop app that turns inconsistent TV and movie filenames into a clean, predictable library—without hiding what it plans to change.</p>
            <div className="hero-actions">
              <a className="button primary" href="#downloads"><DownloadIcon /> Download the latest release</a>
              <a className="button secondary" href={REPOSITORY}>Explore on GitHub <ArrowIcon /></a>
            </div>
            <ul className="hero-assurances" aria-label="Product assurances">
              <li><CheckIcon /> Preview every change</li>
              <li><CheckIcon /> Undo completed work</li>
              <li><CheckIcon /> No ads or tracking</li>
            </ul>
          </div>

          <div className="product-stage" aria-label="Example Media Renamer workflow">
            <div className="stage-glow" />
            <div className="app-window">
              <div className="window-bar">
                <div className="window-dots"><i/><i/><i/></div>
                <span>Match &amp; review</span>
                <b>3 files ready</b>
              </div>
              <div className="window-body">
                <div className="source-panel">
                  <p className="mini-label">Original files</p>
                  <div className="file-row"><span className="file-icon">01</span><div><strong>Severance.S02E01.2160p.WEB</strong><small>Unsorted downloads</small></div></div>
                  <div className="file-row"><span className="file-icon">02</span><div><strong>severance 2x02 hdr x265</strong><small>Unsorted downloads</small></div></div>
                  <div className="file-row"><span className="file-icon">03</span><div><strong>Severance - Chikhai Bardo</strong><small>Unsorted downloads</small></div></div>
                </div>
                <div className="flow-column"><span>→</span><span>→</span><span>→</span></div>
                <div className="result-panel">
                  <p className="mini-label">Proposed names</p>
                  <div className="result-row"><span className="confidence">98%</span><div><strong>Severance - S02E01 - Hello, Ms. Cobel</strong><small>Confident match</small></div></div>
                  <div className="result-row"><span className="confidence">96%</span><div><strong>Severance - S02E02 - Goodbye, Mrs. Selvig</strong><small>Confident match</small></div></div>
                  <div className="result-row review"><span className="confidence">82%</span><div><strong>Severance - S02E07 - Chikhai Bardo</strong><small>Review before renaming</small></div></div>
                </div>
              </div>
              <div className="window-footer"><span>Nothing moves until you approve it.</span><button type="button">Review &amp; rename</button></div>
            </div>
            <div className="floating-note"><span>✓</span><div><strong>Collision checks passed</strong><small>Every destination is safe</small></div></div>
          </div>
        </section>

        <section className="principle-band" id="why">
          <div className="section-wrap principle-grid">
            <div><span className="number">01</span><h2>See the plan</h2><p>Original and proposed names sit side by side, with confidence and evidence visible before anything changes.</p></div>
            <div><span className="number">02</span><h2>Keep the useful detail</h2><p>Preserve source, resolution, codecs, audio languages, release groups, editions, and companion files.</p></div>
            <div><span className="number">03</span><h2>Stay in control</h2><p>Preflight checks catch collisions and invalid names. Progress can be stopped, and completed work can be undone.</p></div>
          </div>
        </section>

        <section className="story section-wrap">
          <div className="story-heading">
            <p className="eyebrow">Built for real libraries</p>
            <h2>Messy inputs.<br/>Predictable outcomes.</h2>
          </div>
          <div className="story-content">
            <p className="story-lead">Media Renamer combines filename evidence with provider metadata instead of blindly trusting either one.</p>
            <div className="feature-list">
              <article><span>TV</span><div><h3>Episode-aware matching</h3><p>Understands common season and episode formats, titles, multi-episode files, anime versions, and ambiguous matches.</p></div></article>
              <article><span>4K</span><div><h3>Technical metadata retained</h3><p>Reads filenames and embedded media information so your carefully collected release details survive the tidy-up.</p></div></article>
              <article><span>↶</span><div><h3>Reversible by design</h3><p>Rename plans, operation logs, collision checks, cooperative stopping, and undo are part of the foundation—not afterthoughts.</p></div></article>
            </div>
          </div>
        </section>

        <section className="download-section" id="downloads">
          <div className="section-wrap">
            <div className="download-heading">
              <div><p className="eyebrow light">Download</p><h2>Choose your platform.</h2></div>
              <p>Everything needed to run Media Renamer is included. No Node.js, Electron, or dependency installation required.</p>
            </div>
            <div className="platform-tabs" role="tablist" aria-label="Operating system">
              {(Object.keys(platformRules) as Platform[]).map((platform) => (
                <button key={platform} type="button" role="tab" aria-selected={activePlatform === platform} onClick={() => setActivePlatform(platform)}>{platform}</button>
              ))}
            </div>
            <div className="download-card">
              <div className="download-card-heading">
                <div className="platform-mark">{activePlatform === 'Windows' ? '⊞' : activePlatform === 'macOS' ? '⌘' : '◆'}</div>
                <div><h3>{activePlatform}</h3><p>{platformDescriptions[activePlatform]}</p></div>
                <span className="release-version">{release?.tag_name ?? (releaseError ? 'Latest release' : 'Checking…')}</span>
              </div>
              <div className="asset-list">
                {assets.map((asset) => (
                  <a key={asset.name} href={asset.browser_download_url}>
                    <span><strong>{friendlyAssetName(asset.name)}</strong><small>{asset.name}</small></span>
                    <span className="asset-meta">{formatBytes(asset.size)} <DownloadIcon /></span>
                  </a>
                ))}
                {!release && (
                  <a href={LATEST_RELEASE}><span><strong>{releaseError ? 'Open the latest GitHub release' : 'Loading release files…'}</strong><small>{releaseError ? 'GitHub API unavailable—downloads remain available.' : 'Fetching current filenames and sizes.'}</small></span><span className="asset-meta"><ArrowIcon /></span></a>
                )}
              </div>
              <div className="download-footer">
                <span>MIT licensed</span><span>SHA-256 checksums</span><span>Verifiable build provenance</span>
                {release && <a href={release.html_url}>Release notes <ArrowIcon /></a>}
              </div>
            </div>
          </div>
        </section>

        <section className="trust-section section-wrap" id="trust">
          <div className="trust-card privacy-card">
            <p className="eyebrow">Privacy by default</p>
            <h2>Your library stays yours.</h2>
            <p>Files, paths, preferences, history, and extensions remain on your computer. Metadata requests contain only what the selected provider needs. There are no adverts, behavioural analytics, or telemetry.</p>
            <div className="privacy-points"><span>No account</span><span>No tracking</span><span>Local-first storage</span></div>
          </div>
          <div className="trust-card signing-card">
            <span className="signpath-wordmark">SIGNPATH <i>FOUNDATION</i></span>
            <h2>Transparent releases.</h2>
            <p>Media Renamer is applying for free Windows code signing through SignPath Foundation. Current downloads remain unsigned while approval is pending, and every release includes checksums and GitHub build provenance.</p>
            <p className="signpath-disclosure">Once approved: Free code signing provided by SignPath.io, certificate by SignPath Foundation.</p>
            <a href={`${REPOSITORY}/blob/main/docs/code-signing-policy.md`}>Read the code-signing policy <ArrowIcon /></a>
          </div>
        </section>

        <section className="final-cta section-wrap">
          <img src={`${import.meta.env.BASE_URL}media-renamer-icon.png`} alt="" />
          <div><p className="eyebrow">Free forever</p><h2>Spend less time fixing filenames.</h2><p>Preview the plan, make the call, and let Media Renamer handle the repetitive part.</p></div>
          <a className="button primary" href="#downloads"><DownloadIcon /> Get Media Renamer</a>
        </section>
      </main>

      <footer>
        <div className="section-wrap footer-inner">
          <div><strong>Media Renamer</strong><p>Built by Rob. Free, open source, and focused.</p></div>
          <div className="footer-links"><a href={REPOSITORY}>GitHub</a><a href={`${REPOSITORY}/blob/main/LICENSE`}>MIT License</a><a href={`${REPOSITORY}/blob/main/SECURITY.md`}>Security</a><a href={`${REPOSITORY}/releases`}>All releases</a></div>
          <p className="provider-note">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
        </div>
      </footer>
    </div>
  )
}

export default App
