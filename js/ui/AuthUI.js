export class AuthUI {
    constructor(authBloc) {
        this.authBloc = authBloc;
        
        // DOM Elements
        this.authBtn = document.getElementById('authBtn');
        this.cloudSaveBtn = document.getElementById('cloudSaveBtn');
        this.cloudLoadBtn = document.getElementById('cloudLoadBtn');
        
        this.initEventListeners();
        
        // Subscribe to state changes from AuthBloc
        this.authBloc.subscribe(this.render.bind(this));
    }

    initEventListeners() {
        this.authBtn.onclick = () => {
            const state = this.authBloc.state;
            if (state.user) {
                this.authBloc.logout();
            } else {
                this.authBloc.login();
            }
        };
    }

    render(state) {
        if (state.user) {
            this.authBtn.innerHTML = `<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg> LOGOUT`;
            this.authBtn.title = state.user.email;
            
            this.cloudSaveBtn.disabled = false;
            this.cloudSaveBtn.classList.remove('opacity-50', 'hidden');
            
            this.cloudLoadBtn.disabled = false;
            this.cloudLoadBtn.classList.remove('opacity-50', 'hidden');
        } else {
            this.authBtn.innerHTML = `<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg> LOGIN`;
            this.authBtn.title = "Login with Google";
            
            this.cloudSaveBtn.disabled = true;
            this.cloudSaveBtn.classList.add('opacity-50', 'hidden');
            
            this.cloudLoadBtn.disabled = true;
            this.cloudLoadBtn.classList.add('opacity-50', 'hidden');
        }
    }
}
