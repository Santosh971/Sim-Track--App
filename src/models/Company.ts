/**
 * Company Model
 */

export interface Company {
  id: string;
  name: string;
  logo: string | null;
  address: string;
  phone: string;
  email: string;
  website: string;
  plan: 'free' | 'basic' | 'premium' | 'enterprise';
  maxSIMs: number;
  maxUsers: number;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  status: 'active' | 'inactive' | 'suspended';
  subscriptionStatus: 'active' | 'expired' | 'cancelled';
  createdAt: string;
}

/**
 * API response for company details
 */
export interface CompanyResponse {
  success: boolean;
  data: Company;
}

/**
 * Raw API response from backend
 */
export interface RawCompanyResponse {
  _id: string;
  name: string;
  logo: string | null;
  address: string;
  phone: string;
  email: string;
  website: string;
  plan: string;
  maxSIMs: number;
  maxUsers: number;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  status: string;
  subscriptionStatus: string;
  createdAt: string;
}

/**
 * Map raw API response to Company model
 */
export function mapCompanyResponse(raw: RawCompanyResponse): Company {
  return {
    id: raw._id,
    name: raw.name,
    logo: raw.logo,
    address: raw.address || '',
    phone: raw.phone || '',
    email: raw.email || '',
    website: raw.website || '',
    plan: raw.plan as Company['plan'] || 'free',
    maxSIMs: raw.maxSIMs || 10,
    maxUsers: raw.maxUsers || 5,
    subscriptionStartDate: raw.subscriptionStartDate,
    subscriptionEndDate: raw.subscriptionEndDate,
    status: raw.status as Company['status'] || 'active',
    subscriptionStatus: raw.subscriptionStatus as Company['subscriptionStatus'] || 'active',
    createdAt: raw.createdAt,
  };
}