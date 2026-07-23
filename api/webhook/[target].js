// api/webhook/[target].js — Proxy sécurisé vers les webhooks Make
// Sécurité : seules les requêtes venant des domaines du projet sont acceptées.
// Aucune modification du front nécessaire.

const ALLOWED_ORIGINS = [
  'https://rsia-chatbot-sav.vercel.app',
  'https://rsia-chatbot-sav-akial.vercel.app',
  'https://rsia-chatbot-sav-git-main-akial.vercel.app',
];

function isAllowed(req) {
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';

  // 1. Origin exact dans la liste, ou déploiement preview du projet
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/rsia-chatbot-[a-z0-9]+-akial\.vercel\.app$/.test(origin)) return true;

  // 2. Pas d'Origin (certains navigateurs en GET same-origin) → on vérifie le Referer
  if (!origin && referer) {
    return (
      ALLOWED_ORIGINS.some((o) => referer.startsWith(o + '/')) ||
      /^https:\/\/rsia-chatbot-[a-z0-9]+-akial\.vercel\.app\//.test(referer)
    );
  }

  return false;
}

export default async function handler(req, res) {
  // --- Contrôle d'accès ---
  if (!isAllowed(req)) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }

  const target = req.query.target;

  const WEBHOOKS = {
    default: process.env.MAKE_WEBHOOK_DEFAULT,
    technicien: process.env.MAKE_WEBHOOK_TECHNICIEN,
    client: process.env.MAKE_WEBHOOK_CLIENT,
  };

  const url = WEBHOOKS[target];
  if (!url) {
    return res.status(400).json({ error: 'Webhook cible inconnu.' });
  }

  // On reporte les paramètres de query (ex: ?ticketId=...) vers l'URL réelle du webhook
  const qs = req.url.split('?')[1];
  const fullUrl = qs ? url + '?' + qs : url;

  const init = { method: req.method };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(req.body || {});
  }

  try {
    const r = await fetch(fullUrl, init);
    const text = await r.text();
    res.status(r.status).send(text);
  } catch (err) {
    res.status(502).json({ error: 'Erreur en contactant Make', details: String(err) });
  }
}
