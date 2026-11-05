import { describe, expect, it } from 'vitest';

import { memoryWords, mibOf, millicoresOf, quantityWords, sizeWords, vcpuWords } from './resources';

describe('CPU and memory, as the clouds name them', () => {
  it('says CPU in vCPU and memory in MiB and GiB', () => {
    expect([125, 250, 500, 1000, 2000].map(vcpuWords)).toEqual([
      '0.125 vCPU',
      '0.25 vCPU',
      '0.5 vCPU',
      '1 vCPU',
      '2 vCPU'
    ]);
    expect([128, 512, 1024, 1536, 8192].map(memoryWords)).toEqual(['128 MiB', '512 MiB', '1 GiB', '1.5 GiB', '8 GiB']);
    expect(sizeWords(250, 512)).toBe('0.25 vCPU · 512 MiB');
  });

  it('reads Kubernetes’ quantities, and nothing else', () => {
    expect(['250m', '1', '0.5', 1].map(millicoresOf)).toEqual([250, 1000, 500, 1000]);
    expect(['256Mi', '1Gi', '512M', 1_048_576].map(mibOf)).toEqual([256, 1024, 488, 1]);
    expect([millicoresOf('a lot'), millicoresOf('0'), mibOf('1 TB'), mibOf(undefined)]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined
    ]);
    expect(quantityWords('500m', '512Mi')).toBe('0.5 vCPU · 512 MiB');
    expect(quantityWords('500m', 'plenty')).toBeUndefined();
  });
});
