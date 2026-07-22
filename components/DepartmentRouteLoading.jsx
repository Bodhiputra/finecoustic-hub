import RouteLoading from '@/components/RouteLoading';

const LABELS = {
  operations: 'Loading operations…',
  marketing: 'Loading marketing…',
  products: 'Loading products…',
  branding: 'Loading branding…',
  creatives: 'Loading creatives…',
  all: 'Loading tasks…',
};

export default function DepartmentRouteLoading({ departmentId = 'all' }) {
  return (
    <RouteLoading
      variant="hub"
      label={LABELS[departmentId] || 'Loading department…'}
    />
  );
}
