import { resolveDb } from './jobQueue';

import type { MongoDbSource } from './jobQueue';
import type { ActionKvAdapter } from '../actions/types';
import type { Collection, Document } from 'mongodb';

/** Mongo's code for a unique index that refused a second document with the same key. */
const DUPLICATE_KEY = 11000;

export type MongoKvOptions = {
  db: MongoDbSource;
  /** Default `action_kv`. */
  collection?: string;
};

type KvDocument = { _id: string; value: string; expiresAt: Date | null };

/**
 * Whether a key is still alive, by the SERVER's clock.
 *
 * Mongo's TTL monitor sweeps once a minute, so a document past its lifetime can still be there to read. Expiry is
 * decided here, against `$$NOW`, rather than by whether the sweeper has been round yet — the same answer Redis gives
 * the instant a key lapses.
 */
const LIVE: Document = { $or: [{ $eq: [{ $ifNull: ['$expiresAt', null] }, null] }, { $gt: ['$expiresAt', '$$NOW'] }] };

const expiryIn = (ttlSeconds: number): Document => ({ $add: ['$$NOW', ttlSeconds * 1000] });

/**
 * An {@link ActionKvAdapter} over a collection of a Mongo database the deployment owns.
 *
 * What the run guards' single-flight keys and the `kv` tasks' counters need from a store the replicas share: a TTL the
 * store enforces and an increment nobody can race. Each operation is ONE document update, which Mongo applies
 * atomically — so two replicas incrementing the same counter at once both count.
 */
export const createMongoKv = ({ db, collection = 'action_kv' }: MongoKvOptions): ActionKvAdapter => {
  const keys = (): Collection<KvDocument> => resolveDb(db).collection<KvDocument>(collection);

  let ready: Promise<void> | undefined;
  const store = async (): Promise<Collection<KvDocument>> => {
    // The sweeper that eventually removes what has lapsed; reads never depend on it having run.
    ready ??= keys()
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
      .then(() => undefined)
      .catch((error: unknown) => {
        ready = undefined;
        throw error;
      });
    await ready;

    return keys();
  };

  /**
   * An upsert two replicas race for can collide on `_id` before either has written; the server retries that itself
   * from 4.2 on, and this covers the rest. Once is enough: the second attempt finds the document the first one made.
   */
  const upserting = async <T>(write: () => Promise<T>): Promise<T> => {
    try {
      return await write();
    } catch (error) {
      if ((error as { code?: number }).code !== DUPLICATE_KEY) {
        throw error;
      }

      return write();
    }
  };

  return {
    get: async key => {
      const found = await (await store()).findOne({ _id: key, $expr: LIVE });

      return found?.value;
    },

    set: async (key, value, ttlSeconds) => {
      const keysNow = await store();
      await upserting(() =>
        keysNow.updateOne(
          { _id: key },
          [{ $set: { value, expiresAt: ttlSeconds === undefined ? null : expiryIn(ttlSeconds) } }],
          { upsert: true }
        )
      );
    },

    delete: async key => {
      await (await store()).deleteOne({ _id: key });
    },

    increment: async (key, amount) => {
      const keysNow = await store();
      const updated = await upserting(() =>
        keysNow.findOneAndUpdate(
          { _id: key },
          [
            { $set: { live: LIVE } },
            {
              $set: {
                // A lapsed counter starts again from zero, and without the lifetime it had.
                value: {
                  $toString: {
                    $add: [
                      { $cond: ['$live', { $convert: { input: '$value', to: 'double', onError: 0, onNull: 0 } }, 0] },
                      amount
                    ]
                  }
                },
                expiresAt: { $cond: ['$live', { $ifNull: ['$expiresAt', null] }, null] }
              }
            },
            { $unset: 'live' }
          ],
          { upsert: true, returnDocument: 'after' }
        )
      );

      return Number(updated?.value ?? amount);
    },

    expire: async (key, ttlSeconds) => {
      await (await store()).updateOne({ _id: key, $expr: LIVE }, [{ $set: { expiresAt: expiryIn(ttlSeconds) } }]);
    }
  };
};
