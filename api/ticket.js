export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const AIRTABLE_TOKEN = 'patVv2Jmisci900TY.45d3f25095a992e5f8c3511eb913378e0513afa90f4c7afa3f83a786b8cf8d19';
  const AIRTABLE_BASE = 'appFqAT8WeX0UTudy';
  const AIRTABLE_TABLE = 'Tickets SAV';

  try {
    const body = req.body;
    const fields = {
      'Name': body.ticket,
      'Agence': body.agence,
      'Client': body.nom,
      'Téléphone': body.tel,
      'Email': body.email,
      'Adresse': body.adresse,
      'Produit': body.produit,
      'Problème': body.probleme,
      'Créneau': body.creneau,
      'Garantie': body.garantie ? 'Oui' : 'Non',
      'N° Facture': body.facture || '',
      'Qualification': body.urgent ? 'URGENT' : 'Standard',
      'Status': 'Nouveau',
    };

    const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    return res.status(200).json({ success: true, id: data.id });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
