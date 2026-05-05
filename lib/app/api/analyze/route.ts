import { OpenAI } from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
    try {
        const { duration, menu, insight } = await req.json();

        const input = `
あなたは「優しくて前向きな水泳コーチAI」です。
以下のユーザー記録を読み取り、指定されたJSON形式で整理・出力してください。

練習時間: ${duration}
メニュー: ${menu}
今日の気づき: ${insight}

【出力ルール】
必ず以下のJSON形式で、事実は変えずに、温かい口調で出力してください。
{
  "menu_fixed": "正しい水泳メニュー形式に整えた文章",
  "note_points": ["気づき①", "気づき②"],
  "coach_comment": "前向きな一言コメント"
}
`;

        const response = await client.responses.create({
            model: "gpt-4o",
            input: input,
            text: {
                format: { type: "json_object" }
            }
        });

        const analysis = JSON.parse(response.output_text);
        return NextResponse.json(analysis);

    } catch (error: any) {
        console.error("AI Analysis Error:", error);

        const errorMessage = error.error?.message || error.message || "AI解析に失敗しました";
        return NextResponse.json({
            error: errorMessage
        }, { status: 500 });
    }
}
