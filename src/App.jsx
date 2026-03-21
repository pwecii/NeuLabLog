import React, { useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import { isNeuEmail } from './utils/auth'
import LoginPage from './components/LoginPage'
import ProfessorDashboard from './components/ProfessorDashboard'
import AdminDashboard from './components/AdminDashboard'
import QRCode from 'qrcode'

export default function App() {
  // Start without loading screen if we have any cached profile
  const [loading, setLoading] = useState(() => {
    try {
      const hasProfile = sessionStorage.getItem('cached_profile')
      const hasQr = sessionStorage.getItem('qr_professor_profile')
      return !hasProfile && !hasQr  // false = don't show loading screen
    } catch { return true }
  })
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
    let mounted = true

    // Wraps any promise with a timeout — rejects if it takes too long
    const withTimeout = (promise, ms) =>
      Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection is slow. Please reload.')), ms)
        )
      ])

    const loadProfile = async (user) => {
      if (!mounted) return
      try {
        if (!isNeuEmail(user.email)) {
          await supabase.auth.signOut()
          if (mounted) setError('Only @neu.edu.ph institutional emails are allowed.')
          return
        }
        // Hard 6-second timeout on profile fetch — never hangs forever
        const p = await withTimeout(buildOrFetchProfile(user), 15000)
        if (mounted) {
          setProfile(p)
          setError('')
          // Cache profile so reload is instant
          try { sessionStorage.setItem('cached_profile', JSON.stringify(p)) } catch {}
        }
      } catch (err) {
        console.error('Profile load error:', err)
        if (mounted) { setError(err.message || 'Failed to load profile. Please reload.'); setProfile(null) }
      }
    }

    // ── STEP 1: Show cached profile instantly, then verify session in background
    const cachedProfile = (() => {
      try { return JSON.parse(sessionStorage.getItem('cached_profile') || 'null') } catch { return null }
    })()
    if (cachedProfile) {
      // Show dashboard immediately from cache — no loading screen
      setProfile(cachedProfile)
      setLoading(false)
    }

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!mounted) return
        if (data.session?.user) {
          // If we had a cached profile, update silently in background
          if (cachedProfile) {
            buildOrFetchProfile(data.session.user)
              .then(p => { if (mounted) { setProfile(p); try { sessionStorage.setItem('cached_profile', JSON.stringify(p)) } catch {} } })
              .catch(() => {})
          } else {
            await loadProfile(data.session.user)
          }
        } else {
          // No session — clear cache and show login
          try { sessionStorage.removeItem('cached_profile') } catch {}
          if (mounted) setProfile(null)
        }
      } catch (err) {
        console.error('Session fetch error:', err)
      } finally {
        if (mounted && !cachedProfile) setLoading(false)
      }
    }

    init()

    // ── STEP 2: Listen for auth changes (new login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        console.log('AUTH EVENT:', event)

        if (event === 'TOKEN_REFRESHED') return

        if (event === 'SIGNED_OUT') {
          sessionStorage.removeItem('qr_professor_profile')
          sessionStorage.removeItem('cached_profile')
          setProfile(null)
          setQrProfessorProfile(null)
          setLoading(false)
          return
        }

        // Only act on SIGNED_IN after init() has already finished
        // (INITIAL_SESSION is handled by getSession() above)
        if (event === 'SIGNED_IN' && session?.user) {
          setLoading(true)
          await loadProfile(session.user)
          if (mounted) setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
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
