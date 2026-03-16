import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDateTime } from '../utils/format'
import backgroundImage from '../images/Background.png'
import neuLogo from '../images/neu.png'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

export default function AdminDashboard({ profile, onLogout, onSwitchView }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState('daily')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [error, setError] = useState('')
  const [now, setNow] = useState(new Date())

  const [rooms, setRooms] = useState([])
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [newRoom, setNewRoom] = useState('')
  const [savingRoom, setSavingRoom] = useState(false)
  const [removeRoom, setRemoveRoom] = useState('')
  const [removingRoom, setRemovingRoom] = useState(false)

  const [editingLog, setEditingLog] = useState(null)
  const [editForm, setEditForm] = useState({
    subject: '',
    room_number: '',
    start_time: '',
    end_time: '',
  })

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

  const fetchLogs = async () => {
    setLoading(true)
    setError('')
    try {
      let query = supabase
        .from('usage_logs')
        .select(`id, professor_id, professor_name_snapshot, professor_email_snapshot, subject, room_number, start_time, end_time, created_at`)
        .order('start_time', { ascending: false })

      const currentNow = new Date()
      if (filterMode === 'daily') {
        const start = new Date(currentNow); start.setHours(0, 0, 0, 0)
        query = query.gte('start_time', start.toISOString())
      }
      if (filterMode === 'weekly') {
        const start = new Date(currentNow); start.setDate(currentNow.getDate() - 7)
        query = query.gte('start_time', start.toISOString())
      }
      if (filterMode === 'monthly') {
        const start = new Date(currentNow); start.setMonth(currentNow.getMonth() - 1)
        query = query.gte('start_time', start.toISOString())
      }
      if (filterMode === 'custom') {
        if (dateFrom) query = query.gte('start_time', new Date(`${dateFrom}T00:00:00`).toISOString())
        if (dateTo) query = query.lte('start_time', new Date(`${dateTo}T23:59:59`).toISOString())
      }
      if (search.trim()) {
        query = query.or(`professor_name_snapshot.ilike.%${search}%,subject.ilike.%${search}%,room_number.ilike.%${search}%`)
      }
      const { data, error } = await query
      if (error) throw error
      setLogs(data || [])
    } catch (err) {
      setError(err.message || 'Failed to load usage logs.')
    } finally {
      setLoading(false)
    }
  }

  const handleAddRoom = async (e) => {
    e.preventDefault(); setSavingRoom(true); setError('')
    try {
      const normalizedRoom = newRoom.trim().toUpperCase()
      if (!normalizedRoom) throw new Error('Please enter a room number.')
      const { error } = await supabase.from('rooms').insert({ room_number: normalizedRoom })
      if (error) throw error
      setNewRoom(''); await loadRooms()
    } catch (err) { setError(err.message || 'Failed to add room.')
    } finally { setSavingRoom(false) }
  }

  const handleRemoveRoom = async (e) => {
    e.preventDefault(); setRemovingRoom(true); setError('')
    try {
      const normalizedRoom = removeRoom.trim().toUpperCase()
      if (!normalizedRoom) throw new Error('Please enter a room number to remove.')
      const existingRoom = rooms.find((room) => room.room_number === normalizedRoom)
      if (!existingRoom) throw new Error(`Room ${normalizedRoom} does not exist.`)
      const { error } = await supabase.from('rooms').delete().eq('room_number', normalizedRoom)
      if (error) throw error
      setRemoveRoom(''); await loadRooms()
    } catch (err) { setError(err.message || 'Failed to remove room.')
    } finally { setRemovingRoom(false) }
  }

  useEffect(() => { fetchLogs(); loadRooms() }, [filterMode])

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(interval)
  }, [])

  const roomStatus = useMemo(() => {
    return rooms.map((roomItem) => {
      const roomNumber = roomItem.room_number
      const activeLog = logs.find((log) => {
        const start = new Date(log.start_time); const end = new Date(log.end_time)
        return log.room_number === roomNumber && now >= start && now <= end
      })
      return {
        id: roomItem.id, room: roomNumber, occupied: !!activeLog,
        professor: activeLog?.professor_name_snapshot || null,
        subject: activeLog?.subject || null,
        start_time: activeLog?.start_time || null,
        end_time: activeLog?.end_time || null,
        logId: activeLog?.id || null,
      }
    })
  }, [logs, now, rooms])

  const roomUsageSummary = useMemo(() => {
    const counts = {}
    for (const room of rooms) counts[room.room_number] = 0
    for (const log of logs) {
      if (counts[log.room_number] !== undefined) counts[log.room_number] += 1
      else counts[log.room_number] = 1
    }
    return Object.entries(counts).map(([room, count]) => ({ room, count })).sort((a, b) => a.room.localeCompare(b.room))
  }, [logs, rooms])

  const stats = useMemo(() => {
    const totalUsage = logs.length
    const professorSet = new Set(logs.map((item) => item.professor_id))
    const roomSet = new Set(logs.map((item) => item.room_number))
    const subjectSet = new Set(logs.map((item) => item.subject))
    const occupiedRooms = roomStatus.filter((room) => room.occupied).length
    const unoccupiedRooms = rooms.length - occupiedRooms
    return { totalUsage, professors: professorSet.size, rooms: roomSet.size, subjects: subjectSet.size, occupiedRooms, unoccupiedRooms }
  }, [logs, roomStatus, rooms])

  const professorSummary = useMemo(() => {
    const map = {}
    for (const log of logs) { const key = log.professor_name_snapshot || 'Unknown'; map[key] = (map[key] || 0) + 1 }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [logs])

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this usage log?')) return
    const { error } = await supabase.from('usage_logs').delete().eq('id', id)
    if (error) { setError(error.message || 'Failed to delete log.'); return }
    fetchLogs()
  }

  const handleEndNow = async (id) => {
    const { error } = await supabase.from('usage_logs').update({ end_time: new Date().toISOString() }).eq('id', id)
    if (error) { setError(error.message || 'Failed to end session.'); return }
    fetchLogs()
  }

  const openEdit = (log) => {
    setEditingLog(log)
    setEditForm({ subject: log.subject, room_number: log.room_number, start_time: log.start_time.slice(0, 16), end_time: log.end_time.slice(0, 16) })
  }

  const saveEdit = async () => {
    try {
      if (!editForm.subject || !editForm.room_number || !editForm.start_time || !editForm.end_time)
        throw new Error('Please complete all edit fields.')
      const start = new Date(editForm.start_time); const end = new Date(editForm.end_time)
      if (end <= start) throw new Error('End time must be later than start time.')
      const { error } = await supabase.from('usage_logs').update({
        subject: editForm.subject, room_number: editForm.room_number,
        start_time: start.toISOString(), end_time: end.toISOString(),
      }).eq('id', editingLog.id)
      if (error) throw error
      setEditingLog(null); fetchLogs()
    } catch (err) { setError(err.message || 'Failed to update log.') }
  }

  /* ─── shared card style ─── */
  const card = {
    background: 'rgba(255,255,255,0.93)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    border: '1px solid rgba(255,255,255,0.7)',
    borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(15,39,68,0.10)',
    padding: 'clamp(12px, 3vw, 20px)',
  }

  const sectionTitle = {
    fontSize: '1.05rem',
    fontWeight: '700',
    color: '#0f2744',
    borderLeft: '4px solid #c9a84c',
    paddingLeft: '10px',
    marginBottom: '14px',
  }

  const inputStyle = {
    width: '100%',
    borderRadius: '10px',
    border: '1.5px solid #d1d5db',
    padding: '9px 14px',
    fontSize: '0.875rem',
    outline: 'none',
    background: 'rgba(255,255,255,0.85)',
    color: '#0f172a',
  }

  return (
    <div style={{ minHeight: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>

      {/* ── TOP BANNER ── */}
      <div style={{
        background: '#0f2744',
        borderBottom: '4px solid #c9a84c',
        flexShrink: 0,
        width: '100%',
      }}>
        <div style={{
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          minHeight: '56px',
        }}>
          {/* Left: logo + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
            <img
              src={neuLogo}
              alt="NEU Logo"
              style={{ height: '34px', width: '34px', objectFit: 'contain', flexShrink: 0 }}
            />
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.25)', paddingLeft: '8px', minWidth: 0 }}>
              <div style={{
                fontFamily: "'Kelly Slab', cursive",
                fontSize: 'clamp(13px, 3.5vw, 22px)',
                fontWeight: '600',
                color: '#ffffff',
                letterSpacing: '0.5px',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
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

          {/* Right: avatar + name (sm+) + buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <div style={{
              background: 'rgba(201,168,76,0.15)', border: '1.5px solid #c9a84c',
              borderRadius: '50%', width: '30px', height: '30px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ color: '#c9a84c', fontSize: '0.8rem', fontWeight: 700 }}>
                {(profile.full_name || 'A')[0].toUpperCase()}
              </span>
            </div>
            <div className="hidden sm:block" style={{ lineHeight: 1.3, marginRight: '2px' }}>
              <div style={{ color: '#fff', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{profile.full_name}</div>
              <div style={{ color: '#c9a84c', fontSize: '0.62rem', whiteSpace: 'nowrap' }}>{profile.email}</div>
            </div>
            <button
              onClick={onSwitchView}
              style={{
                background: 'rgba(201,168,76,0.2)', border: '1.5px solid #c9a84c',
                borderRadius: '7px', color: '#c9a84c',
                fontSize: '0.72rem', fontWeight: 600,
                padding: '5px 8px', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              <span className="hidden sm:inline">Professor View</span>
              <span className="sm:hidden">Prof View</span>
            </button>
            <button
              onClick={onLogout}
              style={{
                background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.35)',
                borderRadius: '7px', color: '#fff',
                fontSize: '0.72rem', fontWeight: 600,
                padding: '5px 8px', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* ── BACKGROUND CONTENT ── */}
      <div style={{
        flex: 1,
        width: '100%',
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        padding: 'clamp(12px, 3vw, 24px) clamp(8px, 2vw, 16px) 40px',
      }}>
        {/* subtle dark overlay for readability */}
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>

          {/* ── PAGE HEADING ── */}
          <div style={{ marginBottom: '20px' }}>
            <h1 style={{
              fontFamily: "'Kelly Slab', cursive",
              fontSize: 'clamp(18px, 5vw, 30px)',
              color: '#0f2744',
              textShadow: '0 1px 4px rgba(255,255,255,0.9)',
              fontWeight: 700, lineHeight: 1.2,
            }}>
              Admin Dashboard
            </h1>
            <p style={{ color: '#0f2744', fontSize: 'clamp(0.72rem, 2vw, 0.85rem)', marginTop: '4px', textShadow: '0 1px 3px rgba(255,255,255,0.8)' }}>
              Welcome back, <strong>{profile.full_name}</strong> · {formatDateTime(now)}
            </p>
          </div>

          {/* ── ERROR ── */}
          {error && (
            <div style={{ ...card, background: 'rgba(254,226,226,0.95)', border: '1px solid #fca5a5', color: '#b91c1c', marginBottom: '16px', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          {/* ── STAT CARDS ── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" style={{ marginBottom: '16px' }}>
            {[
              { label: 'Occupied Rooms', value: stats.occupiedRooms, color: '#dc2626' },
              { label: 'Unoccupied Rooms', value: stats.unoccupiedRooms, color: '#16a34a' },
              { label: 'Total Usage Logs', value: stats.totalUsage, color: '#0f2744' },
              { label: 'Professors', value: stats.professors, color: '#0f2744' },
              { label: 'Subjects Logged', value: stats.subjects, color: '#0f2744' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ ...card, padding: '16px', textAlign: 'center' }}>
                <p style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
                <p style={{ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1.1, marginTop: '6px' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* ── MANAGE ROOMS ── */}
          <div style={{ ...card, marginBottom: '16px' }}>
            <h3 style={sectionTitle}>Manage Rooms</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '14px' }}>
              Add or remove laboratory rooms. Changes appear automatically in the professor room dropdown.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <form onSubmit={handleAddRoom}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0f2744', marginBottom: '6px' }}>Add Room</label>
                <div className="flex gap-2">
                  <input type="text" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} placeholder="e.g. M112" style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
                  <button type="submit" disabled={savingRoom} style={{ background: '#0f2744', color: '#fff', border: 'none', borderRadius: '10px', padding: '9px 14px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, opacity: savingRoom ? 0.6 : 1 }}>
                    {savingRoom ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </form>
              <form onSubmit={handleRemoveRoom}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0f2744', marginBottom: '6px' }}>Remove Room</label>
                <div className="flex gap-2">
                  <input type="text" value={removeRoom} onChange={(e) => setRemoveRoom(e.target.value)} placeholder="e.g. M112" style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
                  <button type="submit" disabled={removingRoom} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: '10px', padding: '9px 14px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, opacity: removingRoom ? 0.6 : 1 }}>
                    {removingRoom ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </form>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
              {loadingRooms ? (
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Loading rooms…</p>
              ) : rooms.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>No rooms added yet.</p>
              ) : rooms.map((room) => (
                <span key={room.id} style={{ background: 'rgba(15,39,68,0.08)', border: '1px solid rgba(15,39,68,0.15)', borderRadius: '999px', padding: '3px 12px', fontSize: '0.8rem', fontWeight: 600, color: '#0f2744' }}>
                  {room.room_number}
                </span>
              ))}
            </div>
          </div>

          {/* ── ROOM HEATMAP ── */}
          <div style={{ ...card, marginBottom: '16px' }}>
            <h3 style={sectionTitle}>Room Heatmap / Live Status</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {roomStatus.map((room) => (
                <div key={room.id} style={{
                  borderRadius: '14px',
                  border: room.occupied ? '1.5px solid #fca5a5' : '1.5px solid #86efac',
                  background: room.occupied ? 'rgba(254,226,226,0.85)' : 'rgba(220,252,231,0.85)',
                  padding: '14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f2744' }}>{room.room}</span>
                    <span style={{
                      borderRadius: '999px', padding: '2px 10px', fontSize: '0.7rem', fontWeight: 700,
                      background: room.occupied ? '#fee2e2' : '#dcfce7',
                      color: room.occupied ? '#dc2626' : '#16a34a',
                      border: room.occupied ? '1px solid #fca5a5' : '1px solid #86efac',
                    }}>
                      {room.occupied ? 'Occupied' : 'Free'}
                    </span>
                  </div>
                  {room.occupied ? (
                    <div style={{ marginTop: '10px', fontSize: '0.75rem', color: '#374151', lineHeight: 1.6 }}>
                      <p><strong>Prof:</strong> {room.professor}</p>
                      <p><strong>Subject:</strong> {room.subject}</p>
                      <p><strong>Until:</strong> {formatDateTime(room.end_time)}</p>
                      <button onClick={() => handleEndNow(room.logId)} style={{ marginTop: '8px', width: '100%', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 0', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                        End Now
                      </button>
                    </div>
                  ) : (
                    <p style={{ marginTop: '8px', fontSize: '0.75rem', color: '#64748b' }}>No one is using this room.</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── BAR CHART ── */}
          <div style={{ ...card, marginBottom: '16px' }}>
            <h3 style={sectionTitle}>Usage by Room</h3>
            <div style={{ height: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roomUsageSummary}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,39,68,0.1)" />
                  <XAxis dataKey="room" tick={{ fontSize: 12, fill: '#0f2744' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#0f2744' }} />
                  <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '0.8rem' }} />
                  <Bar dataKey="count" fill="#0f2744" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── SEARCH & FILTER ── */}
          <div style={{ ...card, marginBottom: '16px' }}>
            <h3 style={sectionTitle}>Search & Filter Logs</h3>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0f2744', marginBottom: '5px' }}>Search</label>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search professor, subject, or room" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0f2744', marginBottom: '5px' }}>Filter</label>
                <select value={filterMode} onChange={(e) => setFilterMode(e.target.value)} style={{ ...inputStyle, width: '100%' }} className="sm:w-auto">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom Date</option>
                </select>
              </div>
              <button onClick={fetchLogs} className="w-full sm:w-auto" style={{ background: '#c9a84c', color: '#fff', border: 'none', borderRadius: '10px', padding: '9px 22px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Apply
              </button>
            </div>
            {filterMode === 'custom' && (
              <div className="grid gap-3 sm:grid-cols-2" style={{ marginTop: '12px' }}>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
              </div>
            )}
          </div>

          {/* ── USAGE LOGS + PROFESSOR SUMMARY ── */}
          <div className="grid gap-4 lg:grid-cols-3">

            {/* Usage Logs */}
            <div style={{ ...card }} className="lg:col-span-2">
              <h3 style={sectionTitle}>Usage Logs</h3>

              {/* Mobile card view */}
              <div className="sm:hidden" style={{ flexDirection: 'column', gap: '10px', maxHeight: '480px', overflowY: 'auto', paddingRight: '2px' }}>
                {loading ? (
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Loading…</p>
                ) : logs.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>No usage records found.</p>
                ) : logs.map((log) => (
                  <div key={log.id} style={{ border: '1px solid rgba(15,39,68,0.12)', borderRadius: '12px', padding: '12px', background: 'rgba(255,255,255,0.6)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f2744' }}>{log.professor_name_snapshot}</span>
                      <span style={{ background: 'rgba(15,39,68,0.08)', borderRadius: '999px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 600, color: '#0f2744', whiteSpace: 'nowrap' }}>{log.room_number}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px' }}>{log.subject}</p>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '6px', lineHeight: 1.6 }}>
                      <div><strong style={{ color: '#0f2744' }}>Start:</strong> {formatDateTime(log.start_time)}</div>
                      <div><strong style={{ color: '#0f2744' }}>End:</strong> {formatDateTime(log.end_time)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                      <button onClick={() => openEdit(log)} style={{ flex: 1, background: '#c9a84c', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 0', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => handleEndNow(log.id)} style={{ flex: 1, background: '#0f2744', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 0', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>End</button>
                      <button onClick={() => handleDelete(log.id)} style={{ flex: 1, background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 0', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block" style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto', borderRadius: '12px', border: '1px solid rgba(15,39,68,0.1)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr style={{ background: '#eef1f6' }}>
                      {['Professor', 'Subject', 'Room', 'Start', 'End', 'Actions'].map((h) => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#0f2744', whiteSpace: 'nowrap', borderBottom: '2px solid rgba(201,168,76,0.4)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan="6" style={{ padding: '14px', color: '#64748b' }}>Loading…</td></tr>
                    ) : logs.length === 0 ? (
                      <tr><td colSpan="6" style={{ padding: '14px', color: '#64748b' }}>No usage records found.</td></tr>
                    ) : logs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid rgba(15,39,68,0.08)' }}>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#0f2744', fontWeight: 600 }}>{log.professor_name_snapshot}</td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#374151' }}>{log.subject}</td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#374151' }}>{log.room_number}</td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#374151' }}>{formatDateTime(log.start_time)}</td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#374151' }}>{formatDateTime(log.end_time)}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button onClick={() => openEdit(log)} style={{ background: '#c9a84c', color: '#fff', border: 'none', borderRadius: '7px', padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                            <button onClick={() => handleEndNow(log.id)} style={{ background: '#0f2744', color: '#fff', border: 'none', borderRadius: '7px', padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>End</button>
                            <button onClick={() => handleDelete(log.id)} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: '7px', padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Professor Usage Summary */}
            <div style={card}>
              <h3 style={sectionTitle}>Professor Usage Summary</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                {professorSummary.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>No summary available.</p>
                ) : professorSummary.map(([name, count]) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(15,39,68,0.1)', borderRadius: '10px', padding: '10px 14px', background: 'rgba(255,255,255,0.5)' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f2744', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }}>{name}</span>
                    <span style={{ background: '#0f2744', color: '#c9a84c', borderRadius: '999px', padding: '3px 12px', fontSize: '0.78rem', fontWeight: 700, flexShrink: 0 }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>{/* /maxWidth wrapper */}
      </div>{/* /background */}

      {/* ── EDIT MODAL ── */}
      {editingLog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '480px', background: '#fff', borderRadius: '20px', padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ height: '4px', background: '#c9a84c', borderRadius: '4px', marginBottom: '18px' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f2744', marginBottom: '16px' }}>Edit Usage Log</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" value={editForm.subject} onChange={(e) => setEditForm((p) => ({ ...p, subject: e.target.value }))} placeholder="Subject" style={inputStyle} />
              <select value={editForm.room_number} onChange={(e) => setEditForm((p) => ({ ...p, room_number: e.target.value }))} style={inputStyle}>
                {rooms.map((room) => <option key={room.id} value={room.room_number}>{room.room_number}</option>)}
              </select>
              <input type="datetime-local" value={editForm.start_time} onChange={(e) => setEditForm((p) => ({ ...p, start_time: e.target.value }))} style={inputStyle} />
              <input type="datetime-local" value={editForm.end_time} onChange={(e) => setEditForm((p) => ({ ...p, end_time: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setEditingLog(null)} style={{ background: 'transparent', border: '1.5px solid #d1d5db', borderRadius: '10px', padding: '9px 18px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', color: '#374151' }}>Cancel</button>
              <button onClick={saveEdit} style={{ background: '#0f2744', color: '#fff', border: 'none', borderRadius: '10px', padding: '9px 20px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
