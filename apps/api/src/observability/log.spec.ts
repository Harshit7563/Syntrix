import { routeLabel } from './log';

describe('routeLabel', () => {
  it('strips cuids and member codes so metric cardinality stays low', () => {
    expect(routeLabel('/admin/settlements/clxyzabcdefghijklmnopqrst/post')).toBe('/admin/settlements/:id/post');
    expect(routeLabel('/app/merchants/M482193')).toBe('/app/merchants/:member');
  });
});
