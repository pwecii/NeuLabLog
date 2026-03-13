import React, { useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import { isNeuEmail } from './utils/auth'
import LoginPage from './components/LoginPage'
import ProfessorDashboard from './components/ProfessorDashboard'
import AdminDashboard from './components/AdminDashboard'
import QRCode from 'qrcode'

export default function App() {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [qrProfessorProfile, setQrProfessorProfile] = useState(null)

  const isInitializingRef = useRef(false)
  const isMountedRef = useRef(true)

  const buildOrFetchProfile = async (user) => {
    console.log('buildOrFetchProfile START', user)

    const email = user?.email || ''
    const fullName =
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      email

    const avatarUrl =
      user?.user_metadata?.avatar_url ||
      user?.user_metadata?.picture ||
      ''

    const qrCodeValue = `NEU-PROF-${user.id}`

    const generateQrPng = async () => {
      return await QRCode.toDataURL(qrCodeValue, {
        width: 260,
        margin: 2,
      })
    }

    const { data: existingProfile, error: existingError } = await supabase
      .from('profiles')
      .select(
        'id, email, full_name, role, avatar_url, qr_code_value, qr_code_png, created_at'
      )
      .eq('id', user.id)
      .maybeSingle()

    console.log('existingProfile result:', existingProfile, existingError)

    if (existingError) throw existingError

    if (!existingProfile) {
      const qrCodePng = await generateQrPng()

      const { error: insertError } = await supabase.from('profiles').insert({
        id: user.id,
        email,
        full_name: fullName,
        avatar_url: avatarUrl,
        role: 'professor',
        qr_code_value: qrCodeValue,
        qr_code_png: qrCodePng,
      })

      console.log('insert profile result:', insertError)

      if (insertError) throw insertError

      const { data: insertedProfile, error: insertedError } = await supabase
        .from('profiles')
        .select(
          'id, email, full_name, role, avatar_url, qr_code_value, qr_code_png, created_at'
        )
        .eq('id', user.id)
        .single()

      console.log('fetch inserted profile result:', insertedProfile, insertedError)

      if (insertedError) throw insertedError
      return insertedProfile
    }

    const updatePayload = {
      full_name: fullName,
      avatar_url: avatarUrl,
    }

    if (!existingProfile.qr_code_value) {
      updatePayload.qr_code_value = qrCodeValue
    }

    if (!existingProfile.qr_code_png) {
      updatePayload.qr_code_png = await generateQrPng()
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', user.id)

      console.log('update profile result:', updateError)

      if (updateError) throw updateError
    }

    return {
      ...existingProfile,
      ...updatePayload,
    }
  }

  const initializeFromSession = async (currentSession) => {
    if (isInitializingRef.current) {
      console.log('initializeFromSession skipped: already running')
      return
    }

    isInitializingRef.current = true
    setLoading(true)
    setError('')

    try {
      setSession(currentSession)

      if (!currentSession?.user) {
        setProfile(null)
        return
      }

      if (!isNeuEmail(currentSession.user.email)) {
        await supabase.auth.signOut()
        throw new Error(
          'Only institutional emails ending with @neu.edu.ph are allowed.'
        )
      }

      const p = await buildOrFetchProfile(currentSession.user)

      if (!isMountedRef.current) return
      setProfile(p)
    } catch (err) {
      console.error('INITIALIZE ERROR:', err)
      if (!isMountedRef.current) return
      setError(err.message || 'Failed to initialize app.')
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
      isInitializingRef.current = false
    }
  }

useEffect(() => {
  let mounted = true

  const initializeFromSession = async (currentSession) => {
    if (!mounted) return

    setLoading(true)
    setError('')

    try {
      setSession(currentSession)

      if (!currentSession?.user) {
        setProfile(null)
        return
      }

      if (!isNeuEmail(currentSession.user.email)) {
        await supabase.auth.signOut()
        throw new Error(
          'Only institutional emails ending with @neu.edu.ph are allowed.'
        )
      }

      const p = await buildOrFetchProfile(currentSession.user)

      if (!mounted) return
      setProfile(p)
    } catch (err) {
      console.error('INITIALIZE ERROR:', err)
      if (!mounted) return
      setError(err.message || 'Failed to initialize app.')
    } finally {
      if (mounted) {
        setLoading(false)
      }
    }
  }


  const start = async () => {
    console.log('BOOTSTRAP START')

    try {
      const { data, error: sessionError } = await supabase.auth.getSession()

      console.log('GET SESSION RESULT:', data, sessionError)

      if (sessionError) throw sessionError

      await initializeFromSession(data.session)
    } catch (err) {
      console.error('BOOTSTRAP ERROR:', err)
      if (!mounted) return
      setError(err.message || 'Failed to initialize app.')
      setLoading(false)
    }
  }

  start()

  const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
    console.log('AUTH STATE CHANGED:', event, newSession)

    if (!mounted) return

    if (event === 'TOKEN_REFRESHED') {
      setSession(newSession)
      return
    }

    if (event === 'INITIAL_SESSION') {
      return
    }

    setTimeout(() => {
      initializeFromSession(newSession)
    }, 0)
  })

  return () => {
    mounted = false
    listener.subscription.unsubscribe()
  }
}, [])
const logoutUser = async () => {
    setQrProfessorProfile(null)
    setProfile(null)
    setSession(null)
    await supabase.auth.signOut()
  }
useEffect(() => {
    if (!profile && !qrProfessorProfile) return

    let timeoutId

    const resetIdleTimer = () => {
      clearTimeout(timeoutId)

      timeoutId = setTimeout(() => {
        logoutUser()
      }, 5 * 60 * 1000) // 5 minutes
    }

    const events = [
      'mousemove',
      'mousedown',
      'click',
      'scroll',
      'keydown',
      'touchstart',
    ]

    events.forEach((event) => {
      window.addEventListener(event, resetIdleTimer)
    })

    resetIdleTimer()

    return () => {
      clearTimeout(timeoutId)

      events.forEach((event) => {
        window.removeEventListener(event, resetIdleTimer)
      })
    }
  }, [profile, qrProfessorProfile])
  
  const handleLogout = async () => {
    await logoutUser()
  }

  const handleQrProfessorLogin = async (qrValue) => {
    const normalizedQrValue = (qrValue || '').trim()

    console.log('SCANNED QR VALUE:', normalizedQrValue)

    const { data, error } = await supabase.rpc('find_professor_by_qr', {
      input_qr: normalizedQrValue,
    })

    console.log('QR LOGIN RESULT:', data, error)

    if (error) {
      throw new Error(error.message || 'Failed to verify QR code.')
    }

    if (!data || data.length === 0) {
      throw new Error(`QR code not recognized: ${normalizedQrValue}`)
    }

    setQrProfessorProfile(data[0])
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          Loading...
        </div>
      </div>
    )
  }

  const activeProfessor =
    qrProfessorProfile || (profile?.role === 'professor' ? profile : null)

  const activeAdmin = profile?.role === 'admin' ? profile : null

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {!activeProfessor && !activeAdmin ? (
          <LoginPage onQrProfessorLogin={handleQrProfessorLogin} />
        ) : activeAdmin ? (
          <AdminDashboard profile={activeAdmin} onLogout={handleLogout} />
        ) : (
          <ProfessorDashboard
            profile={activeProfessor}
            isQrMode={!!qrProfessorProfile}
            onLogout={handleLogout}
          />
        )}
      </div>
    </div>
  )
}