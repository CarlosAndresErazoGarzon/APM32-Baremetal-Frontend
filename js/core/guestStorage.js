/**
 * guestStorage.js
 * Picks the right Web Storage API for namespace-scoped local persistence
 * (FileSystemBloc.js's code drafts, LearnBloc.js's progress/exercise
 * drafts) based on whether `namespace` is a real account (a uid) or a
 * guest (null).
 *
 * A real reported bug: this app runs on shared lab computers (see
 * AuthBloc.js's own SESSION-persistence comment for the exact same
 * concern, just for login instead of local drafts) -- a GUEST's leftover
 * code kept showing up for the NEXT person who opened the SAME browser
 * without logging in, because the guest draft's key is a fixed
 * "..._guest" bucket, and plain localStorage is shared by literally
 * anyone using that browser who never signs in.
 *
 * Fix: a real ACCOUNT (namespace = uid) keeps using localStorage --
 * durable across browser restarts, and already correctly isolated per
 * account since the uid is baked into the key itself, so there's no
 * cross-user leak risk there. A GUEST uses sessionStorage instead: it
 * still survives an ordinary page reload in the SAME tab (the actual
 * feature local persistence exists for -- see local-persistence-
 * reload.test.js), but is cleared the moment the tab/window closes, so
 * the next person to open the browser starts clean instead of inheriting
 * a stranger's half-finished code.
 */
export function guestScopedStorage(namespace) {
    return namespace ? localStorage : sessionStorage;
}
