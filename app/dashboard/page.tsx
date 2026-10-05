'use client'
// ============================================================
// app/dashboard/page.tsx
// Dashboard principal de matches inmobiliarios
// ============================================================
import { useEffect, useState, useCallback } from 'react'
import type { MatchWithProperties, MatchStatus } from '@/types'

// ── Helpers ────────────────────────────────────────────────────

function formatPrice(price?: number | null): string {
  if (!price) return '—'
  if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`
  if (price >= 1000)    return `$${(price / 1000).toFixed(0)}k`
  return `$${price.toLocaleString()}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function getScoreClass(score: number): string {
  if (score >= 0.88) return 'pm-score-high'
  if (score >= 0.78) return 'pm-score-mid'
  return 'pm-score-low'
}

function getScoreColor(score: number): string {
  if (score >= 0.88) return 'var(--score-high)'
  if (score >= 0.78) return 'var(--score-mid)'
  return 'var(--score-low)'
}

// ── Skeleton loader ────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="pm-skeleton" style={{ height: '240px' }}>
      <div className="pm-skeleton-row" style={{ width: '40%', marginTop: '24px' }} />
      <div className="pm-skeleton-row" style={{ width: '80%' }} />
      <div className="pm-skeleton-row" style={{ width: '60%' }} />
      <div className="pm-skeleton-row" style={{ width: '70%' }} />
    </div>
  )
}

// ── Property panel (oferta o demanda) ─────────────────────────

interface PropertyPanelProps {
  property: MatchWithProperties['offer'] | MatchWithProperties['demand']
  variant: 'offer' | 'demand'
}

function PropertyPanel({ property, variant }: PropertyPanelProps) {
  const [showRaw, setShowRaw] = useState(false)

  const chips: string[] = [
    property.operation   ? `🔄 ${property.operation}` : '',
    property.property_type ? `🏠 ${property.property_type}` : '',
    property.location    ? `📍 ${property.location}` : '',
    property.price_max   ? formatPrice(property.price_max) : '',
    property.bedrooms_min ? `🛏 ${property.bedrooms_min} hab` : '',
    property.bathrooms   ? `🚿 ${property.bathrooms} baños` : '',
    property.area_m2     ? `📐 ${property.area_m2}m²` : '',
    ...(property.features?.slice(0, 3) ?? [])
  ].filter(Boolean)

  const phone = property.sender_phone
  const waLink = `https://wa.me/${phone}`

  return (
    <div className={`pm-prop ${variant}`}>
      <p className="pm-prop-label">
        {variant === 'offer' ? '✅ OFRECE' : '🔍 BUSCA'}
      </p>
      <p className="pm-prop-summary">
        {property.extras?.summary ?? `${property.property_type ?? 'Propiedad'} en ${property.location ?? 'ubicación no especificada'}`}
      </p>

      <div className="pm-prop-meta">
        {chips.map((chip, i) => (
          <span key={i} className="pm-chip">{chip}</span>
        ))}
      </div>

      <div className="pm-prop-footer">
        <span>📱 +{phone}</span>
        <span>{property.group_name ?? property.group_id}</span>
      </div>

      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="pm-btn-contact"
        id={`contact-${variant}-${property.id}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.116.553 4.103 1.524 5.832L0 24l6.336-1.512A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.006-1.368l-.36-.214-3.727.978.995-3.632-.235-.373A9.818 9.818 0 1112 21.818z"/>
        </svg>
        Contactar · +{phone.slice(-8)}
      </a>

      <button
        id={`raw-toggle-${variant}-${property.id}`}
        className="pm-raw-toggle"
        onClick={() => setShowRaw(v => !v)}
      >
        {showRaw ? 'Ocultar mensaje original' : 'Ver mensaje original'}
      </button>
      {showRaw && (
        <div className="pm-raw-message">{property.raw_message}</div>
      )}
    </div>
  )
}

// ── Match card ─────────────────────────────────────────────────

interface MatchCardProps {
  match: MatchWithProperties
  onUpdate: (id: string, status: MatchStatus) => void
  isUpdating: boolean
}

function MatchCard({ match, onUpdate, isUpdating }: MatchCardProps) {
  const pct = Math.round(match.score * 100)
  const scoreClass = getScoreClass(match.score)
  const scoreColor = getScoreColor(match.score)

  return (
    <div className="pm-match-card" id={`match-${match.id}`}>
      {/* Header */}
      <div className="pm-match-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className={`pm-score ${scoreClass}`}>
            {pct}% compatibilidad
          </span>
          <div className="pm-score-bar">
            <div
              className="pm-score-fill"
              style={{ width: `${pct}%`, background: scoreColor }}
            />
          </div>
        </div>
        <span className="pm-match-date">{formatDate(match.created_at)}</span>
      </div>

      {/* Propiedad pair */}
      <div className="pm-property-pair">
        <PropertyPanel property={match.offer}  variant="offer"  />

        <div className="pm-connector">
          <span style={{ fontSize: '1.4rem' }}>⇌</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4 }}>
            match<br/>automático
          </span>
        </div>

        <PropertyPanel property={match.demand} variant="demand" />
      </div>

      {/* Acciones */}
      <div className="pm-actions">
        <button
          id={`btn-contacted-${match.id}`}
          className="pm-btn pm-btn-success"
          disabled={isUpdating}
          onClick={() => onUpdate(match.id, 'contacted')}
        >
          ✓ Conectados
        </button>
        <button
          id={`btn-close-${match.id}`}
          className="pm-btn pm-btn-dismiss"
          disabled={isUpdating}
          onClick={() => onUpdate(match.id, 'closed')}
          title="Marcar como cerrado (se hizo la operación)"
        >
          🏆 Cerrado
        </button>
        <button
          id={`btn-dismiss-${match.id}`}
          className="pm-btn pm-btn-dismiss"
          disabled={isUpdating}
          onClick={() => onUpdate(match.id, 'dismissed')}
        >
          ✗ Descartar
        </button>
      </div>
    </div>
  )
}

// ── Dashboard principal ────────────────────────────────────────

const STATUS_TABS: { key: MatchStatus; label: string; emoji: string }[] = [
  { key: 'pending',   label: 'Pendientes', emoji: '🔔' },
  { key: 'contacted', label: 'Contactados', emoji: '📱' },
  { key: 'closed',    label: 'Cerrados',   emoji: '🏆' },
  { key: 'dismissed', label: 'Descartados', emoji: '✗' }
]

export default function Dashboard() {
  const [activeTab, setActiveTab]   = useState<MatchStatus>('pending')
  const [matches, setMatches]       = useState<MatchWithProperties[]>([])
  const [loading, setLoading]       = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [counts, setCounts]         = useState({ pending: 0, contacted: 0, closed: 0, dismissed: 0 })

  const fetchMatches = useCallback(async (status: MatchStatus) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/matches?status=${status}&limit=50`)
      const data = await res.json()
      setMatches(data.matches ?? [])
    } catch (err) {
      console.error('Error fetching matches:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Cargar contadores para los tabs
  const fetchCounts = useCallback(async () => {
    const statuses: MatchStatus[] = ['pending', 'contacted', 'closed', 'dismissed']
    const results = await Promise.allSettled(
      statuses.map(s => fetch(`/api/matches?status=${s}&limit=1`).then(r => r.json()))
    )
    const newCounts = { pending: 0, contacted: 0, closed: 0, dismissed: 0 }
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        newCounts[statuses[i]] = r.value.count ?? 0
      }
    })
    setCounts(newCounts)
  }, [])

  useEffect(() => {
    // Las llamadas hacen setState tras el await, no de forma síncrona.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchMatches(activeTab)
    void fetchCounts()
  }, [activeTab, fetchMatches, fetchCounts])

  const handleUpdate = useCallback(async (matchId: string, status: MatchStatus) => {
    setUpdatingId(matchId)
    try {
      await fetch('/api/matches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, status })
      })
      // Remover de la lista actual
      setMatches(prev => prev.filter(m => m.id !== matchId))
      // Actualizar contadores
      setCounts(prev => ({
        ...prev,
        [activeTab]: Math.max(0, prev[activeTab] - 1),
        [status]:    prev[status] + 1
      }))
    } catch (err) {
      console.error('Error updating match:', err)
    } finally {
      setUpdatingId(null)
    }
  }, [activeTab])

  return (
    <div className="pm-shell">
      {/* Header */}
      <header className="pm-header">
        <div className="pm-logo">
          <div className="pm-logo-icon">🏠</div>
          <span>Property Matcher</span>
        </div>
        <div className="pm-header-right">
          <span className="pm-badge pm-badge-live">EN VIVO</span>
          <span className="pm-badge" style={{
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)'
          }}>
            WhatsApp → IA → Match
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="pm-main">

        {/* Stats */}
        <div className="pm-stats">
          {STATUS_TABS.map(tab => (
            <div key={tab.key} className="pm-stat-card">
              <div className="pm-stat-label">{tab.emoji} {tab.label}</div>
              <div className="pm-stat-value">{counts[tab.key]}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="pm-tabs" style={{ marginBottom: '24px' }}>
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              className={`pm-tab${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.emoji} {tab.label}
              {counts[tab.key] > 0 && (
                <span style={{
                  marginLeft: '6px',
                  fontSize: '0.7rem',
                  background: 'rgba(129,140,248,0.2)',
                  color: '#818cf8',
                  padding: '1px 6px',
                  borderRadius: '10px'
                }}>
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="pm-matches">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : matches.length === 0 ? (
            <div className="pm-empty">
              <div className="pm-empty-icon">🏡</div>
              <h3>Sin {STATUS_TABS.find(t => t.key === activeTab)?.label.toLowerCase()} ahora</h3>
              <p>
                {activeTab === 'pending'
                  ? 'Los matches aparecerán aquí cuando WhatsApp reciba mensajes compatibles.'
                  : 'No hay matches en esta categoría.'}
              </p>
            </div>
          ) : (
            matches.map(match => (
              <MatchCard
                key={match.id}
                match={match}
                onUpdate={handleUpdate}
                isUpdating={updatingId === match.id}
              />
            ))
          )}
        </div>
      </main>
    </div>
  )
}
