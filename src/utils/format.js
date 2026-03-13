export function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  return date.toLocaleString()
}

export function formatTimeRange(start, end) {
  if (!start || !end) return '-'

  const s = new Date(start).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  const e = new Date(end).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return `${s} - ${e}`
}

export function todayInputDate() {
  return new Date().toISOString().slice(0, 10)
}