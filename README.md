# Elite Vehicle Desk — Vehicle Lookup API

Private office API. Mvahan vehicle details fetch karta hai with cache + rate limit.

## Endpoint

GET /api/vehicle?number=GJ05MS9717

Headers: x-api-key: <OUR_API_KEY>

## Deploy

1. GitHub pe repo push karo
2. Vercel pe import karo (vercel.com/new)
3. Environment variables set karo:
   - SOURCE_API_KEY
   - OUR_API_KEY
   - UPSTASH_REDIS_REST_URL
   - UPSTASH_REDIS_REST_TOKEN
   - MASK_MOBILE (optional: none|first5|middle)
4. Deploy

## Rate Limit

10 requests per 100 seconds per IP.
