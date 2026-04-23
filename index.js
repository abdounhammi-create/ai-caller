import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json());

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Test route
app.get("/", (req, res) => {
  res.send("AI Caller is running 🚀");
});

// Main AI route (this is your "brain")
app.post("/talk", async (req, res) => {
  try {
    const { message } = req.body;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a professional outbound call agent.

Your goal:
- Speak like a real human
- Follow a sales script
- Be short, natural, persuasive
- Handle objections
- Keep the conversation going

Never sound like a robot.
          `,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const reply = response.choices[0].message.content;

    res.json({ reply });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error with AI");
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
