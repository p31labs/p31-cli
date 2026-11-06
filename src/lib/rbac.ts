/**
 * src/lib/rbac.ts
 * Role-based access control for @p31/cli.
 * Supports admin, operator, and viewer roles with granular permissions.
 */

export type Role = 'admin' | 'operator' | 'viewer';

export interface Permission {
  resource: string;
  action: string;
}

export interface RBACConfig {
  role: Role;
  permissions: Permission[];
}

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    { resource: '*', action: '*' },
  ],
  operator: [
    { resource: 'shell', action: 'read' },
    { resource: 'shell', action: 'write' },
    { resource: 'sync', action: 'read' },
    { resource: 'sync', action: 'write' },
    { resource: 'mcp', action: 'read' },
    { resource: 'mcp', action: 'call' },
    { resource: 'session', action: 'read' },
    { resource: 'session', action: 'write' },
    { resource: 'phos', action: 'read' },
    { resource: 'phos', action: 'write' },
  ],
  viewer: [
    { resource: 'shell', action: 'read' },
    { resource: 'sync', action: 'read' },
    { resource: 'mcp', action: 'read' },
    { resource: 'session', action: 'read' },
    { resource: 'phos', action: 'read' },
  ],
};

export class RBAC {
  private config: RBACConfig;
  
  constructor(role: Role = 'operator') {
    this.config = {
      role,
      permissions: ROLE_PERMISSIONS[role],
    };
  }
  
  can(resource: string, action: string): boolean {
    if (this.config.role === 'admin') return true;
    
    const hasExact = this.config.permissions.some(
      p => p.resource === resource && p.action === action
    );
    if (hasExact) return true;
    
    const hasWildcardResource = this.config.permissions.some(
      p => p.resource === '*' && (p.action === action || p.action === '*')
    );
    if (hasWildcardResource) return true;
    
    return false;
  }
  
  require(resource: string, action: string): void {
    if (!this.can(resource, action)) {
      throw new Error(`Permission denied: ${this.config.role} cannot ${action} ${resource}`);
    }
  }
  
  getRole(): Role {
    return this.config.role;
  }
  
  getPermissions(): Permission[] {
    return this.config.permissions;
  }
}

let rbac: RBAC | null = null;

export function getRBAC(): RBAC {
  if (!rbac) {
    const role = (process.env.P31_ROLE as Role) || 'operator';
    rbac = new RBAC(role);
  }
  return rbac;
}

export function resetRBAC(): void {
  rbac = null;
}
