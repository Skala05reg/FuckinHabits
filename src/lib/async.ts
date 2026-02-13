export async function mapSettledInBatches<T, R>(
  items: readonly T[],
  batchSize: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<Array<PromiseSettledResult<R>>> {
  const size = Math.max(1, Math.trunc(batchSize));
  const results: Array<PromiseSettledResult<R>> = [];

  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    const settled = await Promise.allSettled(
      batch.map((item, batchIndex) => mapper(item, i + batchIndex)),
    );
    results.push(...settled);
  }

  return results;
}
