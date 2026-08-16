export const CONFIG = {
    API_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '') 
        ? 'http://localhost:3000' 
        : 'https://apm32-baremetal-backend.onrender.com'
};
