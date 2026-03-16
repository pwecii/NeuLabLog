import React, { useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import { isNeuEmail } from './utils/auth'
import LoginPage from './components/LoginPage'
import ProfessorDashboard from './components/ProfessorDashboard'
import AdminDashboard from './components/AdminDashboard'
import QRCode from 'qrcode'

export default function App() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [viewAsProf, setViewAsProf] = useState(false)
  const [qrProfessorProfile, setQrProfessorProfile] = useState(() => {
    try {
      const stored = sessionStorage.getItem('qr_professor_profile')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })

  // ── ADMIN EMAIL LIST ──
  // Add any email here to automatically assign admin role on first login.
  const ADMIN_EMAILS = [
    'jcesperanza@neu.edu.ph',
    // 'another.admin@neu.edu.ph',
  ]

  const buildOrFetchProfile = async (user) => {
    const email     = user?.email || ''
    const fullName  = user?.user_metadata?.full_name || user?.user_metadata?.name || email
    const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || ''
    const qrCodeValue = `NEU-PROF-${user.id}`

    const generateQrPng = () =>
      QRCode.toDataURL(qrCodeValue, { width: 260, margin: 2 })

    const { data: existing, error: fetchErr } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, avatar_url, qr_code_value, qr_code_png, created_at')
      .eq('id', user.id)
      .maybeSingle()

    if (fetchErr) throw fetchErr

    if (!existing) {
      const qr_code_png = await generateQrPng()
      const { error: insertErr } = await supabase.from('profiles').insert({
        id: user.id, email, full_name: fullName, avatar_url: avatarUrl,
        role: ADMIN_EMAILS.includes(email) ? 'admin' : 'professor', qr_code_value: qrCodeValue, qr_code_png,
      })
      if (insertErr) throw insertErr

      const { data: fresh, error: freshErr } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, avatar_url, qr_code_value, qr_code_png, created_at')
        .eq('id', user.id).single()
      if (freshErr) throw freshErr
      return fresh
    }

    // Update name/avatar and fill missing QR fields
    const patch = { full_name: fullName, avatar_url: avatarUrl }
    if (!existing.qr_code_value) patch.qr_code_value = qrCodeValue
    if (!existing.qr_code_png)   patch.qr_code_png   = await generateQrPng()
    // Upgrade to admin if email is in the admin list (even if already exists as professor)
    if (ADMIN_EMAILS.includes(email) && existing.role !== 'admin') patch.role = 'admin'

    const { error: updateErr } = await supabase
      .from('profiles').update(patch).eq('id', user.id)
    if (updateErr) throw updateErr

    return { ...existing, ...patch }
  }

  useEffect(() => {
    // The ONLY way we handle auth — listen to onAuthStateChange.
    // On page load Supabase fires INITIAL_SESSION with the stored session
    // (or null if logged out). This is more reliable than getSession()
    // because it's guaranteed to fire exactly once before any other event.

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AUTH EVENT:', event, session?.user?.email)

        // Ignore token refreshes — no need to re-fetch profile
        if (event === 'TOKEN_REFRESHED') return

        // SIGNED_OUT — clear everything
        if (event === 'SIGNED_OUT') {
          sessionStorage.removeItem('qr_professor_profile')
          setProfile(null)
          setQrProfessorProfile(null)
          setLoading(false)
          return
        }

        // INITIAL_SESSION fires on every page load with the persisted session.
        // SIGNED_IN fires after OAuth redirect (fresh login).
        // Both cases: if there's a user, load their profile.
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          if (!session?.user) {
            // No session → show login
            setProfile(null)
            setLoading(false)
            return
          }

          try {
            if (!isNeuEmail(session.user.email)) {
              await supabase.auth.signOut()
              setError('Only @neu.edu.ph institutional emails are allowed.')
              setProfile(null)
              setLoading(false)
              return
            }

            const p = await buildOrFetchProfile(session.user)
            setProfile(p)
            setError('')
          } catch (err) {
            console.error('Profile load error:', err)
            setError(err.message || 'Failed to load profile.')
            setProfile(null)
          } finally {
            setLoading(false)
          }
          return
        }

        // Any other event — just stop loading
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // ── IDLE TIMEOUT: auto-logout after 5 minutes of inactivity ──
  useEffect(() => {
    if (!profile && !qrProfessorProfile) return

    let timeoutId
    const resetTimer = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(logoutUser, 5 * 60 * 1000)
    }

    const events = ['mousemove', 'mousedown', 'click', 'scroll', 'keydown', 'touchstart']
    events.forEach((e) => window.addEventListener(e, resetTimer))
    resetTimer()

    return () => {
      clearTimeout(timeoutId)
      events.forEach((e) => window.removeEventListener(e, resetTimer))
    }
  }, [profile, qrProfessorProfile])

  const logoutUser = async () => {
    sessionStorage.removeItem('qr_professor_profile')
    setQrProfessorProfile(null)
    setProfile(null)
    await supabase.auth.signOut()
  }

  const handleQrProfessorLogin = async (qrValue) => {
    const { data, error } = await supabase.rpc('find_professor_by_qr', {
      input_qr: (qrValue || '').trim(),
    })
    if (error) throw new Error(error.message || 'Failed to verify QR code.')
    if (!data || data.length === 0)
      throw new Error(`QR code not recognized: ${qrValue}`)
    sessionStorage.setItem('qr_professor_profile', JSON.stringify(data[0]))
    setQrProfessorProfile(data[0])
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex', minHeight: '100vh',
        alignItems: 'center', justifyContent: 'center',
        background: '#f8fafc',
      }}>
        <div style={{
          borderRadius: '16px', border: '1px solid #e2e8f0',
          background: '#fff', padding: '16px 28px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          fontSize: '14px', color: '#475569',
        }}>
          Loading…
        </div>
      </div>
    )
  }

  const activeProfessor = qrProfessorProfile || (profile?.role === 'professor' ? profile : null)
  const activeAdmin     = profile?.role === 'admin' && !viewAsProf ? profile : null
  const adminViewingAsProf = profile?.role === 'admin' && viewAsProf ? profile : null

  return (
    <div style={{ minHeight: '100vh', width: '100vw', overflowX: 'hidden' }}>
      {error && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 100, background: '#fef2f2', border: '1px solid #fca5a5',
          borderRadius: '12px', padding: '10px 20px', color: '#b91c1c',
          fontSize: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          whiteSpace: 'nowrap',
        }}>
          {error}
        </div>
      )}

      {!activeProfessor && !activeAdmin && !adminViewingAsProf ? (
        <LoginPage onQrProfessorLogin={handleQrProfessorLogin} />
      ) : activeAdmin ? (
        <AdminDashboard
          profile={activeAdmin}
          onLogout={logoutUser}
          onSwitchView={() => setViewAsProf(true)}
        />
      ) : adminViewingAsProf ? (
        <ProfessorDashboard
          profile={adminViewingAsProf}
          isQrMode={false}
          onLogout={logoutUser}
          onBackToAdmin={() => setViewAsProf(false)}
        />
      ) : (
        <ProfessorDashboard
          profile={activeProfessor}
          isQrMode={!!qrProfessorProfile}
          onLogout={logoutUser}
        />
      )}
    </div>
  )
}
