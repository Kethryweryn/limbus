// server/api/auth/me.get.ts
import jwt from 'jsonwebtoken';
import { parseCookies } from 'h3';

const SECRET = 'limbus-super-secret';

export default defineEventHandler(async (event) => {
    const cookies = parseCookies(event);
    const token = cookies.limbus_token;
    console.log('[auth/me] cookies:', cookies);
    console.log('[auth/me] token:', token);
    console.log('[auth/me] headers:', event.req?.headers);

    if (!token) {
        return { authenticated: false };
    }

    try {
        const payload = jwt.verify(token, SECRET);
        return { authenticated: true, user: payload };
    } catch (e) {
        return { authenticated: false };
    }
});
