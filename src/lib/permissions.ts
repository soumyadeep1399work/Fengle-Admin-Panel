// Role-based access for the panel UI. The backend enforces the same matrix
// (403 forbidden_role); this only decides what to show, so nobody sees a
// button that would be refused.
export type Role = 'super_admin' | 'ops' | 'support';

export type Permission =
  | 'manage'        // day-to-day writes: restaurants, riders, catalog, customer block, reassign rider
  | 'cancel_order'
  | 'money'         // settlements, wallet credit, coupons, customer export
  | 'admins';       // add / edit / disable admins

const MATRIX: Record<Role, Permission[]> = {
  super_admin: ['manage', 'cancel_order', 'money', 'admins'],
  ops: ['manage', 'cancel_order'],
  support: ['cancel_order'],
};

export const ROLES: { value: Role; label: string; summary: string }[] = [
  { value: 'super_admin', label: 'Super admin', summary: 'Everything, including money actions and managing admins.' },
  { value: 'ops', label: 'Operations', summary: 'Runs orders, kitchens, riders, catalog and customers. No settlements, wallet credit, coupons, export or admin management.' },
  { value: 'support', label: 'Support', summary: 'Can view everything and cancel orders. Nothing else.' },
];

export const roleLabel = (role: string | undefined | null) => ROLES.find((r) => r.value === role)?.label ?? role ?? '—';

export function roleCan(role: string | undefined | null, perm: Permission): boolean {
  return (MATRIX[role as Role] ?? []).includes(perm);
}
