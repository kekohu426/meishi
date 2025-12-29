/**
 * AI生成单个菜谱 API
 *
 * POST /api/ai/generate-recipe - 生成单个菜谱并保存到数据库
 */

import { NextRequest, NextResponse } from "next/server";
import { generateRecipe } from "@/lib/ai/generate-recipe";
import { prisma } from "@/lib/db/prisma";
import { evolinkClient } from "@/lib/ai/evolink";
import { uploadImage, generateSafeFilename } from "@/lib/utils/storage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dishName, location, cuisine, mainIngredients, autoSave } = body;

    if (!dishName) {
      return NextResponse.json(
        { success: false, error: "dishName 为必填项" },
        { status: 400 }
      );
    }

    // 调用AI生成
    const result = await generateRecipe({
      dishName,
      location,
      cuisine,
      mainIngredients,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // 如果autoSave为true，自动保存到数据库
    if (autoSave !== false) {
      // 生成slug
      const slug = `${result.data.titleZh.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;

      // 尝试生成所有配图
      let coverImage: string | undefined;
      let imageError: string | undefined;
      
      try {
        if (result.data.imageShots && result.data.imageShots.length > 0) {
          console.log(`准备生成 ${result.data.imageShots.length} 张配图...`);
          
          // 串行生成所有图片（避免并发限流）
          for (const shot of result.data.imageShots) {
            try {
              if (!shot.imagePrompt) continue;

              console.log(`正在生成图片 [${shot.key}]...`);
              
              // 根据比例确定尺寸
              let width = 1024;
              let height = 1024;
              if (shot.ratio === "16:9") { height = 576; }
              else if (shot.ratio === "4:3") { height = 768; }
              else if (shot.ratio === "3:2") { height = 683; }

              const imageResult = await evolinkClient.generateImage({
                prompt: shot.imagePrompt,
                width,
                height,
                timeoutMs: 60000, // 增加超时时间到60秒
                retries: 2,       // 增加重试次数
              });

              if (imageResult.success && imageResult.imageUrl) {
                console.log(`图片 [${shot.key}] 生成成功:`, imageResult.imageUrl);
                let finalImageUrl = imageResult.imageUrl;

                // 尝试转存到 R2 (如果配置了)
                if (process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID) {
                  try {
                    console.log(`正在转存图片 [${shot.key}] 到 R2...`);
                    const imageRes = await fetch(imageResult.imageUrl);
                    if (imageRes.ok) {
                      const arrayBuffer = await imageRes.arrayBuffer();
                      const buffer = Buffer.from(arrayBuffer);
                      const path = generateSafeFilename(`image.png`, `recipes/${slug}`);
                      
                      finalImageUrl = await uploadImage(buffer, path);
                      console.log(`图片 [${shot.key}] 转存成功:`, finalImageUrl);
                    }
                  } catch (uploadErr) {
                    console.error(`图片 [${shot.key}] 转存 R2 失败，保留原链接:`, uploadErr);
                  }
                }

                shot.imageUrl = finalImageUrl; // 将最终 URL (R2 或 Evolink) 存入 imageShot 对象
                
                // 如果是封面图，记录下来
                if (shot.key === "hero" || shot.key === "cover") {
                  coverImage = finalImageUrl;
                }
              } else {
                console.error(`图片 [${shot.key}] 生成失败:`, imageResult.error);
                if (shot.key === "hero" || shot.key === "cover") {
                  imageError = imageResult.error;
                }
              }
            } catch (err) {
              console.error(`图片 [${shot.key}] 生成出错:`, err);
            }
          }

          // 打印一下最终的 imageShots 数据，确认 imageUrl 是否存在
          console.log("图片生成完成，准备保存到数据库。ImageShots:", JSON.stringify(result.data.imageShots.map((s: any) => ({ k: s.key, url: s.imageUrl })), null, 2));

          // 如果没有明确的 cover/hero，尝试使用第一张成功的图片作为封面
          if (!coverImage && result.data.imageShots.length > 0) {
             const firstSuccess = result.data.imageShots.find((s: any) => s.imageUrl);
             if (firstSuccess) {
               coverImage = firstSuccess.imageUrl;
             }
          }
        }
      } catch (err) {
        console.error("生成配图过程出错:", err);
        imageError = err instanceof Error ? err.message : "配图生成失败";
      }

      const recipe = await prisma.recipe.create({
        data: {
          schemaVersion: result.data.schemaVersion,
          titleZh: result.data.titleZh,
          titleEn: result.data.titleEn,
          summary: result.data.summary as any,
          story: result.data.story as any,
          ingredients: result.data.ingredients as any,
          steps: result.data.steps as any,
          styleGuide: result.data.styleGuide as any,
          imageShots: result.data.imageShots as any,
          location,
          cuisine,
          mainIngredients: mainIngredients || [],
          slug,
          coverImage, // 添加生成的封面图
          aiGenerated: true,
          isPublished: false, // 默认不发布，需要人工审核
        },
      });

      return NextResponse.json({
        success: true,
        data: recipe,
        message: `菜谱"${result.data.titleZh}"生成成功并已保存${coverImage ? "，封面图已生成" : "（封面图生成失败，可在编辑页重新生成）"}`,
        imageError,
      });
    }

    // 不自动保存，只返回生成的数据
    return NextResponse.json({
      success: true,
      data: result.data,
      message: `菜谱"${result.data.titleZh}"生成成功`,
    });
  } catch (error) {
    console.error("生成菜谱失败:", error);
    return NextResponse.json(
      { success: false, error: "生成菜谱失败" },
      { status: 500 }
    );
  }
}
