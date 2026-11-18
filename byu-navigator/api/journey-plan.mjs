const JOURNEY_STAGES = [
  {
    title: "Apply to BYU",
    steps: [
      "Review admission requirements for international students",
      "Gather transcripts and test scores",
      "Submit your application before the deadline"
    ],
    links: [
      ["Admissions", "https://admissions.byu.edu"]
    ]
  },
  {
    title: "Find housing",
    steps: [
      "Compare on-campus and off-campus options",
      "Check contract dates and costs",
      "Ask about housing for incoming international students"
    ],
    links: [
      ["BYU Housing", "https://housing.byu.edu"]
    ]
  },
  {
    title: "Register for classes",
    steps: [
      "See which classes your major requires",
      "Meet with an academic advisor",
      "Register, add, or drop classes in MyMap"
    ],
    links: [
      ["MyMap", "https://mymap.byu.edu"],
      ["Registrar", "https://registrar.byu.edu"]
    ]
  },
  {
    title: "Understand taxes",
    steps: [
      "Find general tax information for international students",
      "Find tax information and workshops",
      "Ask the appropriate office or a qualified tax professional for help"
    ],
    links: [
      ["International Services", "https://internationalservices.byu.edu"]
    ]
  },
  {
    title: "Find employment resources",
    steps: [
      "Ask International Services about work authorization before working",
      "Build your resume with Career Services",
      "Explore jobs and internships with Career Services"
    ],
    links: [
      ["Career Services", "https://careers.byu.edu"],
      ["International Services", "https://internationalservices.byu.edu"]
    ]
  },
  {
    title: "Complete graduation requirements",
    steps: [
      "Check your degree progress with your advisor",
      "Check the official graduation application deadline",
      "Ask the relevant BYU office about next steps after graduation"
    ],
    links: [
      ["Graduation (Registrar)", "https://registrar.byu.edu"]
    ]
  }
];

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

      const guidance = JOURNEY_STAGES[stage];
        const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

        const geminiResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" +
            encodeURIComponent(model) + ":generateContent",
        {
            method: "POST",
            headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.GEMINI_API_KEY
            },
            signal: AbortSignal.timeout(25000),
            body: JSON.stringify({
            systemInstruction: {
                parts: [{
                text: [
                    "You help students navigate BYU resources.",
                    "Generate exactly three short, practical suggested actions.",
                    "Use only the supplied stage guidance.",
                    "Make each action one or two sentences, at most 60 words.",
                    "Do not simply copy the guidance; explain a useful way to act on it.",
                    "The selected stage does not prove completion of earlier tasks.",
                    "Do not invent deadlines, costs, eligibility rules, or requirements.",
                    "Do not provide legal, immigration, or tax advice.",
                    "For those subjects, direct students to the listed office or a qualified professional.",
                    "Do not include URLs, HTML, or Markdown.",
                    "Do not claim you booked, submitted, registered, or completed anything."
                ].join(" ")
                }]
            },
            contents: [{
                role: "user",
                parts: [{
                text: JSON.stringify({
                    selectedStage: guidance.title,
                    guidance: guidance.steps,
                    resourceNames: guidance.links.map(link => link[0])
                })
                }]
            }],
            generationConfig: {
                maxOutputTokens: 4096,
                responseMimeType: "application/json",
                responseJsonSchema: {
                type: "object",
                properties: {
                    actions: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 3,
                    maxItems: 3
                    }
                },
                required: ["actions"],
                additionalProperties: false
                }
            }
            })
        }
        );

        if (!geminiResponse.ok) {
        const status = geminiResponse.status;

        // Log only the status, never credentials or student data.
        const details = await geminiResponse.json().catch(() => ({}));

        const safeMessage = String(details.error?.message || "")
        .replaceAll(process.env.GEMINI_API_KEY, "[REDACTED]")
        .slice(0, 300);

        console.error(
        "Gemini request failed:",
        status,
        details.error?.status || "",
        safeMessage
        );

        return reply(status === 429 ? 429 : 502, {
            error: status === 429
            ? "AI usage limits have been reached. Please try again later."
            : "AI generation is unavailable. Please try again later."
        });
        }

        const generated = await geminiResponse.json();
        const candidate = generated.candidates?.[0];

        if (candidate?.finishReason !== "STOP") {
        return reply(502, {
            error: "The AI could not finish a plan. Please try again."
        });
        }

        const text = (candidate.content?.parts || [])
        .filter(part => !part.thought && typeof part.text === "string")
        .map(part => part.text)
        .join("");

        let plan;

        try {
        plan = JSON.parse(text);
        } catch {
        return reply(502, {
            error: "The AI returned an unreadable plan. Please try again."
        });
        }

        if (
        !Array.isArray(plan.actions) ||
        plan.actions.length !== 3 ||
        !plan.actions.every(action =>
            typeof action === "string" &&
            action.trim().length > 0 &&
            action.length <= 700
        )
        ) {
        return reply(502, {
            error: "The AI returned an incomplete plan. Please try again."
        });
        }

        return reply(200, {
        stage,
        title: "Suggested next steps: " + guidance.title,
        actions: plan.actions.map(action => action.trim()),
        links: guidance.links
        });

   } catch (error) {
  console.error(
    "Journey request exception:",
    error.name,
    error.cause?.code || "no connection code"
  );

  var timedOut =
    error.name === "TimeoutError" ||
    error.name === "AbortError";

  return reply(timedOut ? 504 : 503, {
    error: timedOut
      ? "Generating your plan took too long. Please try again."
      : "The journey service could not connect. Please try again."
  });
}
  }
};