// server/api/auth/me.get.ts
import jwt from 'jsonwebtoken';
import { parseCookies } from 'h3';

const SECRET = 'limbus-super-secret';

export default defineEventHandler(async (event) => {
    const cookies = parseCookies(event);
    const token = cookies.limbus_token;

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
