export const PERMISSION_SECTIONS = ['orders', 'incoming', 'inventory', 'shipping', 'sales', 'master', 'products'] as const;

export const DEFAULT_ROLE_SECTIONS: Record<string, string[]> = {
  admin:     ['orders', 'incoming', 'inventory', 'shipping', 'sales', 'master', 'products'],
  office:    ['orders', 'incoming', 'inventory', 'shipping', 'sales'],
  warehouse: ['incoming', 'inventory', 'shipping'],
  viewer:    ['orders', 'incoming', 'inventory', 'shipping', 'sales'],
};
