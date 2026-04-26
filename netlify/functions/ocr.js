const https = require('https');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { pdfBase64 } = JSON.parse(event.body);
    const apiKey = process.env.OCR_API_KEY;

    if (!apiKey) {
      throw new Error('OCR_API_KEY no configurada');
    }

    const boundary = '----FormBoundary' + Date.now().toString(36);
    const fields = {
      apikey: apiKey,
      language: 'spa',
      OCREngine: '2',
      scale: 'true',
      base64Image: `data:application/pdf;base64,${pdfBase64}`,
    };

    let body = '';
    for (const [key, value] of Object.entries(fields)) {
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
      body += `${value}\r\n`;
    }
    body += `--${boundary}--\r\n`;

    const bodyBuffer = Buffer.from(body, 'utf8');

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.ocr.space',
        path: '/parse/image',
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': bodyBuffer.length,
        },
        timeout: 60000,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Timeout OCR')));
      req.write(bodyBuffer);
      req.end();
    });

    const data = JSON.parse(result);

    if (data.IsErroredOnProcessing) {
      throw new Error(data.ErrorMessage?.[0] || 'Error procesando PDF');
    }

    const parsed = data.ParsedResults;
    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('El PDF no tiene texto reconocible.');
    }

    const texto = parsed.map(r => r.ParsedText || '').join('\n');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ texto, paginas: parsed.length }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
