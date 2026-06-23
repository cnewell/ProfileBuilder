import { Anthropic } from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const { messages, preferences } = await request.json();

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const encoder = new TextEncoder();

  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const [textStream, jsonStream] = await Promise.all([
          client.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 1024,
            system: `You are a helpful travel advisor having a conversation with a user to help them clarify and expand on their travel preferences.

Current preferences identified:
${JSON.stringify(preferences, null, 2)}

Based on this conversation and the current state of their preferences:
- Review what has already been identified (preferences with "preferred" or "forbidden" values populated)
- Ask thoughtful follow-up questions about areas that haven't been explored yet (categories with empty "preferred" and "forbidden" arrays)
- Engage naturally and conversationally, showing genuine interest in their travel aspirations
- Help them think through their preferences in a deeper way
- Offer gentle suggestions or observations based on their responses

Respond conversationally, as if you're having a real discussion with someone about their travel dreams.`,
            messages: messages,
          }),
          client.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 1024,
            system: `Extract the travel preferences from the user's input and return a JSON object matching this schema:

{
  "preferences": [
    {
      "name": "Month of Travel",
      "legal-values": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      "preferred": [],
      "forbidden": []
    },
    {
      "name": "Region",
      "legal-values": ["North America", "Central America", "South America", "Caribbean", "Western Europe", "Eastern Europe", "North Africa", "Sub-Saharan Africa", "Middle East", "Central Asia", "East Asian and Japan", "Australia and Pacific Islands"],
      "preferred": [],
      "forbidden": []
    },
    {
      "name": "Duration",
      "legal-values": ["Day Trip", "Weekend", "One Week", "Two Weeks", "More than two weeks"],
      "preferred": [],
      "forbidden": []
    }
  ]
}

Instructions:
- Populate the "preferred" and "forbidden" lists based on what the user specifies
- Only include the three preference categories listed above
- Normalize user input to match values in legal-values (e.g., "Paris" → "Western Europe" for Region, "can't take more than a week" → add "Two Weeks" and "More than two weeks" to Duration forbidden)
- Do not include values in the forbidden list solely because they were not mentioned as preferences
- Do NOT enforce disjoint lists - preferred and forbidden lists do NOT need to be mutually exclusive
- If the user's input contains text that justifies placing the same value in both preferred and forbidden lists (e.g., "I love beaches but I'm allergic to salt water"), do so without hesitation
- The "name" and "legal-values" fields are read-only and must not be modified

CRITICAL: Your response must consist ENTIRELY of valid, parsable JSON. Include absolutely no commentary, explanations, text, or anything outside the JSON object. No markdown code blocks, no preamble, no closing remarks. Only output the JSON object itself.`,
            messages: messages,
          }),
        ]);

        controller.enqueue(
          encoder.encode(`event: text_start\ndata: {}\n\n`)
        );
        controller.enqueue(
          encoder.encode(`event: json_start\ndata: {}\n\n`)
        );

        await Promise.all([
          (async () => {
            for await (const chunk of textStream) {
              if (
                chunk.type === "content_block_delta" &&
                chunk.delta.type === "text_delta"
              ) {
                const data = {
                  type: "text_chunk",
                  content: chunk.delta.text,
                };
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
                );
              }
            }
            controller.enqueue(
              encoder.encode(`event: text_end\ndata: {}\n\n`)
            );
          })(),
          (async () => {
            for await (const chunk of jsonStream) {
              if (
                chunk.type === "content_block_delta" &&
                chunk.delta.type === "text_delta"
              ) {
                const data = {
                  type: "json_chunk",
                  content: chunk.delta.text,
                };
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
                );
              }
            }
            controller.enqueue(
              encoder.encode(`event: json_end\ndata: {}\n\n`)
            );
          })(),
        ]);

        controller.close();
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
