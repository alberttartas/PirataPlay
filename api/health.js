export default function handler(req, res) {
  res.status(200).json({ ok: true, version: "2.0.0", ts: new Date().toISOString() });
}
