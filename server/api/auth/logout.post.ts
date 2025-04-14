// server/api/auth/logout.post.ts
import { deleteCookie } from 'h3';

export default defineEventHandler((event) => {
    deleteCookie(event, 'limbus_token', { path: '/' });

    return { success: true };
});
