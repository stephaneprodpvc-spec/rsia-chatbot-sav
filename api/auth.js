export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ ok: false });
  }

  // Chaque mot de passe vit dans une variable d'environnement Vercel,
  // jamais dans le code source public.
  const PASSWORDS = {
    [process.env.DASHBOARD_PW_GLOBAL]: 'global',
    [process.env.DASHBOARD_PW_IBOS]: 'Ibos (65)',
    [process.env.DASHBOARD_PW_TARNOS]: 'Tarnos (40)',
    [process.env.DASHBOARD_PW_LESCAR]: 'Lescar (64)',
    [process.env.DASHBOARD_PW_STGAUDENS]: 'Saint-Gaudens (31)',
  };

  const access = PASSWORDS[password.trim()];

  if (!access) {
    return res.status(401).json({ ok: false });
  }

  return res.status(200).json({ ok: true, access });
}
