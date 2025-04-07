// server/api/auth/login.post.ts
import jwt from 'jsonwebtoken';
import { setCookie } from 'h3';

const SECRET = 'limbus-super-secret';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { email, password } = body;

  if (email === 'admin@limbus.gn' && password === 'secret') {
    const token = jwt.sign(
      { email, role: 'orga' },
      SECRET,
      { expiresIn: '1h' }
    );

    setCookie(event, 'limbus_token', token, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60, // 1 heure
      sameSite: 'none',
      secure: true
    });

    return { success: true };
  }

  return {
    success: false,
    message: 'Identifiants invalides'
  };
});
