require('dotenv').config();
const OpenAI = require('openai');
const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1"
});

async function main() {
  try {
    const chatCompletion = await client.chat.completions.create({
      messages: [{ role: 'user', content: 'Say hello' }],
      model: 'grok-3',
      stream: false,
    });
    console.log(chatCompletion.choices[0].message.content);
  } catch (err) {
    console.error("Error:", err.message);
  }
}
main();
