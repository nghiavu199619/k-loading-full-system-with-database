// Centralized JWT configuration
export const JWT_SECRET = process.env.JWT_SECRET || 'k-loading-super-secret-key-2025';
export const JWT_EXPIRES_IN = '24h';

console.log('🔑 JWT Configuration loaded with secret:', JWT_SECRET.substring(0, 10) + '...');