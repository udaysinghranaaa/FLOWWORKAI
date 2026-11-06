import { createContext } from 'react'
import type { DemoRepository } from '@/services/demo-repository'
export const DemoContext = createContext<DemoRepository | null>(null)
