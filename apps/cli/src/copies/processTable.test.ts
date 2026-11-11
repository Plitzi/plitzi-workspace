import { describe, expect, it } from 'vitest';

import { lsofFields, netstatListening, procListening } from './processTable';

// A run's finish and `server stop` read nothing where `lsof` was missing — a container, Windows — and said nothing of it.
describe('what the machine says listens', () => {
  it('reads lsof’s fields: each process and the names under it', () => {
    expect(lsofFields('p4120\nn*:3000\np4188\nn127.0.0.1:8300\nn[::1]:8300\n')).toEqual([
      { pid: 4120, names: ['*:3000'] },
      { pid: 4188, names: ['127.0.0.1:8300', '[::1]:8300'] }
    ]);
  });

  it('reads Linux’s /proc/net/tcp: a listening socket’s port, in hex, and its inode — never one connected', () => {
    const table = [
      '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode',
      '   0: 00000000:0BB8 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 41234 1 0000000000000000 100 0 0 10 0',
      '   1: 0100007F:206C 0100007F:9C40 01 00000000:00000000 00:00000000 00000000  1000        0 41299 1 0000000000000000 20 4 30 10 -1'
    ].join('\n');

    expect(procListening(table)).toEqual([{ port: 3000, inode: '41234' }]);
  });

  it('reads Windows’ netstat -ano: each listening port with its process, IPv6 too', () => {
    const output = [
      '',
      'Active Connections',
      '',
      '  Proto  Local Address          Foreign Address        State           PID',
      '  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       4120',
      '  TCP    127.0.0.1:52011        127.0.0.1:3000         ESTABLISHED     9000',
      '  TCP    [::]:8300              [::]:0                 LISTENING       4188',
      '  UDP    0.0.0.0:5353           *:*                                    1400'
    ].join('\r\n');

    expect(netstatListening(output)).toEqual([
      { pid: 4120, port: 3000 },
      { pid: 4188, port: 8300 }
    ]);
  });
});
