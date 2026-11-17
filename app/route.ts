import { eventDocument } from "../lib/event-document";
export function GET() { return new Response(eventDocument, {headers:{"Content-Type":"text/html; charset=utf-8", "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff"}}); }
