import Redis from 'ioredis';
import axios from 'axios';
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

async function processRetryStream() {
  let lastId = '$';
  while(true){
    try {
      const res = await redis.xread('BLOCK', 0, 'STREAMS', 'webhook_retry', lastId);
      if (res) {
        for (const [, entries] of res) {
          for (const [id, pairs] of entries) {
            lastId = id;
            const obj = {};
            for (let i=0;i<pairs.length;i+=2) obj[pairs[i]] = pairs[i+1];
            const url = obj.url;
            const payload = JSON.parse(obj.payload || '{}');
            try {
              await axios.post(url, payload, { timeout: 5000 });
              console.log('retry success', url);
            } catch (e) {
              console.error('retry failed', url, e.message);
              await redis.xadd('webhook_retry', '*', 'url', url, 'payload', JSON.stringify(payload));
            }
          }
        }
      }
    } catch (e) {
      console.error('worker error', e.message);
      await new Promise(r=>setTimeout(r,1000));
    }
  }
}

processRetryStream().catch(e=>console.error(e));
