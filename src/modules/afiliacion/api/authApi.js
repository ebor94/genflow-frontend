import apiClient from './axios'

export const login = (credentials) => apiClient.post('/auth/login', credentials)
