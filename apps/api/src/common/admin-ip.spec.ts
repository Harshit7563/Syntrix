import { adminIpAllowed } from './admin-ip';

describe('admin IP allowlist', () => {
  const prev = process.env.ADMIN_IP_ALLOWLIST;
  afterEach(() => {
    if (prev == null) delete process.env.ADMIN_IP_ALLOWLIST;
    else process.env.ADMIN_IP_ALLOWLIST = prev;
  });
  it('allows any IP when unset', () => {
    delete process.env.ADMIN_IP_ALLOWLIST;
    expect(adminIpAllowed('203.0.113.9')).toBe(true);
  });
  it('rejects IPs outside the list', () => {
    process.env.ADMIN_IP_ALLOWLIST = '203.0.113.10,10.0.0.0/8';
    expect(adminIpAllowed('203.0.113.10')).toBe(true);
    expect(adminIpAllowed('10.1.2.3')).toBe(true);
    expect(adminIpAllowed('198.51.100.1')).toBe(false);
  });
});
