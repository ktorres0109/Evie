/** Her name, optional, used to greet her and as the default name a partner sees. */
import { useLiveQuery } from 'dexie-react-hooks'
import { getSetting, removeSetting, setSetting } from '../db/schema'

const KEY = 'profile.name'

export function useOwnerName(): string | undefined {
  return useLiveQuery(async () => (await getSetting(KEY)) ?? '', [])
}

export async function readOwnerName(): Promise<string> {
  return (await getSetting(KEY)) ?? ''
}

export async function saveOwnerName(name: string): Promise<void> {
  const clean = name.trim().slice(0, 30)
  if (clean) await setSetting(KEY, clean)
  else await removeSetting(KEY)
}

/** Time-of-day greeting key for a local hour. */
export function greetingKey(hour: number): 'greet.morning' | 'greet.afternoon' | 'greet.evening' {
  return hour < 12 ? 'greet.morning' : hour < 19 ? 'greet.afternoon' : 'greet.evening'
}
