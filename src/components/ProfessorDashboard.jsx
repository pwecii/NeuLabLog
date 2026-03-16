import React, { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  todayInputDate,
  formatDateTime,
  formatTimeRange,
} from '../utils/format'
import neuLogo from '../images/neu.png'
import backgroundImage from '../images/Background.png'

export default function ProfessorDashboard({ profile, isQrMode, onLogout, onBackToAdmin }) {
  const [form, setForm] = useState({
    subject: '',
    room_number: '',
    date: (() => { const n=new Date(); return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0') })(),
    start_clock: '',
    end_clock: '',
  })

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [rooms, setRooms] = useState([])
  const [loadingRooms, setLoadingRooms] = useState(false)

  // Filter state
  const [filterPeriod, setFilterPeriod] = useState('daily')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const fullName = useMemo(() => profile?.full_name || 'Professor', [profile])

  const loadMyLogs = async () => {
    setLoadingLogs(true)
    try {
      // Use RPC so QR mode (no auth session) can also read logs
      const { data, error } = await supabase.rpc('get_professor_logs_by_id', {
        input_professor_id: profile.id,
      })
      if (error) throw error
      setLogs(data || [])
    } catch (err) {
      setError(err.message || 'Failed to load logs.')
    } finally {
      setLoadingLogs(false)
    }
  }

  const loadRooms = async () => {
    setLoadingRooms(true)
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('room_number', { ascending: true })
      if (error) throw error
      setRooms(data || [])
    } catch (err) {
      setError(err.message || 'Failed to load rooms.')
    } finally {
      setLoadingRooms(false)
    }
  }

  React.useEffect(() => {
    if (profile?.id) {
      loadMyLogs()
      loadRooms()
    }
  }, [profile?.id])

  // Returns today as YYYY-MM-DD in LOCAL timezone (avoids UTC offset bugs)
  const getLocalToday = () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return y + '-' + m + '-' + d
  }

  // Keep the date field always in sync with today's local date
  React.useEffect(() => {
    const updateDate = () => setForm((prev) => ({ ...prev, date: getLocalToday() }))
    updateDate()
    const interval = setInterval(updateDate, 60000)
    window.addEventListener('focus', updateDate)
    return () => { clearInterval(interval); window.removeEventListener('focus', updateDate) }
  }, [])
  const filteredLogs = useMemo(() => {
    const now = new Date()
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

    return logs.filter((log) => {
      const logDate = new Date(log.start_time)

      if (filterPeriod === 'daily') {
        return logDate >= startOfDay(now)
      }
      if (filterPeriod === 'weekly') {
        const day = now.getDay()
        const monday = startOfDay(now)
        monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
        return logDate >= monday
      }
      if (filterPeriod === 'monthly') {
        return (
          logDate.getFullYear() === now.getFullYear() &&
          logDate.getMonth() === now.getMonth()
        )
      }
      if (filterPeriod === 'yearly') {
        return logDate.getFullYear() === now.getFullYear()
      }
      if (filterPeriod === 'custom') {
        const start = customStart ? new Date(customStart) : null
        const end = customEnd ? new Date(customEnd + 'T23:59:59') : null
        if (start && logDate < start) return false
        if (end && logDate > end) return false
        return true
      }
      return true
    })
  }, [logs, filterPeriod, customStart, customEnd])

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      if (!form.subject || !form.room_number || !form.date || !form.start_clock || !form.end_clock) {
        throw new Error('Please complete all required fields.')
      }

      const normalizedRoom = form.room_number.trim().toUpperCase()
      const allowedRoomNumbers = rooms.map((room) => room.room_number)
      if (!allowedRoomNumbers.includes(normalizedRoom)) {
        throw new Error('Selected room is not valid.')
      }

      const start_time = new Date(`${form.date}T${form.start_clock}`)
      const end_time = new Date(`${form.date}T${form.end_clock}`)

      if (Number.isNaN(start_time.getTime()) || Number.isNaN(end_time.getTime())) {
        throw new Error('Invalid date/time values.')
      }
      if (end_time <= start_time) {
        throw new Error('End time must be later than start time.')
      }

      // ── CONFLICT CHECK + INSERT via SECURITY DEFINER RPC ──
      // This works for both normal login and QR mode (no auth.uid session).
      // The function checks for overlapping bookings atomically then inserts.
      const { data: rpcResult, error: rpcError } = await supabase.rpc('safe_insert_usage_log', {
        p_professor_id:    profile.id,
        p_professor_name:  profile.full_name,
        p_professor_email: profile.email,
        p_subject:         form.subject,
        p_room_number:     normalizedRoom,
        p_start_time:      start_time.toISOString(),
        p_end_time:        end_time.toISOString(),
      })

      if (rpcError) throw rpcError
      if (rpcResult && !rpcResult.success) {
        throw new Error(rpcResult.error)
      }

      setMessage(`Thank you for using Room ${normalizedRoom}`)
      setForm({ subject: '', room_number: '', date: getLocalToday(), start_clock: '', end_clock: '' })
      await loadMyLogs()
    } catch (err) {
      setError(err.message || 'Failed to save usage log.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 sm:px-4 sm:py-3.5 text-sm sm:text-base outline-none focus:border-[#0f2744] focus:ring-1 focus:ring-[#0f2744]"
  const labelClass = "mb-2 block text-xs font-semibold text-slate-500 uppercase tracking-wide"

  const periodTabs = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'yearly', label: 'Yearly' },
    { key: 'custom', label: 'Custom' },
  ]

  return (
    <div style={{ minHeight: '100vh', width: '99.5vw', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>

      {/* ── TOP BANNER ── */}
      <div
        style={{
          background: '#0f2744',
          borderBottom: '4px solid #c9a84c',
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          minHeight: '60px',
          flexShrink: 0,
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src={neuLogo} alt="NEU Logo"
            style={{ height: '52px', width: '52px', objectFit: 'contain', flexShrink: 1 }} />
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.25)', paddingLeft: '16px' }}>
            <div style={{
              fontFamily: "'Kelly Slab', cursive",
              fontSize: 'clamp(16px, 3vw, 24px)',
              fontWeight: '600', color: '#ffffff', letterSpacing: '0.5px', lineHeight: 1.2,
            }}>
              NEU LabLog
            </div>
           <div className="hidden sm:block" style={{
                fontSize: '10px',
                color: '#c9a84c',
                letterSpacing: '0.3px',
                whiteSpace: 'nowrap',
              }}>
                New Era University · Laboratory Room Usage System
              </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.full_name}
              style={{ height: '34px', width: '34px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #c9a84c', flexShrink: 0 }} />
          ) : (
            <div style={{
              height: '34px', width: '34px', borderRadius: '50%', background: '#c9a84c',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: '700', color: '#0f2744', flexShrink: 0,
            }}>
              {profile?.full_name?.charAt(0)?.toUpperCase() || 'P'}
            </div>
          )}

          <div className="hidden sm:block" style={{ lineHeight: 1.3, marginRight: '4px' }}>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: '#ffffff' }}>{fullName}</p>
            <p style={{ margin: 0, fontSize: '10px', color: '#93c5fd' }}>{profile.email}</p>
            {isQrMode && (
              <span style={{ fontSize: '9px', background: '#c9a84c', color: '#0f2744', borderRadius: '999px', padding: '1px 7px', fontWeight: '700' }}>
                QR Mode
              </span>
            )}
          </div>

          {onBackToAdmin && (
            <button onClick={onBackToAdmin}
              style={{
                background: 'rgba(201,168,76,0.2)', border: '1.5px solid #c9a84c',
                borderRadius: '8px', color: '#c9a84c',
                fontSize: 'clamp(0.65rem, 2vw, 0.8rem)', fontWeight: '600',
                padding: '5px 10px', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
              }}>
              <span className="hidden sm:inline">Back to Admin</span>
              <span className="sm:hidden">Admin</span>
            </button>
          )}
          <button onClick={onLogout}
            style={{
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px', color: '#ffffff',
              fontSize: 'clamp(0.65rem, 2vw, 0.8rem)', fontWeight: '500',
              padding: '5px 10px', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
            }}>
            Logout
          </button>
        </div>
      </div>

      {/* ── BACKGROUND + CONTENT ── */}
      <div
        style={{
          flex: 1,
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
          padding: 'clamp(1rem, 3vw, 2rem) clamp(0.5rem, 2vw, 1rem)',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ── FORM + RECENT USAGE GRID ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }} className="md:grid-cols-[3fr_2fr]">

            {/* Record Laboratory Usage */}
            <div style={{
              background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)', borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.7)',
              boxShadow: '0 4px 24px rgba(15,39,68,0.12)', overflow: 'hidden',
            }}>
              <div style={{ height: '4px', background: '#c9a84c' }} />
              <div style={{ padding: 'clamp(1rem, 4vw, 2rem)' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: 'clamp(16px, 4vw, 20px)', fontWeight: '700', color: '#0f2744' }}>
                  Record Laboratory Usage
                </h3>

                {message && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderLeft: '4px solid #16a34a', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#15803d', marginBottom: '1rem' }}>
                    {message}
                  </div>
                )}
                {error && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderLeft: '4px solid #dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#b91c1c', marginBottom: '1rem' }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div>
                    <label className={labelClass}>Professor Name</label>
                    <input type="text" value={profile.full_name || ''} disabled
                      className={inputClass} style={{ background: '#f1f5f9', color: '#64748b' }} />
                  </div>
                  <div>
                    <label className={labelClass}>Subject</label>
                    <input type="text" value={form.subject}
                      onChange={(e) => handleChange('subject', e.target.value)}
                      placeholder="e.g. Programming 1" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Room Number</label>
                    <select value={form.room_number}
                      onChange={(e) => handleChange('room_number', e.target.value)}
                      className={inputClass}>
                      <option value="">{loadingRooms ? 'Loading rooms...' : 'Select laboratory room'}</option>
                      {rooms.map((room) => (
                        <option key={room.id} value={room.room_number}>{room.room_number}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '8px' }}>
                    <div>
                      <label className={labelClass}>Date</label>
                      <input type="date" value={form.date}
                        onChange={(e) => handleChange('date', e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Start Time</label>
                      <input type="time" value={form.start_clock}
                        onChange={(e) => handleChange('start_clock', e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>End Time</label>
                      <input type="time" value={form.end_clock}
                        onChange={(e) => handleChange('end_clock', e.target.value)} className={inputClass} />
                    </div>
                  </div>
                  <button type="submit" disabled={saving}
                    style={{
                      width: '100%', background: '#0f2744', color: '#fff', border: 'none',
                      borderRadius: '12px', padding: '14px 16px', fontSize: '15px',
                      fontWeight: '600', cursor: 'pointer', opacity: saving ? 0.6 : 1,
                    }}>
                    {saving ? 'Saving...' : 'Save Usage Log'}
                  </button>
                </form>
              </div>
            </div>

            {/* My Recent Usage */}
            <div style={{
              background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)', borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.7)',
              boxShadow: '0 4px 24px rgba(15,39,68,0.12)', overflow: 'hidden',
            }}>
              <div style={{ height: '4px', background: '#c9a84c' }} />
              <div style={{ padding: 'clamp(1rem, 3vw, 1.5rem)' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: 'clamp(14px, 3vw, 16px)', fontWeight: '700', color: '#0f2744' }}>My Recent Usage</h3>
                  <button onClick={loadMyLogs}
                    style={{
                      background: 'transparent', border: '1px solid #cbd5e1',
                      borderRadius: '8px', padding: '6px 12px', fontSize: '12px',
                      color: '#475569', cursor: 'pointer',
                    }}>
                    Refresh
                  </button>
                </div>

                {/* Period filter tabs */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  {periodTabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setFilterPeriod(tab.key)}
                      style={{
                        padding: 'clamp(3px, 1vw, 5px) clamp(8px, 2vw, 12px)',
                        borderRadius: '999px',
                        fontSize: 'clamp(10px, 2vw, 12px)',
                        fontWeight: '600',
                        border: 'none',
                        cursor: 'pointer',
                        background: filterPeriod === tab.key ? '#0f2744' : '#f1f5f9',
                        color: filterPeriod === tab.key ? '#c9a84c' : '#64748b',
                        transition: 'all 0.15s',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Custom date range inputs */}
                {filterPeriod === 'custom' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                    <div>
                      <label className={labelClass}>From</label>
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>To</label>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}

                {/* Result count */}
                <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px' }}>
                  {filteredLogs.length} record{filteredLogs.length !== 1 ? 's' : ''} found
                </p>

                {/* Log entries */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto' }}>
                  {loadingLogs ? (
                    <p style={{ color: '#64748b', fontSize: '13px' }}>Loading...</p>
                  ) : filteredLogs.length === 0 ? (
                    <div style={{
                      textAlign: 'center', padding: '2rem',
                      border: '1px dashed #cbd5e1', borderRadius: '10px',
                    }}>
                      <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>No records found for this period.</p>
                    </div>
                  ) : (
                    filteredLogs.map((log) => (
                      <div key={log.id} style={{
                        border: '1px solid #e2e8f0', borderLeft: '4px solid #0f2744',
                        borderRadius: '10px', padding: '12px 14px', background: '#f8fafc',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{log.subject}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>{log.room_number}</p>
                          </div>
                          <span style={{
                            background: '#0f2744', color: '#c9a84c',
                            borderRadius: '999px', padding: '3px 10px',
                            fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap', flexShrink: 0,
                          }}>
                            {formatTimeRange(log.start_time, log.end_time)}
                          </span>
                        </div>
                        <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                          {formatDateTime(log.start_time)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── MY QR LOGIN CODE ── */}
          <div style={{
            background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)', borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.7)',
            boxShadow: '0 4px 24px rgba(15,39,68,0.12)', overflow: 'hidden',
          }}>
            <div style={{ height: '4px', background: '#c9a84c' }} />
            <div style={{ padding: 'clamp(1rem, 3vw, 1.5rem)' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: 'clamp(14px, 3vw, 16px)', fontWeight: '700', color: '#0f2744' }}>My QR Login Code</h3>
              <p style={{ margin: '0 0 1.25rem 0', fontSize: '13px', color: '#64748b' }}>
                This QR code can be used to log in quickly on the QR scanner.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'flex-start' }}
                className="md:flex-row md:items-start">
                <div style={{ border: '2px solid #0f2744', borderRadius: '12px', padding: '12px', background: '#fff', flexShrink: 0 }}>
                  {profile?.qr_code_png ? (
                    <img src={profile.qr_code_png} alt="Professor QR Code"
                      style={{ height: 'clamp(140px, 40vw, 200px)', width: 'clamp(140px, 40vw, 200px)', display: 'block' }} />
                  ) : (
                    <div style={{ height: 'clamp(140px, 40vw, 200px)', width: 'clamp(140px, 40vw, 200px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#94a3b8' }}>
                      QR code not available yet
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
                  <div>
                    <p style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                      QR Code Value
                    </p>
                    <div style={{
                      background: '#f1f5f9', border: '1px solid #cbd5e1', borderLeft: '4px solid #0f2744',
                      borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#475569',
                      wordBreak: 'break-all', lineHeight: 1.5,
                    }}>
                      {profile?.qr_code_value || 'No QR value'}
                    </div>
                  </div>

                  {profile?.qr_code_png && (
                    <a href={profile.qr_code_png}
                      download={`${profile.full_name || 'professor'}-qr-code.png`}
                      style={{
                        display: 'inline-block', background: '#0f2744', color: '#c9a84c',
                        borderRadius: '10px', padding: '10px 20px', fontSize: '13px',
                        fontWeight: '600', textDecoration: 'none', alignSelf: 'flex-start',
                      }}>
                      Download QR Code
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
