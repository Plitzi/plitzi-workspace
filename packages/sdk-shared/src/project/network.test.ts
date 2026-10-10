import { describe, expect, it } from 'vitest';

import { localNetworkName, networkAddresses } from './network';

import type { NetworkInterfaceInfo } from 'node:os';

const v4 = (address: string, internal = false): NetworkInterfaceInfo => ({
  address,
  family: 'IPv4',
  internal,
  netmask: '',
  mac: '',
  cidr: null
});

const v6 = (address: string, internal = false): NetworkInterfaceInfo => ({
  address,
  family: 'IPv6',
  internal,
  netmask: '',
  mac: '',
  cidr: null,
  scopeid: 0
});

describe('this machine on its network', () => {
  it('is reached by its external IPv4 addresses, not its loopback or IPv6 ones', () => {
    expect(
      networkAddresses({
        lo0: [v4('127.0.0.1', true), v6('::1', true)],
        en0: [v6('fe80::1'), v4('192.168.1.20')],
        bridge100: [v4('192.168.64.1')]
      })
    ).toEqual(['192.168.1.20', '192.168.64.1']);
  });

  it('answers by its mDNS name, whatever the hostname says', () => {
    expect(localNetworkName('Studio-MacBook.local')).toBe('studio-macbook.local');
    expect(localNetworkName('studio')).toBe('studio.local');
  });
});
