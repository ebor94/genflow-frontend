import axios from 'axios';

const publicClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/sv',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000
});

export default publicClient;
