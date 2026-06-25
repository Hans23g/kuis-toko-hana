export default async function handler(req, res) {
  // Biar nggak kena CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // format: Hans23g/kuis-toko-hana
  
  if (!token) return res.status(500).json({error:'GITHUB_TOKEN kosong di Vercel'});
  if (!repo) return res.status(500).json({error:'GITHUB_REPO kosong di Vercel'});

  const [owner, repoName] = repo.split('/');
  const filePath = 'data_peserta.json';
  const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}`;
  const headers = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Kuis-Toko-Hana'
  };

  // MODE CEK NAMA: ?cek=NamaPeserta
  if (req.method === 'GET' && req.query.cek) {
    try {
      const r = await fetch(apiUrl, {headers});
      if (r.status === 404) return res.json({sudah_ikut:false}); // file belum ada = aman
      
      const file = await r.json();
      const content = JSON.parse(Buffer.from(file.content, 'base64').toString());
      const nama = req.query.cek.trim().toLowerCase();
      const ada = content.find(p => p.nama.toLowerCase() === nama);
      
      if (ada) return res.json({sudah_ikut:true, jam:ada.jam});
      return res.json({sudah_ikut:false});
    } catch (e) {
      return res.status(500).json({error:'Gagal cek: ' + e.message});
    }
  }

  // MODE SIMPAN: POST
  if (req.method === 'POST') {
    try {
      const body = req.body;
      if (!body.nama || !body.jawaban) return res.status(400).json({error:'Data kurang'});

      let sha = null;
      let data = [];
      
      // Ambil file lama kalau ada
      const r = await fetch(apiUrl, {headers});
      if (r.status === 200) {
        const file = await r.json();
        sha = file.sha;
        data = JSON.parse(Buffer.from(file.content, 'base64').toString());
      }

      // Cek duplikat lagi
      const nama = body.nama.trim().toLowerCase();
      if (data.find(p => p.nama.toLowerCase() === nama)) {
        return res.status(400).json({error:'Nama sudah dipakai'});
      }

      // Tambah data baru
      data.push({
        nama: body.nama.trim(),
        jawaban: body.jawaban,
        benar: body.benar,
        skor: body.skor,
        jam: new Date().toLocaleString('id-ID', {timeZone: 'Asia/Jakarta'})
      });

      // Upload ke GitHub
      const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
      const upload = await fetch(apiUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: `Simpan hasil: ${body.nama}`,
          content: content,
          sha: sha
        })
      });

      if (!upload.ok) throw new Error(await upload.text());
      return res.json({ok:true});
    } catch (e) {
      return res.status(500).json({error:'Gagal simpan: ' + e.message});
    }
  }

  return res.status(405).json({error:'Method tidak diizinkan'});
}