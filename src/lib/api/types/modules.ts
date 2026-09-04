import type { User } from "@/lib/types";
import type { Branch } from "@/lib/types";
import type { SessionPermissions } from "@/lib/store/session";

/**
 * Tipos propios para endpoints cuyo schema OpenAPI generado no describe
 * correctamente la respuesta (devuelve Record<string, never>).
 * Basados en la guía del backend de FRIG.
 */

export interface FrontendMenuItem {
  href: string;
  label: string;
  icon?: string;
  module?: string;
  badge?: "ordersPending" | "cashOpen" | "kitchenReady";
}

export interface FrontendMenuGroup {
  title: string;
  items: FrontendMenuItem[];
}

export interface FrontendModuleState {
  is_enabled: boolean;
  submodule_config?: Record<string, boolean>;
}

export interface FrontendConfigResponse {
  user: User;
  branches: Branch[];
  current_branch?: Branch;
  role?: string;
  menu: FrontendMenuGroup[];
  modules: Record<string, FrontendModuleState>;
  dashboard?: string;
  feature_flags?: Record<string, boolean>;
  permissions?: SessionPermissions;
}

export interface ModuleCatalogMetadata {
  label: string;
  icon?: string;
  category?: string;
  is_extension?: boolean;
}

export interface ModuleCatalogModule {
  name: string;
  metadata?: ModuleCatalogMetadata;
}

export interface ModuleCatalogComposite {
  name: string;
  optional_submodules: string[];
  required_submodules: string[];
}

export interface ModuleCatalogResponse {
  modules: ModuleCatalogModule[];
  composite_modules: ModuleCatalogComposite[];
  extension_modules: string[];
  metadata: Record<string, ModuleCatalogMetadata>;
}

export interface ProductTypeOption {
  value: string;
  label: string;
}

export interface BranchProductTypesResponse {
  /** Tipos disponibles (formato usado por el endpoint /branches/modules/product-types/). */
  available_product_types: ProductTypeOption[];
  product_types?: ProductTypeOption[];
  default?: string;
  count?: number;
  branch_id?: number;
}

export interface AppAccessResponse {
  allowed: boolean;
  reason?: string;
}

export interface ApplyPlanResponse {
  status: string;
  branch_id: number;
  plan_id: number;
  plan_name: string;
  end_date?: string | null;
  synced?: {
    created: number;
    disabled: number;
    total: number;
  };
}
