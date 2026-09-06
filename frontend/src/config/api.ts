const rawApiUrl =
  import.meta.env.VITE_API_URL ||
  'https://revenuetreasury-production.up.railway.app';


const sanitizedApiUrl = rawApiUrl.replace(/^VITE_API_URL=/, '');

export const API_BASE_URL = sanitizedApiUrl.replace(/\/+$/, '');


export async function loginUser(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to authenticate');
  }

  return data;
}