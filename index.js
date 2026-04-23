import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ GOOGLE SHEET (YOUR SCRIPT)
const SHEET_URL = "https://opensheet.elk.sh/1uiYQVcLvxQL83_DMNcE0OG4oeLVOAhkp8fa2MfMKpKY/Sheet1";

let scriptSteps = [];

// Load script
async function loadScript() {
  const res = await fetch(SHEET_URL);
  scriptSteps = await res.json();
  console.log("✅ Script loaded:", scriptSteps.length, "steps");
}

// Get step
function getStep(stepName) {
  return scriptSteps.find(s => s.step === stepName);
}

// ✅ SESSION STORAGE
let sessions = {};

function getSession(sessionId) {
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      step: "opening",
      objectionCount: 0,
    };
  }
  return sessions[sessionId];
}

// Load script at start
await loadScript();

// Basic route
app.get("/", (req, res) => {
  res.send("AI Caller is running 🚀");
});

// 🧠 MAIN ENDPOINT
app.post("/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({ error: "message + sessionId required" });
    }

    const session = getSession(sessionId);
    const stepData = getStep(session.step);

    if (!stepData) {
      return res.status(500).json({ error: "Step not found in sheet" });
    }

    // 🧠 1. CLASSIFY USER INTENT
    const analysis = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Classify the user message into ONE of these:
YES
NO
UNCLEAR
OBJECTION
INSULT
NON_SERIOUS

Return ONLY one word.
`
        },
        { role: "user", content: message }
      ]
    });

    const intent = analysis.choices[0].message.content.trim();

    console.log("🧠 Intent:", intent);

    // 🛑 INSULT → END
    if (intent === "INSULT") {
      return res.json({
        reply: "D’accord, je vous souhaite une excellente journée.",
        end: true
      });
    }

    // 🤡 NON SERIOUS
    if (intent === "NON_SERIOUS") {
      session.objectionCount++;

      if (session.objectionCount === 1) {
        return res.json({ reply: "Mr/Mme, restons sérieux s’il vous plaît." });
      }

      if (session.objectionCount === 2) {
        return res.json({ reply: "J’ai vraiment besoin de réponses sérieuses pour continuer." });
      }

      return res.json({
        reply: "D’accord, je ne peux pas valider les critères.",
        end: true
      });
    }

    // 🧱 OBJECTION
    if (intent === "OBJECTION") {
      session.objectionCount++;

      const objectionReply = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
Answer briefly (max 1 sentence), then RE-ASK the SAME question:

"${stepData.question}"
`
          },
          { role: "user", content: message }
        ]
      });

      return res.json({
        reply: objectionReply.choices[0].message.content
      });
    }

    // ✅ RESET objection count if normal answer
    session.objectionCount = 0;

    // 🔁 DETERMINE NEXT STEP
    let nextStep;

    if (intent === "YES") {
      nextStep = stepData.next_if_yes;
    } else if (intent === "NO") {
      nextStep = stepData.next_if_no;
    } else {
      nextStep = stepData.next_if_unclear;
    }

    if (!nextStep || nextStep === "end") {
      return res.json({
        reply: "D’accord, je vous souhaite une excellente journée.",
        end: true
      });
    }

    session.step = nextStep;

    const nextStepData = getStep(session.step);

    if (!nextStepData) {
      return res.status(500).json({ error: "Next step not found" });
    }

    // 🤖 GENERATE QUESTION
    const replyGen = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a French outbound call agent.

Ask this EXACT question naturally:
"${nextStepData.question}"

Rules:
- Short
- Natural
- Confident
- No extra explanation
`
        }
      ]
    });

    const reply = replyGen.choices[0].message.content;

    res.json({
      reply,
      step: session.step
    });

  } catch (error) {
    console.error("FULL ERROR:", error);

    res.status(500).json({
      error: error.message
    });
  }
});

// START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
