export interface Env {
  SYNC_BUCKET: R2Bucket;
  SYNC_TOKEN: string;
}

// Single-tenant, single-file store -- one kindergarten's db, one key, ever.
const DB_KEY = "kindergarten.db";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.headers.get("Authorization") !== `Bearer ${env.SYNC_TOKEN}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    switch (request.method) {
      case "GET": {
        const object = await env.SYNC_BUCKET.get(DB_KEY);
        if (object === null) {
          return new Response("Not Found", { status: 404 });
        }
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        return new Response(object.body, { headers });
      }

      case "PUT": {
        // onlyIf reads the client's If-Match header (its last-known etag)
        // natively -- put() resolves null when the precondition fails,
        // which is R2's own guard against silently clobbering a newer
        // upload from another device. First-ever push sends no If-Match,
        // so it's unconditional.
        const result = await env.SYNC_BUCKET.put(DB_KEY, request.body, {
          onlyIf: request.headers,
        });
        if (result === null) {
          return new Response("Precondition Failed", { status: 412 });
        }
        return new Response(JSON.stringify({ etag: result.httpEtag }), {
          headers: { "content-type": "application/json" },
        });
      }

      default:
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "GET, PUT" },
        });
    }
  },
} satisfies ExportedHandler<Env>;
