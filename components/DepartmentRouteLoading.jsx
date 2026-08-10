import RouteLoading from '@/components/RouteLoading';

const LABELS = {
  operations: 'Loading operations…',
  marketing: 'Loading marketing…',
  products: 'Loading products…',
  finecoustic: 'Loading All About Finecoustic…',
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
