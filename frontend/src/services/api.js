import axios from 'axios';

// Set base URL for API queries
const API = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 10000,
});

// Interceptor to inject JWT token automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Authentication
export const login = async (username, password) => {
  const res = await API.post('/auth/login', { username, password });
  if (res.data.token) {
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify({ username: res.data.username, role: res.data.role }));
  }
  return res.data;
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const getCurrentUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

// Recipients (Off-chain)
export const getRecipients = async () => {
  const res = await API.get('/recipient');
  return res.data;
};

export const registerRecipient = async (data) => {
  const res = await API.post('/recipient', data);
  return res.data;
};

export const getRecipientDetails = async (recipientID) => {
  const res = await API.get(`/recipient/${recipientID}`);
  return res.data;
};

// ZKP & Eligibility
export const verifyZKP = async (recipientID, proof, publicSignals) => {
  const res = await API.post('/eligibility/verify', { recipientID, proof, publicSignals });
  return res.data;
};

// Distribution (Bank Org)
export const distributeFunds = async (recipientID) => {
  const res = await API.post('/distribution', { recipientID });
  return res.data;
};

// Auditing (History, On-chain State, Block Visualizer)
export const getRecipientHistory = async (recipientID) => {
  const res = await API.get(`/audit/history/${recipientID}`);
  return res.data;
};

export const getRecipientState = async (recipientID) => {
  const res = await API.get(`/audit/state/${recipientID}`);
  return res.data;
};

export const getBlocks = async () => {
  const res = await API.get('/audit/blocks');
  return res.data;
};

export const getSystemStatus = async () => {
  const res = await axios.get('http://localhost:5000/api/status');
  return res.data;
};
