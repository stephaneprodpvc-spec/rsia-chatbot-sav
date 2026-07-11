export default async function handler(req, res) {
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
