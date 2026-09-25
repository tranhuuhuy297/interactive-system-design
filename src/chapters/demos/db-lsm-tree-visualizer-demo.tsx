import { useState } from 'react'
import { Button, DemoFrame } from '../../components/ui'
import { emptyLsm, get, L0_COMPACT_AT, MEMTABLE_CAP, put, type ReadStep, type SSTable } from './db-lsm-tree-model'
import './db-demos.css'

const WORDS = ['apple', 'kiwi', 'mango', 'fig', 'lime', 'pear', 'plum', 'date', 'grape', 'melon', 'peach', 'lemon']
const OUTCOME: Record<ReadStep['outcome'], string> = {
  hit: 'found ✓', miss: 'not here', skip: 'bloom says no → skipped', 'false-positive': 'bloom said maybe → scanned, absent (false positive)', tombstone: 'tombstone → deleted',
}

function Table({ t, label, hl }: { t: SSTable; label: string; hl?: string }) {
  return (
    <div className="lsm__table">
      <div className="lsm__tname">{label}</div>
      <div className="lsm__bloom" aria-label="bloom filter bits">{t.bloom.map((b, i) => <i key={i} className={b ? 'on' : ''} />)}</div>
      {t.entries.map(([k, v]) => <div key={k} className={`lsm__entry ${k === hl ? 'is-hl' : ''} ${v === null ? 'is-tomb' : ''}`}><span>{k}</span><span>{v ?? '†'}</span></div>)}
    </div>
  )
}

export function DbLsmTreeVisualizerDemo() {
  const [lsm, setLsm] = useState(emptyLsm)
  const [key, setKey] = useState('kiwi')
  const [read, setRead] = useState<{ key: string; steps: ReadStep[]; value: string | null | undefined } | null>(null)
  const [n, setN] = useState(1)

  const write = (k: string, v: string | null) => { setLsm((s) => put(s, k, v)); setRead(null) }
  const randomPut = () => { const k = WORDS[Math.floor(Math.random() * WORDS.length)]; write(k, `v${n}`); setN(n + 1) }
  const doGet = () => { const r = get(lsm, key.trim()); setRead({ key: key.trim(), ...r }) }
  const amp = lsm.userWrites ? lsm.diskWrites / lsm.userWrites : 0

  return (
    <DemoFrame title="LSM tree: writes, flushes, compaction, bloom-filtered reads" onReset={() => { setLsm(emptyLsm()); setRead(null); setN(1) }}
      hint={`Memtable flushes at ${MEMTABLE_CAP} keys. ${L0_COMPACT_AT} L0 tables trigger compaction into L1. Then GET a key and watch the read path.`}>
      <div className="lsm__controls">
        <Button variant="primary" size="sm" onClick={randomPut}>PUT random key</Button>
        <input className="lsm__input mono" value={key} onChange={(e) => setKey(e.target.value)} aria-label="Key" list="lsm-words" />
        <datalist id="lsm-words">{WORDS.map((w) => <option key={w} value={w} />)}</datalist>
        <Button size="sm" onClick={() => { write(key.trim(), `v${n}`); setN(n + 1) }} disabled={!key.trim()}>PUT</Button>
        <Button size="sm" onClick={() => write(key.trim(), null)} disabled={!key.trim()}>DELETE</Button>
        <Button size="sm" onClick={doGet} disabled={!key.trim()}>GET</Button>
      </div>

      <div className="lsm__levels">
        <div className="lsm__level">
          <div className="demo-label">Memory · memtable ({lsm.memtable.size}/{MEMTABLE_CAP})</div>
          <div className="lsm__table lsm__table--mem">
            {[...lsm.memtable.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => (
              <div key={k} className={`lsm__entry ${k === read?.key ? 'is-hl' : ''} ${v === null ? 'is-tomb' : ''}`}><span>{k}</span><span>{v ?? '†'}</span></div>
            ))}
            {lsm.memtable.size === 0 && <div className="lsm__empty">empty</div>}
          </div>
        </div>
        <div className="lsm__level">
          <div className="demo-label">Disk · L0 ({lsm.l0.length}/{L0_COMPACT_AT}) newest → oldest</div>
          <div className="lsm__row">{lsm.l0.length ? lsm.l0.map((t) => <Table key={t.id} t={t} label={`#${t.id}`} hl={read?.key} />) : <div className="lsm__empty">no tables</div>}</div>
        </div>
        <div className="lsm__level">
          <div className="demo-label">Disk · L1 (compacted, no tombstones)</div>
          <div className="lsm__row">{lsm.l1 ? <Table t={lsm.l1} label={`#${lsm.l1.id}`} hl={read?.key} /> : <div className="lsm__empty">no table yet</div>}</div>
        </div>
      </div>

      <div className="lsm__bottom">
        <div>
          <div className="demo-label">Event log</div>
          <ul className="lsm__log">{lsm.log.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </div>
        <div>
          <div className="demo-label">Read path {read && `for “${read.key}”`}</div>
          {read ? (
            <ol className="lsm__read">
              {read.steps.map((s, i) => <li key={i} className={`is-${s.outcome}`}><b>{s.where}</b> {OUTCOME[s.outcome]}</li>)}
              <li className="lsm__result">→ {read.value === undefined ? 'NOT FOUND' : read.value === null ? 'NOT FOUND (deleted)' : read.value}</li>
            </ol>
          ) : <p className="lsm__empty">Press GET.</p>}
          <p className="lsm__amp mono">write amplification ≈ {amp.toFixed(2)}× ({lsm.diskWrites} disk entry writes / {lsm.userWrites} user writes)</p>
        </div>
      </div>
    </DemoFrame>
  )
}
