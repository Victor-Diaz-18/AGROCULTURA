import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { EMPTY_STATS, FALLBACK_CONFIG } from '../config/constants.js'
import useConnectivity from '../hooks/useConnectivity.js'
import { fetchConfig, fetchStats } from '../services/config.js'
import { OfflineError } from '../services/http.js'

/**
 * Portal-wide data every page needs: configuration (name, sectors, tags) and the
 * public counters. It reloads when the connection comes back, and keeps showing
 * the last known values (or safe defaults) while offline.
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

  const reload = useCallback(async () => {
    try {
      const [nextConfig, nextStats] = await Promise.all([fetchConfig(), fetchStats()])
      setConfig(nextConfig)
      setStats(nextStats)
      setStatus('ready')
    } catch (error) {
      setStatus(error instanceof OfflineError ? 'offline' : 'error')
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
