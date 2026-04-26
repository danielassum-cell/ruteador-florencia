const https = require('https');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const apiKey = process.env.OCR_API_KEY;

    if (!apiKey) throw new Error('OCR_API_KEY no configurada');

    // Acepta tanto PDF como imágenes
    const b64 = body.imageBase64 || body.pdfBase64;
    const mime = body.mimeType || 'application/pdf';
    const dataUri = `data:${mime};base64,${b64}`;

    const boundary = '----FormBoundary' + Date.now().toString(36);
    const fields = {
      apikey: apiKey,
      language: 'spa',
      OCREngine: '2',
      scale: 'true',
      base64Image: dataUri,
    };

    let bodyStr = '';
    for (const [key, value] of Object.entries(fields)) {
      bodyStr += `--${boundary}\r\n`;
      bodyStr += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
      bodyStr += `${value}\r\n`;
    }
    bodyStr += `--${boundary}--\r\n`;

    const bodyBuffer = Buffer.from(bodyStr, 'utf8');

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
      throw new Error(data.ErrorMessage?.[0] || 'Error procesando imagen');
    }

    const parsed = data.ParsedResults;
    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ texto: '' }),
      };
    }

    const texto = parsed.map(r => r.ParsedText || '').join('\n');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ texto }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
