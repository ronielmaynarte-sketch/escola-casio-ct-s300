import { useCallback, useEffect, useState } from 'react'
import { lerConfig, salvarConfig } from './armazenamento'
import type { Configuracoes } from './armazenamento'

export function useConfig(): [Configuracoes, (p: Partial<Configuracoes>) => void] {
  const [c, setC] = useState<Configuracoes>(() => lerConfig())
  useEffect(() => {
    const f = () => setC(lerConfig())
    window.addEventListener('treino-config', f)
    return () => window.removeEventListener('treino-config', f)
  }, [])
  const mudar = useCallback((p: Partial<Configuracoes>) => {
    const novo = { ...lerConfig(), ...p }
    salvarConfig(novo)
    setC(novo)
  }, [])
  return [c, mudar]
}
