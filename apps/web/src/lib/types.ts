/** Tipos del dominio compartidos (alineados con Yggdra / docs/api-map.md). */

export type ID = number | string;

export interface User {
  id: ID;
  email: string;
  first_name?: string;
  last_name?: string;
  type_user?: string;
  is_multi_branch?: boolean;
  branch_assignments?: BranchAssignment[];
}

export interface BranchAssignment {
  id?: ID;
  branch?: ID;
  role?: ID | string;
  [key: string]: unknown;
}

export interface Branch {
  /** ID real de la sucursal — el que se envía en X-Branch-ID. */
  branch_id: ID;
  branch_name?: string;
  business_name?: string;
  commercial_business?: string;
  role_code?: string;
  role_name?: string;
  is_active?: boolean;
  assigned_at?: string | null;
  /** id de la asignación BranchUser (login_complete). */
  id?: ID;
  owner?: { id: ID; username?: string; full_name?: string } | null;
  [key: string]: unknown;
}

export function branchName(branch: Branch): string {
  return (
    branch.business_name ||
    branch.branch_name ||
    branch.commercial_business ||
    `Sucursal ${branch.branch_id}`
  );
}

export interface Organization {
  id: ID;
  slug?: string;
  name: string;
  [key: string]: unknown;
}

export interface BranchThemeConfig {
  id?: ID;
  branch?: ID;
  app_name?: string;
  tagline?: string;
  logo?: string | null;
  favicon?: string | null;
  banner?: string | null;
  primary_color?: string;
  secondary_color?: string;
  algorithm?: "light" | "dark" | "auto";
  motion?: boolean;
  compact?: boolean;
  borderRadius?: number;
  font_size?: string;
  social_links?: Record<string, string>;
  login_welcome_message?: string;
  [key: string]: unknown;
}

/** Respuesta de `POST /api/accounts/users/login_complete/`. */
export interface LoginCompleteResponse {
  token: string;
  user: User;
  branches: Branch[];
  owned_organizations?: Organization[];
  permissions?: {
    enabled_apps?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface LoginPayload {
  email: string;
  password: string;
  [key: string]: unknown;
}

/** Envoltura de listas paginadas de DRF. */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}