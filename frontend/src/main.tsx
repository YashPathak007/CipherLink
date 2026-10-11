import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Check,
  ClipboardList,
  Clock3,
  Copy,
  Database,
  Download,
  FileLock2,
  FileCheck2,
  Link2,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  Upload,
  WifiOff,
  X,
} from 'lucide-react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

type User = { id: number; email: string; display_name: string };
type FileItem = {
  id: string;
  original_filename: string;
  content_type: string;
  original_size: number;
  encrypted_size: number;
  checksum: string;
  created_at: string;
  updated_at: string;
};
type Share = {
  id: string;
  file_id: string;
  expires_at: string;
  max_downloads: number | null;
  download_count: number;
  revoked_at?: string | null;
  created_at: string;
  last_used_at?: string | null;
};
type CreatedShare = Share & { token: string };
type SharedFile = {
  filename: string;
  content_type: string;
  original_size: number;
  expires_at: string;
  remaining_downloads: number | null;
};
type View = 'files' | 'audit' | 'security';

class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

async function responseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string' && body.error) return body.error;
  } catch {
    // Fall through to a status-based message when the server did not return JSON.
  }
  return `Request failed (${response.status})`;
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API}${path}`, { ...options, headers });
  } catch {
    throw new Error('CipherLink API is unreachable. Check that the service is running and try again.');
  }

  if (!response.ok) throw new ApiRequestError(await responseError(response), response.status);
  if (response.status === 204) return null as T;

  const text = await response.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('The API returned an unreadable response.');
  }
}

function uploadWithProgress(file: File, onProgress: (value: number) => void): Promise<FileItem> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${API}/files`);
    const token = localStorage.getItem('token');
    if (token) request.setRequestHeader('Authorization', `Bearer ${token}`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error('CipherLink API is unreachable. Check that the service is running and try again.'));
    request.onload = () => {
      let body: { error?: unknown } & Partial<FileItem> = {};
      try { body = JSON.parse(request.responseText || '{}') as typeof body; } catch { /* handled below */ }
      if (request.status >= 200 && request.status < 300 && body.id) {
        onProgress(100);
        resolve(body as FileItem);
        return;
      }
      reject(new ApiRequestError(typeof body.error === 'string' ? body.error : `Request failed (${request.status})`, request.status));
    };
    const form = new FormData();
    form.append('file', file);
    request.send(form);
  });
}

async function saveDownload(response: Response, filename: string) {
  if (!response.ok) throw new ApiRequestError(await responseError(response), response.status);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Copy is unavailable in this browser.');
}

function readStoredUser(): User | null {
  const value = localStorage.getItem('user');
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<User>;
    if (
      typeof parsed.id === 'number' &&
      typeof parsed.email === 'string' &&
      typeof parsed.display_name === 'string'
    ) {
      return parsed as User;
    }
  } catch {
    // A damaged local session should return the user to the sign-in screen.
  }
  localStorage.removeItem('user');
  return null;
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function messageFor(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function Login({ register, onAuth }: { register: boolean; onAuth: (user: User) => void }) {
  const [email, setEmail] = useState('demo@cipherlink.local');
  const [password, setPassword] = useState('DemoPass123!');
  const [name, setName] = useState('Demo User');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api<{ token: string; user: User }>(register ? '/auth/register' : '/auth/login', {
        method: 'POST',
        body: JSON.stringify(register ? { email, password, displayName: name } : { email, password }),
      });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onAuth(data.user);
    } catch (requestError) {
      setError(messageFor(requestError, 'Unable to sign in.'));
    } finally {
      setBusy(false);
    }
  }

  function toggleMode() {
    window.location.hash = register ? '' : 'register';
    window.location.reload();
  }

  return (
    <main className="auth">
      <div className="auth-layout">
        <section className="auth-promise">
          <div className="auth-brand"><Shield size={21} /> CIPHER<span>LINK</span></div>
          <div className="promise-kicker"><ShieldCheck size={15} /> A calmer way to send sensitive files</div>
          <h1>Private files.<br /><em>Clear control.</em></h1>
          <p>Upload once, review the details, then share a link that expires when you decide. CipherLink keeps the exchange understandable from start to finish.</p>
          <div className="promise-list">
            <span><CheckCircle2 size={16} /> Encrypted before private storage</span>
            <span><CheckCircle2 size={16} /> Download limits you can see</span>
            <span><CheckCircle2 size={16} /> Revoke access whenever you need</span>
          </div>
        </section>
        <div className="auth-card">
        <div className="eyebrow">YOUR PRIVATE WORKSPACE</div>
        <h2>{register ? 'Create your vault' : 'Welcome back'}</h2>
        <p className="muted">{register ? 'A simple home for files you are ready to share.' : 'Pick up where you left off with your encrypted files.'}</p>
        <form onSubmit={submit}>
          {register && (
            <label>
              Display name
              <input
                value={name}
                maxLength={80}
                autoComplete="name"
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              minLength={10}
              maxLength={256}
              autoComplete={register ? 'new-password' : 'current-password'}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && (
            <div className="error" role="alert">
              <AlertTriangle size={15} /> {error}
            </div>
          )}
          <button className="primary" type="submit" disabled={busy}>
            {busy && <LoaderCircle size={16} className="spin" />}
            {register ? 'Create account' : 'Unlock vault'}
          </button>
        </form>
        <button className="link" type="button" onClick={toggleMode}>
          {register ? 'Already have an account? Sign in' : 'Need an account? Register'}
        </button>
        {!register && <p className="demo">Demo: demo@cipherlink.local / DemoPass123!</p>}
        <p className="auth-note">
          <LockKeyhole size={14} /> Files are encrypted before they enter private storage. Metadata remains visible to the service.
        </p>
      </div>
      </div>
    </main>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(() => readStoredUser());
  const [view, setView] = useState<View>('files');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selected, setSelected] = useState<FileItem | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [connection, setConnection] = useState<'checking' | 'online' | 'offline'>('checking');
  const isShared = window.location.pathname.startsWith('/shared/');
  const register = window.location.hash === '#register';

  function logout() {
    clearSession();
    setFiles([]);
    setSelected(null);
    setUser(null);
  }

  async function loadFiles() {
    setLoading(true);
    try {
      const data = await api<{ items: FileItem[] }>('/files');
      setFiles(Array.isArray(data.items) ? data.items : []);
      setConnection('online');
      setError('');
    } catch (requestError) {
      setConnection('offline');
      if (requestError instanceof ApiRequestError && requestError.status === 401) {
        logout();
        setError('Your session expired. Sign in again to continue.');
      } else {
        setError(messageFor(requestError, 'Unable to load your encrypted files.'));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user && !isShared) void loadFiles();
  }, [user, isShared]);

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadProgress(0);
    setError('');
    setNotice('');
    try {
      await uploadWithProgress(file, setUploadProgress);
      await loadFiles();
      setNotice(`${file.name} is encrypted and ready to share.`);
    } catch (requestError) {
      setError(messageFor(requestError, 'Upload could not be completed.'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void uploadFile(file);
  }

  if (isShared) return <SharedPage token={window.location.pathname.split('/')[2] || ''} />;
  if (!user) return <Login register={register} onAuth={setUser} />;

  const connectionLabel = connection === 'online' ? 'Connected' : connection === 'offline' ? 'Offline' : 'Checking connection';

  return (
    <div className="shell">
      <aside aria-label="CipherLink navigation">
        <div className="logo">
          <Shield size={20} /> CIPHER<span>LINK</span>
        </div>
        <div className="workspace-label">
          <span className="workspace-dot" /> PRIVATE WORKSPACE
        </div>
        <p className="side-copy">A clear, controlled place to exchange files.</p>
        <nav>
          <button className={view === 'files' ? 'active' : ''} type="button" onClick={() => { setView('files'); setSelected(null); }}>
            <FileLock2 size={16} /> <span className="nav-label">My files</span>
          </button>
          <button className={view === 'audit' ? 'active' : ''} type="button" onClick={() => { setView('audit'); setSelected(null); }}>
            <ClipboardList size={16} /> <span className="nav-label">Audit trail</span>
          </button>
          <button className={view === 'security' ? 'active' : ''} type="button" onClick={() => { setView('security'); setSelected(null); }}>
            <Shield size={16} /> <span className="nav-label">Security</span>
          </button>
        </nav>
        <div className="profile">
          <div className="profile-label"><span className="avatar">{user.display_name.slice(0, 1).toUpperCase()}</span><span>Signed in as</span></div>
          <strong>{user.display_name}</strong>
          <small>{user.email}</small>
          <button type="button" onClick={logout}>
            <LogOut size={15} /> <span className="nav-label">Sign out</span>
          </button>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <div className="eyebrow">{view === 'files' ? 'PRIVATE WORKSPACE' : `CIPHERLINK / ${view.toUpperCase()}`}</div>
            <h1>{view === 'files' ? 'Ready when you are.' : view === 'audit' ? 'Know what happened.' : 'Understand your protection.'}</h1>
            {view === 'files' && <p className="header-subtitle">Upload a file, review its limits, and share with confidence.</p>}
          </div>
          <div className="header-actions">
            <span className={`live ${connection}`}><i /> {connectionLabel}</span>
            {view === 'files' && (
              <label className={`upload ${uploading ? 'is-busy' : ''}`}>
                {uploading ? <LoaderCircle size={16} className="spin" /> : <Upload size={16} />}
                <span>{uploading ? `Uploading ${uploadProgress}%` : 'Upload a file'}</span>
                <input type="file" onChange={chooseFile} accept=".txt,.pdf,.png,.jpg,.jpeg,.json,.csv,.zip" disabled={uploading} />
              </label>
            )}
          </div>
        </header>
        {error && (
          <div className="error banner" role="alert">
            <span><AlertTriangle size={15} /> {error}</span>
            <button type="button" aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button>
          </div>
        )}
        {notice && (
          <div className="notice banner" role="status">
            <span><CheckCircle2 size={15} /> {notice}</span>
            <button type="button" aria-label="Dismiss confirmation" onClick={() => setNotice('')}><X size={15} /></button>
          </div>
        )}
        {view === 'files' ? (
          <Vault files={files} loading={loading} uploading={uploading} uploadProgress={uploadProgress} onSelect={setSelected} onUpload={uploadFile} />
        ) : view === 'audit' ? <Audit /> : <Security />}
        {selected && <FileDetails file={selected} onClose={() => setSelected(null)} onReload={loadFiles} />}
      </main>
    </div>
  );
}

function Vault({
  files,
  loading,
  uploading,
  uploadProgress,
  onSelect,
  onUpload,
}: {
  files: FileItem[];
  loading: boolean;
  uploading: boolean;
  uploadProgress: number;
  onSelect: (file: FileItem) => void;
  onUpload: (file: File) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const total = files.reduce((sum, file) => sum + file.encrypted_size, 0);
  const matchingFiles = files.filter((file) => file.original_filename.toLowerCase().includes(query.trim().toLowerCase()));

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void onUpload(file);
  }

  return (
    <>
      <section className="journey" aria-label="Sharing journey">
        <div className="journey-heading"><span className="eyebrow">THE CIPHERLINK FLOW</span><strong>{files.length ? 'Your next move' : 'Three calm steps to a secure share'}</strong></div>
        <div className="journey-steps">
          <div className={`journey-step ${files.length ? 'done' : 'current'}`}><span>{files.length ? <Check size={14} /> : '1'}</span><div><strong>Upload</strong><small>Encrypt a file</small></div></div>
          <ArrowRight className="journey-arrow" size={16} />
          <div className={`journey-step ${files.length ? 'current' : ''}`}><span>{files.length ? <Check size={14} /> : '2'}</span><div><strong>Review</strong><small>Check what is shared</small></div></div>
          <ArrowRight className="journey-arrow" size={16} />
          <div className="journey-step"><span>3</span><div><strong>Share</strong><small>Copy or revoke a link</small></div></div>
        </div>
      </section>
      <section className="stats" aria-label="Vault summary">
        <div><FileLock2 /><span>Files in your vault</span><strong>{files.length}</strong><small>Only your account can open them</small></div>
        <div><Database /><span>Encrypted storage</span><strong>{formatSize(total)}</strong><small>Encrypted bytes at rest</small></div>
        <div><ShieldCheck /><span>Protection boundary</span><strong>AES-256-GCM</strong><small>Server can decrypt to deliver downloads</small></div>
      </section>
      <section className="panel">
        <div className="panel-title vault-heading">
          <div>
            <div className="eyebrow">PRIVATE INVENTORY</div>
            <h2>File vault</h2>
             <p>Keep files private until you choose an expiration and download limit.</p>
          </div>
          <label className={`secondary ${uploading ? 'is-busy' : ''}`}>
            {uploading ? <LoaderCircle size={15} className="spin" /> : <Upload size={15} />}
            <span>{uploading ? 'Encrypting…' : 'Add file'}</span>
            <input type="file" onChange={chooseFile} accept=".txt,.pdf,.png,.jpg,.jpeg,.json,.csv,.zip" disabled={uploading} />
          </label>
        </div>
        {uploading && (
          <div className="upload-progress" role="status" aria-live="polite">
            <div className="upload-progress-copy"><span><LoaderCircle size={15} className="spin" /> Securing your file</span><strong>{uploadProgress}%</strong></div>
            <div className="progress-track"><span style={{ width: `${Math.max(uploadProgress, 3)}%` }} /></div>
            <small>Upload, encryption, and integrity checks happen before this file appears in your vault.</small>
          </div>
        )}
        {files.length > 0 && (
          <div className="vault-toolbar">
            <label className="search-control">
              <Search size={15} />
              <span className="sr-only">Search encrypted files</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by filename" />
            </label>
            <span className="toolbar-count">{matchingFiles.length} of {files.length} files</span>
          </div>
        )}
        <div className="file-list" aria-live="polite">
          {loading && <div className="loading-state"><LoaderCircle size={20} className="spin" /> Loading encrypted inventory…</div>}
          {!loading && !files.length && (
            <div className="empty">
              <div className="empty-mark"><Upload size={26} /></div>
              <strong>Your private workspace starts here</strong>
              <span>Choose a file and CipherLink will encrypt it before it reaches private storage. You will review the share rules before any link is created.</span>
              <label className="secondary empty-action">
                <Upload size={15} /> Choose your first file
                <input type="file" onChange={chooseFile} accept=".txt,.pdf,.png,.jpg,.jpeg,.json,.csv,.zip" disabled={uploading} />
              </label>
              <small className="empty-limit">Accepted: TXT, PDF, PNG, JPG, JSON, CSV, ZIP · Size limit is enforced by the server.</small>
            </div>
          )}
          {!loading && files.length > 0 && !matchingFiles.length && (
            <div className="empty compact"><Search size={25} /><strong>No matching files</strong><span>Try a different filename.</span></div>
          )}
          {!loading && matchingFiles.map((file) => (
            <button className="file-row" type="button" key={file.id} onClick={() => onSelect(file)} aria-label={`Inspect ${file.original_filename}`}>
              <div className="file-icon"><FileLock2 size={18} /></div>
              <div className="file-info">
                <strong>{file.original_filename}</strong>
                <small>{file.content_type} · {formatSize(file.original_size)} · SHA-256 {file.checksum.slice(0, 12)}…</small>
              </div>
              <time dateTime={file.created_at}>{new Date(file.created_at).toLocaleDateString()}</time>
              <span className="file-action">Inspect <span aria-hidden="true">→</span></span>
            </button>
          ))}
        </div>
      </section>
      <p className="footnote">Bytes are encrypted before they reach the private storage volume. PostgreSQL stores metadata and wrapped key material.</p>
    </>
  );
}

function FileDetails({ file, onClose, onReload }: { file: FileItem; onClose: () => void; onReload: () => Promise<void> }) {
  const [shares, setShares] = useState<Share[]>([]);
  const [name, setName] = useState(file.original_filename);
  const [hours, setHours] = useState('24');
  const [limit, setLimit] = useState('5');
  const [created, setCreated] = useState<CreatedShare | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copyState, setCopyState] = useState('Copy link');
  const [busy, setBusy] = useState('');
  const [loadingShares, setLoadingShares] = useState(true);

  useEffect(() => {
    setName(file.original_filename);
    setShares([]);
    setCreated(null);
    setNotice('');
    setError('');
    setBusy('');
    setCopyState('Copy link');
  }, [file.id, file.original_filename]);

  useEffect(() => {
    let cancelled = false;
    setLoadingShares(true);
    api<{ items: Share[] }>(`/files/${file.id}/shares`)
      .then((data) => { if (!cancelled) setShares(data.items); })
      .catch((requestError) => { if (!cancelled) setError(messageFor(requestError, 'Unable to load share history.')); })
      .finally(() => { if (!cancelled) setLoadingShares(false); });
    return () => { cancelled = true; };
  }, [file.id]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  async function download() {
    setBusy('download');
    setError('');
    setNotice('');
    try {
      const response = await fetch(`${API}/files/${file.id}/download`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      await saveDownload(response, file.original_filename);
      setNotice('Integrity verified. Download started.');
    } catch (requestError) {
      setError(messageFor(requestError, 'Download failed.'));
    } finally {
      setBusy('');
    }
  }

  async function rename() {
    if (!name.trim()) {
      setError('Enter a filename before saving.');
      return;
    }
    setBusy('rename');
    setError('');
    try {
      await api<FileItem>(`/files/${file.id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
      await onReload();
      onClose();
    } catch (requestError) {
      setError(messageFor(requestError, 'Rename failed.'));
    } finally {
      setBusy('');
    }
  }

  async function remove() {
    if (!window.confirm('Delete this encrypted file and all shares?')) return;
    setBusy('delete');
    setError('');
    try {
      await api<null>(`/files/${file.id}`, { method: 'DELETE' });
      await onReload();
      onClose();
    } catch (requestError) {
      setError(messageFor(requestError, 'Delete failed.'));
    } finally {
      setBusy('');
    }
  }

  async function create() {
    const hoursValue = Number(hours);
    const limitValue = limit.trim() ? Number(limit) : null;
    if (!Number.isFinite(hoursValue) || hoursValue < 1 || hoursValue > 8760) {
      setError('Expiration must be between 1 hour and 1 year.');
      return;
    }
    if (limitValue !== null && (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 1000)) {
      setError('Download limit must be between 1 and 1,000, or left blank for unlimited.');
      return;
    }
    setBusy('create');
    setError('');
    setNotice('');
    try {
      const data = await api<CreatedShare>(`/files/${file.id}/shares`, {
        method: 'POST',
        body: JSON.stringify({ expiresAt: new Date(Date.now() + hoursValue * 3600000).toISOString(), maxDownloads: limitValue }),
      });
      setCreated(data);
      setShares((current) => [data, ...current]);
      setNotice('Share link created. Copy it now; the raw token is only shown once.');
    } catch (requestError) {
      setError(messageFor(requestError, 'Share link could not be created.'));
    } finally {
      setBusy('');
    }
  }

  async function revoke(id: string) {
    setBusy(`revoke:${id}`);
    setError('');
    try {
      await api<null>(`/shares/${id}`, { method: 'DELETE' });
      setShares((current) => current.map((share) => share.id === id ? { ...share, revoked_at: new Date().toISOString() } : share));
      setNotice('Share revoked. The link can no longer be opened.');
    } catch (requestError) {
      setError(messageFor(requestError, 'Share could not be revoked.'));
    } finally {
      setBusy('');
    }
  }

  async function copyCreatedLink() {
    if (!created) return;
    try {
      await copyText(`${window.location.origin}/shared/${created.token}`);
      setCopyState('Copied');
      window.setTimeout(() => setCopyState('Copy link'), 1800);
    } catch (requestError) {
      setError(messageFor(requestError, 'Copy is unavailable. Select the link and copy it manually.'));
    }
  }

  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="dialog detail-dialog" role="dialog" aria-modal="true" aria-labelledby="file-details-title">
        <button className="close" type="button" aria-label="Close file details" onClick={onClose}><X size={18} /></button>
         <div className="dialog-icon"><FileLock2 size={21} /></div>
         <h2 id="file-details-title">{file.original_filename}</h2>
         <p className="muted">{file.content_type} · {formatSize(file.original_size)} · added {new Date(file.created_at).toLocaleDateString()}</p>
        {error && <div className="error" role="alert"><AlertTriangle size={15} /> {error}</div>}
        {notice && <div className="notice" role="status"><CheckCircle2 size={15} /> {notice}</div>}
         <div className="integrity-note"><FileCheck2 size={16} /><span><strong>Integrity verified on download</strong><small>SHA-256 is checked before CipherLink sends a file.</small></span></div>
         <div className="detail-block"><span>ENCRYPTED RECORD</span><code>SHA-256 {file.checksum}</code><small className="detail-hint">Original {formatSize(file.original_size)} · stored encrypted {formatSize(file.encrypted_size)}</small></div>
        <div className="detail-block">
          <span>RENAME FILE</span>
          <div className="inline">
            <input value={name} onChange={(event) => setName(event.target.value)} aria-label="Filename" />
            <button className="secondary" type="button" onClick={() => void rename()} disabled={Boolean(busy)}>{busy === 'rename' && <LoaderCircle size={14} className="spin" />} Save</button>
          </div>
        </div>
        <div className="detail-actions">
          <button className="primary" type="button" onClick={() => void download()} disabled={Boolean(busy)}>
            {busy === 'download' ? <LoaderCircle size={16} className="spin" /> : <Download size={16} />} Download and verify
          </button>
          <button className="danger" type="button" onClick={() => void remove()} disabled={Boolean(busy)}>
            {busy === 'delete' ? <LoaderCircle size={16} className="spin" /> : <Trash2 size={16} />} Delete file
          </button>
        </div>
         <div className="share-create">
           <div className="share-heading"><div><span className="eyebrow">NEXT: CONTROLLED ACCESS</span><h3>Create a share link</h3></div><span className="share-step">1 / 3</span></div>
           <p className="share-help">Set exactly how long this link works and how many downloads it allows. Leave downloads blank for unlimited.</p>
           <div className="inline share-fields">
             <label>Expires in (hours)<input type="number" min="1" max="8760" value={hours} onChange={(event) => setHours(event.target.value)} /></label>
             <label>Download limit<input type="number" min="1" max="1000" placeholder="Unlimited" value={limit} onChange={(event) => setLimit(event.target.value)} /></label>
             <button className="primary create-link-button" type="button" onClick={() => void create()} disabled={Boolean(busy)}>{busy === 'create' ? <LoaderCircle size={15} className="spin" /> : <Link2 size={15} />} Create secure link</button>
           </div>
         </div>
        {created && (
          <div className="created-share">
             <strong><CheckCircle2 size={15} /> Link created — ready to share</strong>
             <span className="share-step-label">2 / 3 · Copy this link now. The raw token is only shown once.</span>
             <div className="created-link">{window.location.origin}/shared/{created.token}<button type="button" onClick={() => void copyCreatedLink()}><Copy size={14} /> {copyState}</button></div>
             <small>Anyone with this link can download the decrypted file until it expires or reaches its limit. You can revoke it below.</small>
          </div>
        )}
        <div className="share-list">
           <div className="share-list-heading"><div><span className="eyebrow">3 / 3 · CONTROL</span><h3>Share history</h3></div>{loadingShares && <LoaderCircle size={14} className="spin muted-icon" />}</div>
          {!loadingShares && shares.map((share) => {
            const expired = new Date(share.expires_at) <= new Date();
            const revoked = Boolean(share.revoked_at);
            const status = revoked ? 'Revoked' : expired ? 'Expired' : 'Active';
            const remaining = share.max_downloads === null ? 'Unlimited' : `${Math.max(share.max_downloads - share.download_count, 0)} left`;
            return (
              <div className="share-row" key={share.id}>
                <div className="share-meta">
                  <span className={`status-chip ${status.toLowerCase()}`}>{status}</span>
                  <span>Expires {new Date(share.expires_at).toLocaleString()} · {remaining}</span>
                </div>
                {status === 'Active' && <button className="danger small" type="button" onClick={() => void revoke(share.id)} disabled={Boolean(busy)}>{busy === `revoke:${share.id}` && <LoaderCircle size={12} className="spin" />} Revoke</button>}
              </div>
            );
          })}
           {!loadingShares && !shares.length && <p className="muted">No links yet. Create one above when you are ready to share.</p>}
        </div>
      </div>
    </div>
  );
}

function Audit() {
  const [logs, setLogs] = useState<Array<{ id: number; action: string; resource_type: string; resource_id?: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api<{ items: typeof logs }>('/audit');
      setLogs(data.items);
    } catch (requestError) {
      setError(messageFor(requestError, 'Unable to load audit activity.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <section className="panel audit-panel">
      <div className="panel-title">
         <div><div className="eyebrow">YOUR ACCOUNT HISTORY</div><h2>Recent security activity</h2><p>Every login, upload, download, share, and revoke recorded by the backend.</p></div>
        <button className="icon-button" type="button" onClick={() => void load()} aria-label="Refresh audit trail" disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} /></button>
      </div>
      {error && <div className="error" role="alert"><AlertTriangle size={15} /> {error}</div>}
      {loading && <div className="loading-state"><LoaderCircle size={20} className="spin" /> Loading audit activity…</div>}
      {!loading && !error && logs.map((log) => (
        <div className="audit-row" key={log.id}><span className="audit-dot" /><div><strong>{log.action.replace(/_/g, ' ')}</strong><small>{log.resource_type} {log.resource_id || ''}</small></div><time dateTime={log.created_at}>{new Date(log.created_at).toLocaleString()}</time></div>
      ))}
      {!loading && !error && !logs.length && <div className="empty compact"><ClipboardList size={25} /><strong>No audit records yet</strong><span>Security activity will appear here after your first action.</span></div>}
    </section>
  );
}

function Security() {
  return (
    <section className="security-grid">
      <div className="security-intro"><div className="eyebrow">HONEST PROTECTION NOTES</div><h2>Security you can explain</h2><p>CipherLink makes the important boundaries visible, so you know what is protected and what is still trusted to the service.</p></div>
      <div className="panel security-card"><LockKeyhole className="security-icon" /><div className="eyebrow">BEFORE STORAGE</div><h2>Encrypted at rest</h2><p>Each upload gets a random 32-byte key and is sealed with AES-256-GCM before private storage. The key is wrapped by the server master key.</p><div className="security-fact"><strong>AES-256-GCM</strong><span>Per-file encryption</span></div></div>
      <div className="panel security-card"><Link2 className="security-icon" /><div className="eyebrow">WHEN YOU SHARE</div><h2>Limits are enforced</h2><p>Links use random tokens. Each open checks expiry, revocation, and the download count on the server before delivery.</p><div className="security-fact"><strong>1 hour–1 year</strong><span>Expiry window · 1–1,000 downloads</span></div></div>
      <div className="panel security-card"><ClipboardList className="security-icon" /><div className="eyebrow">AFTER AN ACTION</div><h2>History stays visible</h2><p>Login, upload, download, share, revoke, rename, and deletion events are recorded without file contents or raw share tokens.</p><div className="security-fact"><strong>Audit trail</strong><span>Account activity, not file contents</span></div></div>
      <div className="panel security-callout"><ShieldCheck size={18} /><div><strong>One important boundary</strong><span>The server can decrypt a file to deliver a download. CipherLink protects private storage and deliberate sharing; it is not end-to-end encryption against a compromised server.</span></div></div>
    </section>
  );
}

function SharedPage({ token }: { token: string }) {
  const [file, setFile] = useState<SharedFile | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setError('This share link is incomplete.');
      setLoading(false);
      return () => { cancelled = true; };
    }
    api<SharedFile>(`/shared/${token}`)
      .then((data) => { if (!cancelled) setFile(data); })
      .catch((requestError) => { if (!cancelled) setError(messageFor(requestError, 'This share link is unavailable.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  async function download() {
    if (!file) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`${API}/shared/${token}/download`);
      await saveDownload(response, file.filename);
      setNotice('Download started. The link limit was updated securely.');
    } catch (requestError) {
      setError(messageFor(requestError, 'Download failed. The link may have expired or been revoked.'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main className="auth"><div className="auth-card shared-card loading-share"><LoaderCircle size={24} className="spin" /><div className="eyebrow">CIPHERLINK SECURE SHARE</div><h1>Checking this link…</h1><p className="muted">Verifying expiry, revocation, and remaining downloads before we show the file.</p></div></main>;
  }
  if (error || !file) {
    return <main className="auth"><div className="auth-card shared-card"><div className="dialog-icon warning"><X size={21} /></div><div className="eyebrow">SECURE SHARE</div><h1>Link unavailable</h1><p className="muted">{error || 'This share link cannot be opened.'}</p><a className="secondary back-link" href="/">Open CipherLink</a></div></main>;
  }

  return (
    <main className="auth">
      <div className="auth-brand"><Shield size={21} /> CIPHER<span>LINK</span></div>
      <div className="auth-card shared-card">
        <div className="dialog-icon"><FileLock2 size={21} /></div>
        <div className="eyebrow">SECURE SHARED FILE</div>
        <h1>{file.filename}</h1>
        <p className="shared-intro">Someone shared this file with you through CipherLink. Download it only if you recognize the sender.</p>
        <p className="muted">{file.content_type} · {formatSize(file.original_size)}</p>
        <div className="shared-facts"><span><Clock3 size={14} /> Expires {new Date(file.expires_at).toLocaleString()}</span><span><Link2 size={14} /> {file.remaining_downloads === null ? 'Unlimited downloads' : `${file.remaining_downloads} download${file.remaining_downloads === 1 ? '' : 's'} remaining`}</span></div>
        {notice && <div className="notice" role="status"><CheckCircle2 size={15} /> {notice}</div>}
        {error && <div className="error" role="alert"><AlertTriangle size={15} /> {error}</div>}
         <button className="primary" type="button" onClick={() => void download()} disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : <Download size={16} />} Download file securely</button>
         <p className="shared-note"><LockKeyhole size={13} /> The server verifies the encrypted file before sending it. This link will count against the limit after a successful delivery.</p>
      </div>
    </main>
  );
}

function formatSize(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1073741824) return `${(value / 1048576).toFixed(1)} MB`;
  return `${(value / 1073741824).toFixed(1)} GB`;
}

createRoot(document.getElementById('root')!).render(<App />);
