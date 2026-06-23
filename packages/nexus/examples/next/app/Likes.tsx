'use client';

import { createStoreHook } from '@plitzi/nexus/react';

import type { PageState } from './page';

const { useStore } = createStoreHook<PageState>();

export default function Likes() {
  const [likes, setLikes] = useStore('likes');

  return <button onClick={() => setLikes(n => n + 1)}>♥ {likes}</button>;
}
