import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { isNeuEmail } from '../utils/auth'
import QrLoginBox from './QrLoginBox'
import googleIcon from '../images/icons/google.png'
import backgroundImage from '../images/Background.png'
import neuLogo from '../images/neu.png'

export default function LoginPage({ onQrProfessorLogin }) {
  const [roleTab, setRoleTab] = useState('professor')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGoogleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            hd: 'neu.edu.ph',
            prompt: 'select_account',
          },
        },
      })
    } catch (err) {
      setError(err.message || 'Unable to sign in.')
      setLoading(false)
    }
  }

  const fakeEmailCheck = (email) => {
    if (!isNeuEmail(email)) {
      setError('Only institutional emails ending with @neu.edu.ph are allowed.')
      return false
    }
    return true
  }

  return (
    <div style={{ minHeight: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>

      {/* ── TOP BANNER ── */}
      <div
        style={{
          background: '#0f2744',
          borderBottom: '4px solid #c9a84c',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          minHeight: '72px',
          flexShrink: 0,
        }}
      >
        <img
          src={neuLogo}
          alt="NEU Logo"
          style={{ height: '52px', width: '52px', objectFit: 'contain', flexShrink: 0 }}
        />
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.25)', paddingLeft: '16px' }}>
          <div
            style={{
              fontFamily: "'Kelly Slab', cursive",
              fontSize: 'clamp(16px, 3vw, 24px)',
              fontWeight: '600',
              color: '#ffffff',
              letterSpacing: '0.5px',
              lineHeight: 1.2,
            }}
          >
            NEU LabLog
          </div>
          <div
            style={{
              fontSize: 'clamp(10px, 1.5vw, 12px)',
              color: '#c9a84c',
              letterSpacing: '0.5px',
              marginTop: '2px',
            }}
          >
            New Era University · Laboratory Room Usage System
          </div>
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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1rem',
        }}
      >
        {/* Welcome heading above card */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <h1
            style={{
              fontFamily: "'Kelly Slab', cursive",
              fontSize: 'clamp(30px, 14vw, 44px)',
              fontWeight: '800',
              color: '#0f2744',
              margin: '0 0 6px 0',
              textShadow: '0 1px 3px rgba(255,255,255,0.8)',
            }}
          >
            Welcome, Professor
          </h1>
          <p
            style={{
              fontSize: 'clamp(14px, 2vw, 16px)',
              color: '#1e3a5f',
              fontWeight: '500',
              margin: 0,
              textShadow: '0 1px 3px rgba(255,255,255,0.8)',
            }}
          >
            Please sign in to record your laboratory room usage for today.
          </p>
        </div>

        {/* Login card */}
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.7)',
            boxShadow: '0 8px 40px rgba(15,39,68,0.18)',
            overflow: 'hidden',
          }}
        >
          {/* Card top accent bar */}
          <div style={{ height: '4px', background: '#c9a84c', width: '100%' }} />

          <div style={{ padding: '1.75rem' }}>
            {/* Official system notice */}
            <div
              style={{
                background: '#f0f4f8',
                border: '1px solid #cbd5e1',
                borderLeft: '4px solid #0f2744',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '1.25rem',
                fontSize: '12px',
                color: '#475569',
                lineHeight: 1.6,
              }}
            >
              An official digital system for logging and monitoring the use of
              laboratory facilities. Faculty members may sign in using their
              institutional Google account.
            </div>

            {error && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fca5a5',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  color: '#b91c1c',
                  marginBottom: '1rem',
                }}
              >
                {error}
              </div>
            )}

            {roleTab === 'professor' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <QrLoginBox
                  loading={loading}
                  onQrLogin={async (qrValue) => {
                    setLoading(true)
                    setError('')
                    try {
                      await onQrProfessorLogin(qrValue)
                    } catch (err) {
                      setError(err.message || 'QR login failed.')
                    } finally {
                      setLoading(false)
                    }
                  }}
                />

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                  <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    or sign in with
                  </span>
                  <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                </div>

                {/* Faculty Access */}
                <div>
                  <p
                    style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.8px',
                      margin: '0 0 8px 0',
                    }}
                  >
                    Faculty Access
                  </p>
                  <button
                    onClick={() => {
                      fakeEmailCheck('name@neu.edu.ph')
                      handleGoogleLogin()
                    }}
                    disabled={loading}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    {!loading && (
                      <img src={googleIcon} alt="Google" style={{ height: '16px', width: '16px' }} />
                    )}
                    {loading ? 'Redirecting...' : 'Sign in with Google'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer note */}
        <p
          style={{
            marginTop: '1.25rem',
            fontSize: '13px',
            color: '#1e3a5f',
            textAlign: 'center',
            textShadow: '0 1px 3px rgba(255,255,255,0.8)',
          }}
        >
          For authorized NEU faculty use only · @neu.edu.ph accounts only
        </p>
      </div>
    </div>
  )
}