import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CatalogResult, CheckedProduct } from '../shared/catalog';
import { api, type InputFormat, type Job, type Mandate, type SystemStatus } from './api';
import { Icon } from './icons';

type Filter = 'all' | 'needs_source' | 'ready';
type DetailTab = 'changes' | 'source' | 'checks';
type ModalKind = 'input' | 'mandate' | 'download' | null;
const fieldNames: Record<string, string> = {
  title: 'Title', description: 'Description', price: 'Price', priceMinor: 'Price', currency: 'Currency',
  manufacturer: 'Manufacturer', safety: 'Safety information', certification: 'Certification', sourceUrl: 'Source reference', sku: 'SKU', sourceText: 'Source text',
};
const terminal = new Set(['blocked', 'complete', 'failed', 'receipt_unresolved']);
const labels: Record<string, string> = {
  blocked: 'Payment unavailable', quoted: 'Quote checked', payment_pending: 'Payment pending',
  processing: 'Checking catalog', complete: 'Result delivered', failed: 'Job stopped', receipt_unresolved: 'Receipt unresolved',
};

function money(minor: number | null, currency: string) {
  if (minor === null || !Number.isFinite(minor)) return '—';
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(minor / 100); }
  catch { return `${(minor / 100).toFixed(2)} ${currency}`; }
}
function ada(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return 'Not confirmed';
  const amount = Number(value);
  return Number.isFinite(amount) ? `${(amount / 1_000_000).toFixed(2)} tADA` : 'Not confirmed';
}
function exactAda(value: string | null | undefined) {
  if (!value || !/^\d+$/.test(value)) return 'Not confirmed';
  const amount = BigInt(value);
  return `${amount / 1_000_000n}.${(amount % 1_000_000n).toString().padStart(6, '0')} tADA`;
}
function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not supplied';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
function safeUrl(value?: string) {
  if (!value) return undefined;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined; }
  catch { return undefined; }
}
function sourceLabel(value: string) {
  try { return new URL(value).hostname; } catch { return value || 'No source reference'; }
}
function time(value: string) { return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
function saveFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}
function csv(result: CatalogResult, readyOnly: boolean) {
  const fields = ['sku', 'title', 'description', 'price', 'currency', 'manufacturer', 'safety', 'certification', 'sourceUrl', 'status'];
  const escape = (value: unknown) => {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const rows = result.products.filter(p => !readyOnly || p.status === 'ready').map(p => {
    const value = { ...p, price: p.priceMinor === null ? '' : (p.priceMinor / 100).toFixed(2) };
    return fields.map(field => escape(value[field as keyof typeof value])).join(',');
  });
  return [fields.join(','), ...rows].join('\r\n');
}
function Status({ status }: { status: CheckedProduct['status'] }) {
  return <span className={`row-status ${status}`}>{status === 'ready' ? <Icon name="check" /> : <span className="status-mark" />}{status === 'ready' ? 'Ready' : status === 'needs_source' ? 'Needs source' : 'Review'}</span>;
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button, input, textarea, select, a')?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key === 'Tab') {
        const controls = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select, a[href]') || [])];
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', listener);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', listener); document.body.style.overflow = ''; before?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={ref}>
      <div className="modal-heading"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></div>
      {children}
    </div>
  </div>;
}

export default function App() {
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [systemError, setSystemError] = useState('');
  const [input, setInput] = useState('');
  const [inputDraft, setInputDraft] = useState('');
  const [format, setFormat] = useState<InputFormat>('json');
  const [draftFormat, setDraftFormat] = useState<InputFormat>('json');
  const [result, setResult] = useState<CatalogResult | null>(null);
  const [sample, setSample] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [selectedSku, setSelectedSku] = useState('');
  const [detailTab, setDetailTab] = useState<DetailTab>('changes');
  const [mobileDetail, setMobileDetail] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [starting, setStarting] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [serviceCap, setServiceCap] = useState('2000000');
  const [feeCap, setFeeCap] = useState('500000');
  const [downloadReadyOnly, setDownloadReadyOnly] = useState(true);

  async function refreshSystem() {
    try { setSystem(await api.status()); setSystemError(''); }
    catch (e) { setSystemError((e as Error).message); }
  }
  async function review(value: string, valueFormat: InputFormat, isSample = false) {
    setLoading(true); setError(''); setErrorDetails([]);
    try {
      const response = await api.review(value, valueFormat);
      setInput(value); setInputDraft(value); setFormat(valueFormat); setDraftFormat(valueFormat);
      setResult(response.result); setSelectedSku(response.result.products[0]?.sku || '');
      let sourceIsSample = isSample;
      if (valueFormat === 'json') { try { sourceIsSample ||= Boolean(JSON.parse(value).sample); } catch { /* Already validated by server. */ } }
      setSample(sourceIsSample); setFilter('all'); setSearch(''); setJob(null); setModal(null);
      try { window.localStorage.removeItem('listing-fixer:last-job'); } catch { /* New source review is still usable without storage. */ }
    } catch (e) {
      setError((e as Error).message);
      const details = (e as Error & { details?: unknown[] }).details;
      setErrorDetails((details || []).map(item => typeof item === 'string' ? item : display(item)));
    } finally { setLoading(false); }
  }
  async function loadSample() {
    setLoading(true); setError('');
    try { const data = await api.sample(); await review(data.input, data.format, true); }
    catch (e) { setError((e as Error).message); setLoading(false); }
  }
  useEffect(() => {
    void refreshSystem();
    async function initialize() {
      let lastJob: string | null = null;
      try { lastJob = window.localStorage.getItem('listing-fixer:last-job'); } catch { /* local storage can be unavailable */ }
      if (!lastJob) { await loadSample(); return; }
      try {
        const response = await api.job(lastJob);
        const previousJob = response.job;
        if (previousJob.sourceInput && previousJob.sourceFormat) {
          setInput(previousJob.sourceInput); setInputDraft(previousJob.sourceInput);
          setFormat(previousJob.sourceFormat); setDraftFormat(previousJob.sourceFormat);
          const reviewed = await api.review(previousJob.sourceInput, previousJob.sourceFormat);
          const shownResult = previousJob.result || reviewed.result;
          setResult(shownResult);
          setSelectedSku(shownResult.products[0]?.sku || '');
          try { setSample(Boolean(JSON.parse(previousJob.sourceInput).sample)); } catch { setSample(false); }
        } else if (previousJob.result) {
          setResult(previousJob.result);
          setSelectedSku(previousJob.result.products[0]?.sku || '');
        } else {
          setResult(null); setInput(''); setInputDraft('');
        }
        setJob(previousJob);
        setLoading(false);
      } catch {
        try { window.localStorage.removeItem('listing-fixer:last-job'); } catch { /* Stale local pointer is harmless. */ }
        await loadSample();
      }
    }
    void initialize();
  }, []);
  useEffect(() => {
    if (!job || terminal.has(job.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await api.job(job.id); setJob(response.job);
        if (response.job.result) {
          setResult(response.job.result);
          setSelectedSku(previous => response.job.result!.products.some(p => p.sku === previous) ? previous : response.job.result!.products[0]?.sku || '');
        }
      } catch (e) { setError(`Could not refresh the job. ${(e as Error).message} The existing intent is kept; no new payment was requested.`); }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status]);

  const products = result?.products || [];
  const ready = products.filter(p => p.status === 'ready').length;
  const needsSource = products.filter(p => p.status !== 'ready').length;
  const shown = useMemo(() => products.filter(p => {
    const matches = filter === 'all' || (filter === 'needs_source' ? p.status !== 'ready' : p.status === 'ready');
    return matches && `${p.sku} ${p.title}`.toLowerCase().includes(search.toLowerCase());
  }), [products, filter, search]);
  const selected = products.find(p => p.sku === selectedSku) || products[0];
  const paid = job?.status === 'complete' && job.payment?.status === 'confirmed' && job.payment.receipt?.success === true;
  const busy = Boolean(job && !terminal.has(job.status));
  const paymentUnresolved = job?.status === 'receipt_unresolved';
  const countForExport = downloadReadyOnly ? ready : products.length;
  const closeModal = () => setModal(null);

  async function startAgent() {
    if (!input || starting) return;
    setStarting(true); setError('');
    const mandate: Mandate = {
      serviceCapLovelace: serviceCap,
      feeCapLovelace: feeCap,
      totalCapLovelace: String(Number(serviceCap) + Number(feeCap)),
      maxActions: 1,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
    try {
      const response = await api.start(input, format, mandate);
      setJob(response.job); setModal(null);
      try { window.localStorage.setItem('listing-fixer:last-job', response.job.id); } catch { /* Job remains persisted on the server. */ }
      if (response.job.result) setResult(response.job.result);
      await refreshSystem();
    } catch (e) { setError((e as Error).message); setModal(null); }
    finally { setStarting(false); }
  }
  async function reconcilePayment() {
    if (!job || reconciling) return;
    setReconciling(true); setError('');
    try {
      const response = await api.reconcile(job.id); setJob(response.job);
      if (response.job.result) setResult(response.job.result);
    } catch (e) { setError(`The existing payment could not be checked. ${(e as Error).message} No replacement payment was requested.`); }
    finally { setReconciling(false); }
  }
  function selectProduct(product: CheckedProduct) {
    setSelectedSku(product.sku); setMobileDetail(true);
    setDetailTab(product.diffs.length ? 'changes' : product.issues.length ? 'checks' : 'source');
  }
  function download(kind: 'json' | 'csv' | 'report') {
    if (!result) return;
    const prefix = paid ? 'listing-fixer' : 'listing-fixer-source-review';
    if (kind === 'report') {
      saveFile(`${prefix}-report.json`, JSON.stringify({ ...result, receipt: job?.payment || null, paymentStatus: job?.status || 'unpaid', inputIsSample: sample }, null, 2), 'application/json');
    } else if (kind === 'csv') {
      saveFile(`${prefix}.csv`, csv(result, downloadReadyOnly), 'text/csv;charset=utf-8');
    } else {
      const rows = result.products.filter(p => !downloadReadyOnly || p.status === 'ready');
      saveFile(`${prefix}.json`, JSON.stringify({ schema: result.schema, language: result.language, mode: result.mode, paymentStatus: paid ? 'paid' : 'unpaid', products: rows }, null, 2), 'application/json');
    }
    setModal(null);
  }

  return <div className="app" data-ui="listing-fixer">
    <header className="app-header">
      <a className="brand" href="/" aria-label="Listing Fixer catalog workbench"><span className="brand-mark" aria-hidden="true"><span /><span /><span /></span><span>Listing Fixer</span></a>
      <span className="workspace-label">Catalog workbench</span>
      <div className="network-label"><span className="neutral-dot" />Cardano preprod<span className="test-funds"> · Test funds</span></div>
    </header>

    <main className="canvas">
      <div className="page-heading">
        <div><div className="breadcrumb"><Icon name="document" />{sample ? 'Sample supplier batch' : 'Supplier batch'}<span>/</span>English catalog</div><h1>Catalog review</h1>
          <p className="finding">{loading && !result ? 'Reading source records…' : result ? <><span className="finding-number">{needsSource}</span> {needsSource === 1 ? 'product needs' : 'products need'} a source check before import.</> : 'Bring a supplier batch. Keep the facts, fix the format.'}</p>
        </div>
        <div className="heading-actions"><button className="button secondary" disabled={busy || paymentUnresolved} title={paymentUnresolved ? 'Reconcile the existing payment first' : undefined} onClick={() => { setError(''); setErrorDetails([]); setInputDraft(input); setDraftFormat(format); setModal('input'); }}><Icon name="upload" /><span>Import source</span></button><button className="button primary" disabled={!result || loading || busy || starting || paymentUnresolved} onClick={() => setModal('mandate')}><Icon name="play" /><span>{busy ? labels[job!.status] : 'Start catalog agent'}</span></button></div>
      </div>

      <section className="agent-strip" aria-label="Catalog agent mandate">
        <div className="agent-strip-main"><Icon name="shield" /><div><strong>One batch. One bounded payment.</strong><span>{system ? `${ada(system.payment.servicePriceLovelace)} service · up to 10 products · English` : 'Up to 10 products · English'}</span></div></div>
        <button className="text-button" onClick={() => setModal('mandate')}>{system?.payment.ready ? 'Review mandate' : 'Payment setup needed'}<Icon name="chevron" /></button>
      </section>
      {systemError && <div className="inline-notice" role="status"><Icon name="alert" /><span>Payment status could not be checked. {systemError}</span><button className="text-button" onClick={() => void refreshSystem()}>Retry</button></div>}
      {error && <div className="error-notice" role="alert"><Icon name="alert" /><div><strong>{error}</strong>{errorDetails.length > 0 && <ul>{errorDetails.map((detail, i) => <li key={i}>{detail}</li>)}</ul>}</div><button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><Icon name="close" /></button></div>}

      {job && <section className={`job-panel job-${job.status}`} aria-label="Agent job status">
        <div className="job-summary"><div><span className={`job-dot ${busy ? 'is-pending' : ''}`} /><strong>{labels[job.status]}</strong><span className="mono">{job.id.slice(0, 14)}</span></div><button className="text-button" onClick={async () => { try { const response = await api.job(job.id); setJob(response.job); if (response.job.result) setResult(response.job.result); } catch (e) { setError((e as Error).message); } }}><Icon name="refresh" />Refresh job</button></div>
        {job.error && <p className="job-error" title={job.error}>{job.error}</p>}
        <div className="job-facts"><span>{job.payment?.transaction ? 'Payment transaction recorded' : 'No payment confirmed'}</span><span>{job.result ? 'Catalog result received' : 'Paid result not delivered'}</span></div>
        {job.status === 'receipt_unresolved' && <div className="reconcile-row"><p>A payment may already be on chain. Check the same signed transaction before taking another action.</p><button className="button secondary" disabled={reconciling} onClick={() => void reconcilePayment()}><Icon name="refresh" />{reconciling ? 'Checking existing payment…' : 'Check existing payment'}</button></div>}
        <details className="job-trace"><summary>Intent & receipt details</summary>{job.error && <p className="job-full-error">{job.error}</p>}<dl><div><dt>Intent</dt><dd className="mono">{job.id}</dd></div><div><dt>Input hash</dt><dd className="mono">{job.inputHash}</dd></div></dl>{job.payment && <div className="payment-receipt"><dl className="receipt-fees"><div><dt>Service price</dt><dd>{exactAda(job.payment.servicePriceLovelace)}</dd></div><div><dt>Network fee</dt><dd>{exactAda(job.payment.networkFeeLovelace)}</dd></div><div><dt>Facilitator fee</dt><dd>{job.payment.facilitatorFeeLovelace === null ? 'Not separately quoted' : exactAda(job.payment.facilitatorFeeLovelace)}</dd></div><div><dt>Seller received</dt><dd>{exactAda(job.payment.sellerNetLovelace)}</dd></div></dl>{job.payment.transaction && <div className="receipt-transaction"><span>Transaction</span><span className="mono">{job.payment.transaction}</span>{safeUrl(job.payment.explorerUrl || undefined) && <a className="text-button" href={safeUrl(job.payment.explorerUrl || undefined)} target="_blank" rel="noreferrer">View on preprod explorer<Icon name="arrow" /></a>}</div>}<p className="receipt-state">{job.payment.receipt ? `Receipt state: ${job.payment.status}` : 'No settlement receipt received.'}</p></div>}{job.events?.length > 0 && <ol className="trace-list">{job.events.map((event, i) => <li key={`${event.at}-${i}`}><time>{time(event.at)}</time><span>{event.message}</span></li>)}</ol>}</details>
      </section>}

      <div className={`workbench ${mobileDetail ? 'show-detail' : ''}`}>
        <section className="catalog-pane" aria-labelledby="products-heading">
          <div className="pane-heading"><div><h2 id="products-heading">Products<span className="count">{products.length}</span><span className="mobile-review-state">{paid ? 'Paid result' : 'Unpaid review'}</span></h2><p>{result?.mode === 'model_checked' ? 'Model drafts checked against the supplied source.' : 'Source review · no paid correction run yet'}</p></div><button className="text-button export-button" disabled={!result || loading} onClick={() => setModal('download')}><Icon name="download" />Download</button></div>
          <div className="filter-tabs" role="tablist" aria-label="Product status">
            <button role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All products <span>{products.length}</span></button>
            <button role="tab" aria-selected={filter === 'needs_source'} className={filter === 'needs_source' ? 'active' : ''} onClick={() => setFilter('needs_source')}>Needs attention <span>{needsSource}</span></button>
            <button role="tab" aria-selected={filter === 'ready'} className={filter === 'ready' ? 'active' : ''} onClick={() => setFilter('ready')}>Ready <span>{ready}</span></button>
          </div>
          <div className="table-toolbar"><label className="search"><Icon name="search" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a product or SKU" aria-label="Find a product or SKU" />{search && <button aria-label="Clear search" className="clear-search" onClick={() => setSearch('')}><Icon name="close" /></button>}</label><span>{shown.length} {shown.length === 1 ? 'product' : 'products'}</span></div>
          {loading && !result ? <div className="loading-table" aria-label="Loading source records">{Array.from({ length: 6 }, (_, i) => <div key={i}><span /><span /><span /></div>)}</div> : products.length ? <>
            <table className="product-table"><thead><tr><th>Product</th><th>Check</th><th className="num">Changes</th><th className="num">Price</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>
              {shown.map(product => <tr key={product.sku} className={selected?.sku === product.sku ? 'selected' : ''} onClick={() => selectProduct(product)}><td><button className="product-title" onClick={event => { event.stopPropagation(); selectProduct(product); }}>{product.title || 'Untitled product'}</button><span className="product-meta"><span className="mono">{product.sku}</span><span className="meta-divider">·</span>{sourceLabel(product.sourceUrl)}</span></td><td><Status status={product.status} /><span className="check-subline">{product.issues[0]?.message || 'Source fields preserved'}</span></td><td className={`num changes-number ${product.diffs.length ? 'has-changes' : ''}`}>{product.diffs.length}</td><td className="num price">{money(product.priceMinor, product.currency)}<span className="price-currency">{product.currency}</span></td><td className="row-arrow"><Icon name="chevron" /></td></tr>)}
            </tbody></table>
            <div className="product-list">{shown.map(product => <button key={product.sku} className={`product-list-row ${selected?.sku === product.sku ? 'selected' : ''}`} onClick={() => selectProduct(product)}><span className="mobile-product-main"><strong>{product.title || 'Untitled product'}</strong><span className="mobile-price">{money(product.priceMinor, product.currency)}</span></span><span className="mobile-product-meta"><span className="mono">{product.sku}</span><Status status={product.status} /><Icon name="chevron" /></span></button>)}</div>
            {!shown.length && <div className="empty-filter"><h3>No products in this view</h3><p>Try another status or a different SKU.</p><button className="text-button" onClick={() => { setFilter('all'); setSearch(''); }}>Show all products<Icon name="arrow" /></button></div>}
            <div className="table-foot"><span><span className="teal-mark" />{ready} ready · {needsSource} need attention</span><span>{result?.summary.changes || 0} source-linked changes</span></div>
          </> : <div className="empty-catalog"><Icon name="document" /><h3>A clear path from source to listing.</h3><p>Paste JSON or CSV with up to 10 supplier products. Every correction keeps its source reference.</p><button className="button primary" onClick={() => setModal('input')}>Import a source batch</button><button className="text-button" onClick={() => void loadSample()}>Use the sample supplier batch<Icon name="arrow" /></button></div>}
        </section>

        <aside className="detail-pane" aria-label="Selected product details">
          <button className="text-button back-to-list" onClick={() => setMobileDetail(false)}><Icon name="arrowLeft" />All products</button>
          {selected ? <>
            <div className="detail-heading"><div className="detail-overline"><span className="mono">{selected.sku}</span><Status status={selected.status} /></div><h2>{selected.title || 'Untitled product'}</h2><p>Every changed field points back to this source.</p></div>
            <div className="detail-tabs" role="tablist" aria-label="Product detail">
              <button role="tab" aria-selected={detailTab === 'changes'} className={detailTab === 'changes' ? 'active' : ''} onClick={() => setDetailTab('changes')}>Changes <span>{selected.diffs.length}</span></button>
              <button role="tab" aria-selected={detailTab === 'source'} className={detailTab === 'source' ? 'active' : ''} onClick={() => setDetailTab('source')}>Source</button>
              <button role="tab" aria-selected={detailTab === 'checks'} className={detailTab === 'checks' ? 'active' : ''} onClick={() => setDetailTab('checks')}>Checks <span>{selected.issues.length}</span></button>
            </div>
            <div className="detail-content">
              {detailTab === 'changes' && (selected.diffs.length ? <div className="diff-list">{selected.diffs.map((diff, i) => <section className="field-diff" key={`${diff.field}-${i}`}><h3>{fieldNames[diff.field] || diff.field}</h3><div className="diff-before"><span className="diff-symbol">−</span><span>{display(diff.before)}</span></div><div className="diff-after"><span className="diff-symbol">+</span><span>{display(diff.after)}</span></div><p className="diff-reason">{diff.reason}</p><div className="provenance"><Icon name="link" /><span>Row {diff.source.row} · {fieldNames[diff.source.field] || diff.source.field}</span>{safeUrl(diff.source.url) && <a href={safeUrl(diff.source.url)} target="_blank" rel="noreferrer" aria-label={`Open source for ${diff.field}`}>Open<Icon name="arrow" /></a>}</div></section>)}</div> : <div className="detail-empty"><Icon name="check" /><h3>No formatting changes</h3><p>The supplied fields already match this schema. Check the source gaps before importing.</p><button className="text-button" onClick={() => setDetailTab('checks')}>Review checks<Icon name="arrow" /></button></div>)}
              {detailTab === 'source' && <div className="source-detail"><div className="source-reference"><Icon name="link" />{safeUrl(selected.sourceUrl) ? <a href={safeUrl(selected.sourceUrl)} target="_blank" rel="noreferrer">{sourceLabel(selected.sourceUrl)}<Icon name="arrow" /></a> : <span>No source URL supplied</span>}</div><dl className="source-fields">{Object.entries(selected.source).filter(([key]) => key !== 'sourceUrl' && key !== 'sourceText').map(([key, value]) => <div key={key}><dt>{fieldNames[key] || key}</dt><dd className={!value ? 'missing' : ''}>{display(value)}</dd></div>)}</dl>{selected.source.sourceText && <div className="source-excerpt"><h3>Supplier text</h3><p>{selected.source.sourceText}</p></div>}<p className="source-note">Supplied references are retained. Their real-world claims are not independently verified.</p></div>}
              {detailTab === 'checks' && <div className="check-list">{selected.issues.length ? selected.issues.map((issue, i) => <section key={`${issue.code}-${i}`} className="check-item"><div><span className="status-mark" /><h3>{fieldNames[issue.field] || issue.field}</h3></div><p>{issue.message}</p><span className="check-action">Return to the source before import</span></section>) : <div className="detail-empty"><Icon name="check" /><h3>Source checks passed</h3><p>Required fields are present, price and currency are preserved, and no unsupported details were added.</p></div>}<div className="preservation-note"><Icon name="shield" /><p>Missing manufacturer, safety, certification or price information stays missing.</p></div></div>}
            </div>
            <div className="detail-footer"><span>Target schema</span><span>Listing v1 · English</span></div>
          </> : <div className="detail-empty"><Icon name="document" /><h2>Source & changes</h2><p>Select a product to see the exact fields, checks and source references.</p></div>}
        </aside>
      </div>
      <footer className="page-footer"><p>Source checks help prepare your catalog. They do not certify legal or product safety compliance.</p><span>{result ? `Reviewed ${time(result.createdAt)}` : 'No catalog reviewed'}</span></footer>
    </main>

    {modal === 'input' && <Modal title="Import source batch" onClose={closeModal} wide><div className="modal-body"><p className="modal-intro">Up to 10 products, one English catalog. Include the original fields and supplier references.</p><div className="input-heading"><label htmlFor="input-format">Source format</label><select id="input-format" value={draftFormat} onChange={event => setDraftFormat(event.target.value as InputFormat)}><option value="json">JSON</option><option value="csv">CSV</option></select><button className="text-button" onClick={async () => { try { const data = await api.sample(); setInputDraft(data.input); setDraftFormat(data.format); setError(''); setErrorDetails([]); } catch (e) { setError((e as Error).message); } }}>Load sample</button></div>{error && <div className="error-notice import-error" id="source-error" role="alert"><Icon name="alert" /><div><strong>{error}</strong>{errorDetails.length > 0 && <ul>{errorDetails.map((detail,i)=><li key={i}>{detail}</li>)}</ul>}</div></div>}<label className="sr-only" htmlFor="catalog-input">Supplier source</label><textarea id="catalog-input" className="source-input" aria-invalid={Boolean(error)} aria-describedby={error ? 'source-error' : undefined} value={inputDraft} spellCheck={false} onChange={event => { setInputDraft(event.target.value); setError(''); setErrorDetails([]); }} placeholder="Paste your supplier catalog here…" /><div className="input-help"><strong>Keep the source attached.</strong><span>Fields: SKU, title, description, price, currency, manufacturer, safety, certification, source URL and source text.</span></div></div><div className="modal-footer"><button className="button secondary" onClick={closeModal}>Cancel</button><button className="button primary" disabled={!inputDraft.trim() || loading} onClick={() => void review(inputDraft, draftFormat, false)}>{loading ? 'Reviewing…' : 'Review catalog'}<Icon name="arrow" /></button></div></Modal>}

    {modal === 'mandate' && <Modal title="Delegate this catalog batch" onClose={closeModal}><div className="modal-body"><p className="modal-intro">Authorize one agent request for a checked file, field changes and source report.</p><div className="mandate-service"><Icon name="document" /><div><strong>Listing Fixer</strong><span>{products.length} products · Listing v1 · English</span></div><span>{ada(system?.payment.servicePriceLovelace || '2000000')}</span></div><dl className="mandate-facts"><div><dt>Payer</dt><dd>Your bounded buyer agent</dd></div><div><dt>Beneficiary</dt><dd>Catalog owner: local workspace</dd></div><div><dt>Recipient</dt><dd>{system?.payment.sellerAddress ? <span className="mono address">{system.payment.sellerAddress}</span> : 'Seller wallet not configured'}</dd></div><div><dt>Network / asset</dt><dd>Cardano preprod / tADA</dd></div><div><dt>Allowed action</dt><dd>One catalog correction request</dd></div><div><dt>Delegation expires</dt><dd>15 minutes after authorization</dd></div></dl><div className="budget-fields"><label>Service cap<span className="amount-input"><input aria-label="Service cap in lovelace" type="number" min="0" max="5000000" step="100000" value={serviceCap} onChange={event => setServiceCap(event.target.value)} /><span>lovelace</span></span></label><label>Network fee cap<span className="amount-input"><input aria-label="Network fee cap in lovelace" type="number" min="0" max="1000000" step="10000" value={feeCap} onChange={event => setFeeCap(event.target.value)} /><span>lovelace</span></span></label></div><div className="budget-total"><span>Maximum total</span><strong>{ada(String(Number(serviceCap) + Number(feeCap)))}</strong></div><p className="mandate-note">The agent checks the quote, pays once and retrieves the result. Limits are enforced by this application. No automatic top-up.</p>{system?.payment.ready ? <div className="ready-notice"><Icon name="check" /><span>Payment connection is ready. The agent can act after authorization.</span></div> : <div className="setup-notice"><strong>Payment setup is incomplete</strong><ul>{(system?.payment.blockers?.length ? system.payment.blockers : ['Payment connection has not been verified.']).map(blocker => <li key={blocker}>{blocker}</li>)}</ul><p>Starting records this intent and its blocker. It does not simulate a payment.</p><button className="text-button" onClick={() => void refreshSystem()}><Icon name="refresh" />Check connection</button></div>}<details className="payment-terms"><summary>Payment & result terms</summary><p>Fixed local Listing Fixer catalog endpoint; one batch. No extra API charges authorized. A direct address payment buys the catalog processing request. It has no escrow or automatic refund. An unsuccessful downstream check cannot reverse a confirmed network fee or payment. Missing source fields remain flagged in the delivered report.</p></details></div><div className="modal-footer"><button className="button secondary" onClick={closeModal}>Cancel</button><button className="button primary" disabled={!result || starting || busy || paymentUnresolved || !/^\d+$/.test(serviceCap) || !/^\d+$/.test(feeCap)} onClick={() => void startAgent()}>{starting ? 'Starting…' : system?.payment.ready ? 'Authorize & start agent' : 'Start & check payment'}<Icon name="arrow" /></button></div></Modal>}

    {modal === 'download' && result && <Modal title="Download checked files" onClose={closeModal}><div className="modal-body"><p className="modal-intro">{paid ? 'The delivered catalog and its payment receipt are linked in the report.' : 'This is an unpaid source review. Downloads do not represent a completed paid correction.'}</p><label className="export-toggle"><input type="checkbox" checked={downloadReadyOnly} onChange={event => setDownloadReadyOnly(event.target.checked)} /><span><strong>Export ready products only</strong><span>{countForExport} of {products.length} products will be included.</span></span></label><div className="download-options"><button onClick={() => download('csv')} disabled={countForExport === 0}><Icon name="download" /><span><strong>Catalog CSV</strong><small>Importable rows with protected text cells</small></span><Icon name="chevron" /></button><button onClick={() => download('json')} disabled={countForExport === 0}><Icon name="download" /><span><strong>Catalog JSON</strong><small>Checked fields and source references</small></span><Icon name="chevron" /></button><button onClick={() => download('report')}><Icon name="document" /><span><strong>Full review report</strong><small>All products, differences, checks and payment state</small></span><Icon name="chevron" /></button></div></div></Modal>}
  </div>;
}
