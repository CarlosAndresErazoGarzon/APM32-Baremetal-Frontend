import { Bloc } from '../core/Bloc.js';
import { globalEventBus } from '../core/EventBus.js';

export class AuthBloc extends Bloc {
    get initialState() {
        return {
            isInitialized: false,
            user: null,
            db: null,
            auth: null
        };
    }

    async initFirebase(apiUrl) {
        try {
            const res = await fetch(`${apiUrl}/api/config`);
            if (!res.ok) throw new Error("Failed to fetch Firebase config");
            const configData = await res.json();
            
            // eslint-disable-next-line no-undef
            firebase.initializeApp(configData);
            // eslint-disable-next-line no-undef
            const auth = firebase.auth();
            // eslint-disable-next-line no-undef
            const db = firebase.firestore();

            // SESSION, not Firebase's own default (browserLocalPersistence,
            // which survives closing the browser entirely -- indefinitely,
            // until an explicit logout). A real reported concern: this app
            // runs on shared lab computers, and a student who forgets to
            // click LOGOUT would leave their account signed in for whoever
            // opens the browser next, with full access to their saved
            // projects and Learn progress. SESSION persistence clears once
            // this tab/window closes, so the next person starts logged out
            // -- normal reload/navigation within the same session is
            // unaffected. Set before onAuthStateChanged() below so the very
            // first state check already respects it: per Firebase's own
            // docs, calling this also downgrades an already-restored LOCAL
            // session to session-only going forward, so it takes effect
            // even for a browser that already had a lingering login before
            // this shipped, without forcing an immediate logout.
            // eslint-disable-next-line no-undef
            await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);

            // Tracks the signed-in uid so we only fire AUTH_LOGIN once per
            // actual sign-in (onAuthStateChanged can re-fire for the same user).
            let lastUid = null;

            auth.onAuthStateChanged((user) => {
                this.emit({ user });
                if (user) {
                    globalEventBus.emit('LOG', { message: 'Logged in securely.', type: 'success' });
                    if (user.uid !== lastUid) {
                        lastUid = user.uid;
                        // Fires both on a fresh interactive login and when Firebase
                        // restores a previous session on page load -- in both cases
                        // the user has no way to know what's currently loaded unless
                        // we pull their saved project in automatically.
                        globalEventBus.emit('AUTH_LOGIN', { user, db });
                    }
                } else {
                    lastUid = null;
                    globalEventBus.emit('LOG', { message: 'Logged out.', type: 'info' });
                }
            });

            this.emit({ isInitialized: true, auth, db });
        } catch (e) {
            console.error("Firebase init failed:", e);
            globalEventBus.emit('LOG', { message: 'Firebase Init Failed', type: 'error' });
        }
    }

    async login() {
        if (!this.state.auth) return;
        try {
            // eslint-disable-next-line no-undef
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await this.state.auth.signInWithPopup(provider);
            globalEventBus.emit('LOG', { message: `Welcome, ${result.user.email}!`, type: 'success' });
        } catch (error) {
            globalEventBus.emit('LOG', { message: "Login failed: " + error.message, type: 'error' });
        }
    }

    async logout() {
        if (!this.state.auth) return;
        try {
            await this.state.auth.signOut();
            globalEventBus.emit('AUTH_LOGOUT');
        } catch (error) {
            globalEventBus.emit('LOG', { message: "Logout failed", type: 'error' });
        }
    }
}
