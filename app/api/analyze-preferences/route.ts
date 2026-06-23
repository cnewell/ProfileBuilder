import { Anthropic } from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const { prompt } = await request.json();

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
            system: "Provide a clear, natural language summary of the travel preferences you can identify from the text provided. Focus on destinations, activities, travel style, accommodation preferences, and any other travel-related preferences mentioned.",
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
          }),
          client.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 1024,
            system: "Extract the travel preferences and return them as a JSON object with a 'preferences' property containing an array of strings. Each string should be a specific preference or interest.",
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
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
