import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

export function useActionToken() {
  const location = useLocation(),
    navigate = useNavigate()
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token') ?? '')
  useEffect(() => {
    if (location.hash) navigate(location.pathname + location.search, { replace: true })
  }, [location.hash, location.pathname, location.search, navigate])
  return token
}
