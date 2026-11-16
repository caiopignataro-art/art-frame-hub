import type {
  AppUserStatus,
  AppUserWithDetails,
  CreateUserInput,
  UpdateUserInput,
} from "@/types/auth";

export interface UsersListFilter {
  search?: string;
  roleCode?: string;
  status?: AppUserStatus | "todos";
}

export interface UsersRepository {
  list(filter?: UsersListFilter): Promise<AppUserWithDetails[]>;
  getById(id: string): Promise<AppUserWithDetails | null>;
  getByEmail(email: string): Promise<AppUserWithDetails | null>;
  create(input: CreateUserInput, actorUserId?: string | null): Promise<AppUserWithDetails>;
  update(
    id: string,
    input: UpdateUserInput,
    actorUserId?: string | null,
  ): Promise<AppUserWithDetails>;
  setStatus(
    id: string,
    status: AppUserStatus,
    actorUserId?: string | null,
  ): Promise<AppUserWithDetails>;
  assignRoles(
    userId: string,
    roleIds: string[],
    actorUserId?: string | null,
  ): Promise<AppUserWithDetails>;
  countActiveAdmins(excludeUserId?: string): Promise<number>;
}
