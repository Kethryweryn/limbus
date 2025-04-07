// server/api/auth/login.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { email, password } = body;

  // Mock temporaire
  if (email === 'admin@limbus.gn' && password === 'secret') {
    return {
      success: true,
      token: 'FAUX_JWT_TOKEN',
      role: 'mj'
    };
  }

  return {
    success: false,
    message: 'Identifiants invalides'
  };
});
