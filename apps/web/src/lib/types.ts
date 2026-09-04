/** Tipos del dominio compartidos (alineados con Yggdra / docs/api-map.md). */

export type ID = number | string;

export type User = UserResponse;

export interface BranchAssignment {
  id?: ID;
  branch_id?: ID;
  branch?: ID;
  branch_name?: string;
  role?: ID | string;
  role_code?: string;
  role_name?: string;
  station_id?: ID | null;
  station_name?: string | null;
  is_active?: boolean;
  is_default?: boolean;
  assigned_at?: string | null;
  [key: string]: unknown;
}

export interface BranchThemeConfigInline {
  id?: ID;
  app_name?: string;
  logo?: string | null;
  favicon?: string | null;
  banner_image?: string | null;
  primary_color?: string;
  secondary_color?: string;
  algorithm?: "light" | "dark";
  [key: string]: unknown;
}

export interface Branch {
  /** ID real de la sucursal — el que se envía en X-Branch-ID. */
  branch_id: ID;
  branch_name?: string;
  business_name?: string;
  fantasy_name?: string;
  commercial_business?: string;
  phone?: string;
  dni?: string;
  email?: string;
  region?: string;
  province?: string;
  commune?: string;
  address?: string;
  logo?: string | null;
  role_code?: string;
  role_name?: string;
  is_active?: boolean;
  assigned_at?: string | null;
  /** id de la asignación BranchUser (login_complete). */
  id?: ID;
  station_id?: ID | null;
  station_name?: string | null;
  owner?: ID | null;
  owner_id?: ID | null;
  organization?: ID | null;
  organization_name?: string | null;
  plan?: ID | null;
  plan_name?: string | null;
  plan_expiration_date?: string | null;
  users_count?: number;
  users_by_role?: Record<string, number>;
  can_manage?: boolean;
  theme_config?: BranchThemeConfigInline | null;
  [key: string]: unknown;
}

export interface BranchPayload {
  business_name: string;
  fantasy_name?: string;
  commercial_business?: string;
  phone?: string;
  dni?: string;
  email?: string;
  region?: string;
  province?: string;
  commune?: string;
  address?: string;
  logo?: string | null;
  is_active?: boolean;
  owner_id?: ID | null;
  plan?: ID | null;
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

export interface UserResponse {
  id: ID;
  username?: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  dni?: string;
  type_user?: string;
  is_superuser?: boolean;
  is_staff?: boolean;
  is_active?: boolean;
  is_multi_branch?: boolean;
  last_login?: string;
  created?: string;
  branch_access?: BranchAssignment;
  branch_assignments?: BranchAssignment[];
  assigned_product?: ID | null;
  [key: string]: unknown;
}

export interface BranchUser {
  id: ID;
  user: ID;
  user_name?: string;
  user_email?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  username?: string;
  branch: ID;
  branch_name?: string;
  role_definition: ID;
  role_code?: string;
  role_name?: string;
  is_active?: boolean;
  invited_by?: ID | null;
  invited_by_name?: string | null;
  invited_at?: string;
  is_default?: boolean;
  can_access_other_branches?: boolean;
  created?: string;
  [key: string]: unknown;
}

export interface RoleDefinition {
  id: ID;
  name: string;
  code: string;
  description?: string;
  permissions?: { module: string; read: boolean; write: boolean }[];
  is_system?: boolean;
  hierarchy_level?: number;
  [key: string]: unknown;
}

export interface UserPayload {
  user_data: {
    email: string;
    first_name: string;
    last_name: string;
    dni: string;
    password?: string;
    is_multi_branch?: boolean;
  };
  branch_assignment: {
    branch_id: ID;
    role: string;
    is_active?: boolean;
  } | null;
}

export interface UserUpdatePayload {
  first_name?: string;
  last_name?: string;
  email?: string;
  dni?: string;
  password?: string;
}

/** Respuesta de `POST /api/accounts/users/login_complete/`. */
export interface LoginCompleteResponse {
  token: string;
  /** Solo usuarios demo: ISO datetime en que expira la sesión (1 hora). */
  demo_expires_at?: string | null;
  user: User;
  branches: Branch[];
  owned_organizations?: Organization[];
  permissions?: {
    user_role?: string;
    enabled_apps?: string[];
    read_only_apps?: string[];
    disabled_apps?: string[];
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