import {fetchJSON} from '../save-request.mjs';
import {pathProgress} from './path.mjs';

// A confirmed revision conflict did not write anything. Only rebase a lesson
// start when the same completed session is still current; never replace fresh
// unfinished work or replay a move against a different board.
export function canRebaseStart(body, before, latest) {
  return body.type === 'start' && body.lesson !== 'review' &&
    before.session?.phase === 'summary' && latest.session?.phase === 'summary' &&
    before.session.id === latest.session.id &&
    before.settings.band === latest.settings.band && latest.current !== 'game' &&
    pathProgress(latest).some(l => l.id === body.lesson && !l.locked);
}
export async function requestChess(endpoint, body, before, {request=fetchJSON,active=()=>true}={}) {
  const post=()=>request(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},18000);
  try { return await post(); }
  catch(error) {
    if(error.status !== 409 || !active())throw error;
    let latest;
    try { latest=(await request(endpoint,{},8000)).profile; }
    catch { throw error; }
    if(!active())throw error;
    if(canRebaseStart(body,before,latest)) {
      // Preserve the idempotency key in case the response is lost after saving.
      body.revision=latest.revision;
      try { return await post(); }
      catch(retryError) {
        if(retryError.status !== 409)throw retryError;
        // Another writer raced this one retry. Refresh without another POST.
        try { latest=(await request(endpoint,{},8000)).profile; }catch{}
        throw Object.assign(retryError,{latestProfile:latest});
      }
    }
    throw Object.assign(error,{latestProfile:latest});
  }
}
