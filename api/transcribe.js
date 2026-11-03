export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido.' }), {
      status: 405,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY não configurada no Vercel.' }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  try {
    const incoming = await request.formData();
    const audio = incoming.get('file');
    if (!audio || typeof audio.arrayBuffer !== 'function') {
      return new Response(JSON.stringify({ error: 'Arquivo de áudio não recebido.' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }

    const body = new FormData();
    body.append('file', new File([await audio.arrayBuffer()], audio.name || 'rastro-recording.webm', {
      type: audio.type || 'audio/webm',
    }));
    body.append('model', 'gpt-4o-mini-transcribe');
    body.append('language', 'pt');
    body.append('response_format', 'json');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body,
    });
    const result = await response.json();
    if (!response.ok) {
      return new Response(JSON.stringify({ error: result?.error?.message || 'Falha na transcrição.' }), {
        status: response.status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }

    return new Response(JSON.stringify({ text: result.text || '' }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Não foi possível processar o áudio.' }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
}
