import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { EMPTY_STATS, FALLBACK_CONFIG } from '../config/constants.js'
import useConnectivity from '../hooks/useConnectivity.js'
import { cacheGet, cacheSet } from '../offline/store.js'
import { fetchConfig, fetchStats } from '../services/config.js'
import { OfflineError } from '../services/http.js'

/**
 * Portal-wide data every page needs: configuration (name, sectors, tags) and the
 * public counters. It reloads when the connection comes back, and keeps showing
 * the last known values while offline: they are kept on the phone, so even a visit
 * that starts without signal has the sectors and tags the form needs (F10). Only the
 * very first visit ever, with no signal, falls back to safe defaults.
 */

const PortalDataContext = createContext({
  config: FALLBACK_CONFIG,
  stats: EMPTY_STATS,
  status: 'loading',
  reload: () => {},
})

export function PortalDataProvider({ children }) {
  const { online } = useConnectivity()
  const [config, setConfig] = useState(FALLBACK_CONFIG)
  const [stats, setStats] = useState(EMPTY_STATS)
  const [status, setStatus] = useState('loading') // loading | ready | offline | error
  const fresh = useRef(false) // the server already answered in this visit: the saved copy is older
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const reload = useCallback(async () => {
    try {
      const [nextConfig, nextStats] = await Promise.all([fetchConfig(), fetchStats()])
      if (!mounted.current) return // the answer came after the page was gone
      fresh.current = true
      setConfig(nextConfig)
      setStats(nextStats)
      setStatus('ready')
      cacheSet('portal', { config: nextConfig, stats: nextStats })
    } catch (error) {
      if (mounted.current) setStatus(error instanceof OfflineError ? 'offline' : 'error')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    cacheGet('portal').then((saved) => {
      if (cancelled || fresh.current || !saved) return
      setConfig(saved.config)
      setStats(saved.stats)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (online) reload()
    else setStatus('offline')
  }, [online, reload])

  const value = useMemo(() => ({ config, stats, status, reload }), [config, stats, status, reload])
  return <PortalDataContext.Provider value={value}>{children}</PortalDataContext.Provider>
}

export function usePortalData() {
  return useContext(PortalDataContext)
}
