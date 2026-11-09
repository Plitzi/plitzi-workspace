/**
 * CPU and memory as the clouds and Kubernetes name them, so a developer, an operator and a customer read one size the
 * same way: CPU in vCPU — `0.25 vCPU`, Kubernetes' `250m` — and memory in MiB and GiB — `512 MiB`, Kubernetes' `512Mi`.
 * One scale of each, doubling, the one every size here is picked from: an instance of a pool, a space's runtime.
 */

/** The CPU sizes there are, in millicores (Kubernetes' `m`: a thousandth of a vCPU) — 0.125 to 4 vCPU. */
export const VCPU_STEPS = [125, 250, 500, 1000, 2000, 4000] as const;

/** The memory sizes there are, in MiB (Kubernetes' `Mi`) — 128 MiB to 8 GiB. */
export const MEMORY_STEPS = [128, 256, 512, 1024, 2048, 4096, 8192] as const;

const MIB = 1_048_576;

const trimmed = (value: number): string => String(Math.round(value * 1000) / 1000);

/** Millicores as a cloud says them: `0.125 vCPU`, `0.5 vCPU`, `2 vCPU`. */
export const vcpuWords = (millicores: number): string => `${trimmed(millicores / 1000)} vCPU`;

/** MiB as a cloud says them: `256 MiB`, `1 GiB`, `1.5 GiB` — GiB from 1024 up. */
export const memoryWords = (mib: number): string =>
  mib >= 1024 ? `${trimmed(mib / 1024)} GiB` : `${String(Math.round(mib))} MiB`;

/** A size in one line: `0.25 vCPU · 512 MiB`. */
export const sizeWords = (millicores: number, mib: number): string => `${vcpuWords(millicores)} · ${memoryWords(mib)}`;

/** A CPU quantity as Kubernetes writes one — `250m`, `1`, `0.5` — in millicores; undefined for anything else. */
export const millicoresOf = (quantity: unknown): number | undefined => {
  if (typeof quantity !== 'string' && typeof quantity !== 'number') {
    return undefined;
  }

  const match = /^(\d+(?:\.\d+)?)(m)?$/.exec(String(quantity).trim());
  if (!match) {
    return undefined;
  }

  const millicores = match[2] ? Number(match[1]) : Number(match[1]) * 1000;

  return millicores > 0 ? Math.round(millicores) : undefined;
};

const FACTORS: Record<string, number> = {
  Ki: 1024,
  Mi: MIB,
  Gi: 1024 * MIB,
  K: 1000,
  M: 1_000_000,
  G: 1_000_000_000
};

/** A memory quantity as Kubernetes writes one — `512Mi`, `1Gi`, `512M`, or bytes — in MiB; undefined otherwise. */
export const mibOf = (quantity: unknown): number | undefined => {
  if (typeof quantity !== 'string' && typeof quantity !== 'number') {
    return undefined;
  }

  const match = /^(\d+(?:\.\d+)?)(Ki|Mi|Gi|K|M|G)?$/.exec(String(quantity).trim());
  if (!match) {
    return undefined;
  }

  const mib = Math.round((Number(match[1]) * (match[2] ? (FACTORS[match[2]] ?? 1) : 1)) / MIB);

  return mib > 0 ? mib : undefined;
};

/** A Kubernetes size — its `cpu` and `memory` quantities — in one line, or undefined when either is not one. */
export const quantityWords = (cpu: unknown, memory: unknown): string | undefined => {
  const millicores = millicoresOf(cpu);
  const mib = mibOf(memory);

  return millicores === undefined || mib === undefined ? undefined : sizeWords(millicores, mib);
};
