import { apiFetch } from "./client";
import type {
  BranchUser,
  Paginated,
  UserPayload,
  UserResponse,
  UserUpdatePayload,
} from "@/lib/types";

export interface UsersFilter {
  branch_ids?: string;
  search?: string;
  is_active?: boolean;
  next?: string | null;
  previous?: string | null;
}

/** GET /api/accounts/users/ — listado paginado de usuarios. */
export async function fetchUsers(filter: UsersFilter = {}): Promise<Paginated<UserResponse>> {
  if (filter.next) {
    return apiFetch<Paginated<UserResponse>>(filter.next, { branch: "none" });
  }
  if (filter.previous) {
    return apiFetch<Paginated<UserResponse>>(filter.previous, { branch: "none" });
  }
  const params = new URLSearchParams();
  if (filter.branch_ids) params.set("branch_ids", filter.branch_ids);
  if (filter.search) params.set("search", filter.search);
  if (filter.is_active !== undefined) params.set("is_active", String(filter.is_active));
  const query = params.toString();
  return apiFetch<Paginated<UserResponse>>(`/accounts/users/${query ? `?${query}` : ""}`);
}

/** GET /api/branches/users/ — asignaciones usuario↔sucursal. */
export async function fetchBranchUsers(branchId?: string): Promise<BranchUser[]> {
  const params = new URLSearchParams();
  if (branchId) params.set("branch", branchId);
  const query = params.toString();
  const res = await apiFetch<Paginated<BranchUser>>(`/branches/users/${query ? `?${query}` : ""}`);
  return res.results;
}

/** POST /api/accounts/users/create_and_assign/ */
export async function createAndAssignUser(payload: UserPayload): Promise<{
  user: UserResponse;
  message: string;
  branch_assignment?: {
    branch_id: number;
    branch_name: string;
    role_code: string;
    is_active: boolean;
  };
}> {
  return apiFetch("/accounts/users/create_and_assign/", {
    method: "POST",
    body: payload,
  });
}

/** POST /api/accounts/users/toggle_branch_assignment_status/ */
export async function toggleBranchAssignmentStatus(assignmentId: number): Promise<{
  message: string;
  assignment_id: number;
  is_active: boolean;
  user_is_active: boolean;
}> {
  return apiFetch("/accounts/users/toggle_branch_assignment_status/", {
    method: "POST",
    body: { assignment_id: assignmentId },
  });
}

/** POST /api/accounts/users/{id}/generate-password/ */
export async function generatePassword(userId: number): Promise<{
  message: string;
  new_password: string;
  username: string;
}> {
  return apiFetch(`/accounts/users/${userId}/generate-password/`, {
    method: "POST",
  });
}

/** PATCH /api/accounts/users/{id}/ — editar datos personales. */
export async function updateUser(
  id: number,
  payload: UserUpdatePayload,
): Promise<UserResponse> {
  return apiFetch<UserResponse>(`/accounts/users/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

/** POST /api/accounts/users/change_assignment_role/ */
export async function changeAssignmentRole(
  assignmentId: number,
  role: string,
): Promise<{
  message: string;
  assignment_id: number;
  old_role: string;
  new_role: string;
}> {
  return apiFetch("/accounts/users/change_assignment_role/", {
    method: "POST",
    body: { assignment_id: assignmentId, role },
  });
}
