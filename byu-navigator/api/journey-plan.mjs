export default {
  async fetch(request) {
    if (request.method !== "GET") {
      return Response.json(
        { error: "Method not allowed." },
        { status: 405, headers: { Allow: "GET" } }
      );
    }

    return Response.json(
      { status: "Journey plan endpoint connected. AI setup pending." },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
};