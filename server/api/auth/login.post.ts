// server/api/auth/login.post.ts
import jwt from 'jsonwebtoken';
import { sendCookie } from 'h3'

const SECRET = 'limbus-super-secret'; // À déplacer dans .env plus tard

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { email, password } = body;

  if (email === 'admin@limbus.gn' && password === 'secret') {
    const token = jwt.sign(
      { email, role: 'mj' },
      SECRET,
      { expiresIn: '1h' }
    );

    sendCookie(event, 'limbus_token', token, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60, // 1 heure
      sameSite: 'strict'
    });

    return { success: true };
  }

  return {
    success: false,
    message: 'Identifiants invalides'
  };
});
