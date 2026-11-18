function reply(status, data) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return Response.json(
        { error: "Use the Generate my next steps button." },
        { status: 405, headers: { Allow: "POST" } }
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return reply(401, { error: "Please sign in again." });
    }

    const base = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;

    if (!base || !key || !process.env.GEMINI_API_KEY) {
      return reply(503, {
        error: "The journey service configuration is incomplete."
      });
    }

    try {
      const headers = {
        apikey: key,
        Authorization: authorization
      };

      // Ask Supabase to verify the student's access token.
      const authResponse = await fetch(
        new URL("/auth/v1/user", base),
        {
          headers,
          signal: AbortSignal.timeout(10000)
        }
      );

      if (!authResponse.ok) {
        return reply(
          authResponse.status >= 500 ? 503 : 401,
          { error: "Could not verify your sign-in. Please try signing in again." }
        );
      }

      const authUser = await authResponse.json();

      if (!authUser.id) {
        return reply(401, { error: "Please sign in again." });
      }

      // Read only the profile belonging to the verified user.
      const profileUrl = new URL("/rest/v1/student", base);
      profileUrl.searchParams.set("select", "current_stage");
      profileUrl.searchParams.set(
        "auth_user_id",
        "eq." + authUser.id
      );
      profileUrl.searchParams.set("limit", "2");

      const profileResponse = await fetch(profileUrl, {
        headers,
        signal: AbortSignal.timeout(10000)
      });

      if (!profileResponse.ok) {
        return reply(503, {
          error: "Could not read your saved journey stage."
        });
      }

      const profiles = await profileResponse.json();

      if (!Array.isArray(profiles) || profiles.length !== 1) {
        return reply(409, {
          error: "A linked student profile is required."
        });
      }

      const savedStage = profiles[0].current_stage;
      const stage = Number(savedStage);

      if (
        savedStage === null ||
        !Number.isInteger(stage) ||
        stage < 0 ||
        stage > 5
      ) {
        return reply(409, {
          error: "Select and save a valid journey stage first."
        });
      }

      return reply(200, {
        stage,
        message: "Your saved stage is connected. Gemini setup is next."
      });
    } catch {
      return reply(503, {
        error: "The journey service could not connect. Please try again."
      });
    }
  }
};