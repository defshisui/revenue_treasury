const https = require('https');

// Try v1 API with GET
const params = new URLSearchParams({
  key: 'EF4RDDYXFETNWIY7I9ATAFCKPFZZCB3W',
  format: 'json',
  ip: '146.112.61.108',
  email: 'demo@fraudlabspro.com',
  currency: 'USD'
});

const url = `https://api.fraudlabspro.com/v1/order/screen?${params.toString()}`;
console.log('Testing v1 URL:', url);

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
}).on('error', e => console.error('Error:', e));
