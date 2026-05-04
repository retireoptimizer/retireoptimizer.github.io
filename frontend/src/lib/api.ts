import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

export async function fetchHealth(): Promise<{ status: string; version: string }> {
  const { data } = await apiClient.get('/healthz', { baseURL: '' })
  return data
}
