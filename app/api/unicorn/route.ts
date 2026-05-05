import { OpenAI } from "openai";
import { NextResponse } from "next/server";

// .env.localからOPENAI_API_KEYを自動的に読み込みます
const client = new OpenAI();

export async function GET() {
    try {
        const response = await client.responses.create({
            model: "gpt-4o",
            input: "Write a short bedtime story about a unicorn.",
        });

        const story = response.output_text;

        // 取得した出力をログに表示
        console.log(story);

        return NextResponse.json({
            success: true,
            story: story
        });
    } catch (error: any) {
        console.error("GPT-4o Error:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
