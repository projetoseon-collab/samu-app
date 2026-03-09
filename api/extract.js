export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.OPENAI_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key não configurada no servidor" });

  const { image, mimeType } = req.body;
  if (!image) return res.status(400).json({ error: "Imagem não enviada" });

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType || "image/jpeg"};base64,${image}` }
            },
            {
              type: "text",
              text: `Analise esta imagem de relatório SAMU e extraia os dados. Retorne SOMENTE JSON válido sem markdown:\n{"numero":"","data":"dd/mm/aaaa","horaChamado":"HH:MM","horaChegada":"HH:MM","horaHospital":"HH:MM","horaLiberacao":"HH:MM","base":"","viatura":"","endereco":"","bairro":"","tipo":"","pacienteNome":"","pacienteIdade":"","pacienteSexo":"M ou F","queixa":"","conduta":"","destino":"","desfecho":"","medico":"","enfermeiro":"","socorrista":"","motorista":"","status":"Finalizado","obs":""}`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    return res.status(200).json(JSON.parse(clean));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
