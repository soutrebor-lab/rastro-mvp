export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Método não permitido.' }), { status: 405, headers: { 'content-type': 'application/json; charset=utf-8' } });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: 'OPENAI_API_KEY não configurada no Vercel.' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } });
  try {
    const incoming = await request.formData();
    const audio = incoming.get('file');
    if (!audio || typeof audio.arrayBuffer !== 'function') return new Response(JSON.stringify({ error: 'Arquivo de áudio não recebido.' }), { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } });
    const body = new FormData();
    body.append('file', new File([await audio.arrayBuffer()], audio.name || 'rastro-recording.webm', { type: audio.type || 'audio/webm' }));
    body.append('model', 'gpt-4o-mini-transcribe');
    body.append('language', 'pt');
    body.append('response_format', 'json');
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + apiKey }, body });
    const result = await response.json();
    if (!response.ok) return new Response(JSON.stringify({ error: result?.error?.message || 'Falha na transcrição.' }), { status: response.status, headers: { 'content-type': 'application/json; charset=utf-8' } });
    const transcript = String(result.text || '').replace(/\s+/g, ' ').trim();
    let data = null;
    if (transcript) {
      const analysisResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST', headers: { Authorization: 'Bearer ' + apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          input: [
            { role: 'system', content: 'Você organiza registros de prospecção em português do Brasil. Analise o áudio inteiro antes de responder e preencha cada campo separadamente, sem misturar valores com nomes. Identifique explicitamente empresa, responsável, WhatsApp, serviço/produto, quantidade, valor unitário, valor total e prazo/data. Se a fala disser quatro placas a 80 reais e total 320, retorne quantity=4, unit_price="R$ 80,00" e total_amount="R$ 320,00". Não invente dados: quando não existir, use string vazia e quantity=0. Resuma em uma ou duas frases com empresa, pessoa, serviço/produto, resultado e próximo passo. Venda só é true quando houver compra, pagamento, venda realizada, contratação ou fechamento explícito; orçamento ou proposta não é venda.' },
            { role: 'user', content: transcript }
          ],
          text: { format: { type: 'json_schema', name: 'rastro_prospect_record', strict: true, schema: {
            type: 'object',
            properties: {
              company: { type: 'string' }, responsible: { type: 'string' }, whatsapp: { type: 'string' }, service: { type: 'string' }, budget: { type: 'string' }, sale_item: { type: 'string' }, quantity: { type: 'number' }, unit_price: { type: 'string' }, total_amount: { type: 'string' }, deadline: { type: 'string' }, outcome: { type: 'string' }, next_step: { type: 'string' }, follow_up: { type: 'string' }, summary: { type: 'string' }, is_sale: { type: 'boolean' }, sale_amount: { type: 'string' }, project_level: { type: 'string' }, relevance: { type: 'number' }
            },
            required: ['company','responsible','whatsapp','service','budget','sale_item','quantity','unit_price','total_amount','deadline','outcome','next_step','follow_up','summary','is_sale','sale_amount','project_level','relevance'], additionalProperties: false
          } } }
        })
      });
      if (analysisResponse.ok) { const analysisBody = await analysisResponse.json(); try { data = JSON.parse(analysisBody.output_text || '{}'); } catch (_) { data = null; } }
    }
    return new Response(JSON.stringify({ text: transcript, data }), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Não foi possível processar o áudio.' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
}
