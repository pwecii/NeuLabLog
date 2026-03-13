import React, { useEffect, useRef, useState } from 'react'
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode'

export default function QrLoginBox({ onQrLogin, loading }) {
  const [showScanner, setShowScanner] = useState(false)
  const [scannerError, setScannerError] = useState('')
  const [uploading, setUploading] = useState(false)

  const scannerRef = useRef(null)
  const fileScannerRef = useRef(null)
  const fileInputRef = useRef(null)

  const regionId = 'professor-qr-scanner'
  const fileRegionId = 'professor-qr-file-reader'

  const safeClear = async (instance) => {
    if (!instance || typeof instance.clear !== 'function') return
    try {
      await instance.clear()
    } catch (_) {}
  }

  useEffect(() => {
    if (!showScanner) return

    let mounted = true

    try {
      const scanner = new Html5QrcodeScanner(
        regionId,
        {
          fps: 10,
          qrbox: { width: 180, height: 180 },
          rememberLastUsedCamera: true,
        },
        false
      )

      scannerRef.current = scanner

      scanner.render(
        async (decodedText) => {
          await safeClear(scannerRef.current)
          if (mounted) {
            onQrLogin(decodedText.trim())
          }
        },
        () => {}
      )
    } catch (err) {
      console.error('QR scanner init error:', err)
      setScannerError(err?.message || 'Unable to start camera scanner.')
    }

    return () => {
      mounted = false
      safeClear(scannerRef.current)
      safeClear(fileScannerRef.current)
    }
  }, [showScanner, onQrLogin])

  const handleToggleScanner = () => {
    setScannerError('')
    if (showScanner) {
      safeClear(scannerRef.current)
    }
    setShowScanner((prev) => !prev)
  }

  const handleUploadClick = () => {
    setScannerError('')
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setScannerError('')
    setUploading(true)

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file containing a QR code.')
      }

      if (!fileScannerRef.current) {
        fileScannerRef.current = new Html5Qrcode(fileRegionId)
      }

      const decodedText = await fileScannerRef.current.scanFile(file, true)
      onQrLogin(decodedText.trim())
    } catch (err) {
      console.error('QR upload scan error:', err)
      setScannerError(
        err?.message || 'Unable to read QR code from uploaded image.'
      )
    } finally {
      setUploading(false)
      e.target.value = ''
      await safeClear(fileScannerRef.current)
    }
  }

  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {/* Header row — navy accent */}
      <div
        style={{
          background: '#0f2744',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* QR icon */}
          <div
            style={{
              background: 'rgba(201,168,76,0.2)',
              border: '1px solid #c9a84c',
              borderRadius: '8px',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="3" height="3" />
              <line x1="18" y1="14" x2="21" y2="14" />
              <line x1="18" y1="17" x2="21" y2="17" />
              <line x1="18" y1="20" x2="21" y2="20" />
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#ffffff' }}>
              QR Code Login
            </p>
            <p style={{ margin: 0, fontSize: '11px', color: '#93c5fd' }}>
              Scan your professor ID QR code
            </p>
          </div>
        </div>

        {/* Toggle button */}
        <button
          type="button"
          onClick={handleToggleScanner}
          disabled={loading}
          style={{
            background: showScanner ? '#c9a84c' : 'rgba(255,255,255,0.1)',
            border: '1px solid',
            borderColor: showScanner ? '#c9a84c' : 'rgba(255,255,255,0.25)',
            borderRadius: '8px',
            color: showScanner ? '#0f2744' : '#ffffff',
            fontWeight: '600',
            fontSize: '12px',
            cursor: 'pointer',
            padding: '6px 14px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            transition: 'all 0.2s',
          }}
        >
          {showScanner ? '✕ Hide' : 'Scan QR'}
        </button>
      </div>

      {/* Expandable scanner section */}
      {showScanner && (
        <div style={{ padding: '14px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {scannerError && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                color: '#b91c1c',
              }}
            >
              {scannerError}
            </div>
          )}

          {/* Upload button */}
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={loading || uploading}
            style={{
              width: '100%',
              background: '#1e3a5f',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '9px 16px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              opacity: loading || uploading ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {uploading ? 'Scanning Image...' : 'Upload QR Code Image'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Camera scanner */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '8px',
              overflow: 'hidden',
            }}
          >
            <div id={regionId} className="min-h-[220px] w-full sm:min-h-[260px]" />
          </div>

          {loading && (
            <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
              Checking QR code...
            </p>
          )}
        </div>
      )}

      <div id={fileRegionId} className="hidden" />
    </div>
  )
}