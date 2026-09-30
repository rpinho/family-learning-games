// A retained page can hold an old shared module while a lazy import fetches new code.
// Check at the opening boundary, before importing or mounting anything with that graph.
export function createReleaseLoader({loadedRelease, readRelease, reload, load}) {
  let pending;
  const changed = current => loadedRelease && loadedRelease !== 'development' && current && current !== loadedRelease;
  return () => pending ||= (async () => {
    if (changed(await readRelease())) { reload(); return null; }
    try { return await load(); }
    catch (error) {
      // A promotion may have happened between the check and the import. Recover with a
      // fresh document; retrying that import in the same page retains its failed module.
      if (changed(await readRelease())) { reload(); return null; }
      throw error;
    }
  })().catch(error => { pending = null; throw error; });
}
