/**
 * AI生成菜谱服务
 *
 * 使用GLM生成符合PRD Schema v1.1.0的完整菜谱JSON
 */

import { getTextProvider } from "./provider";
import { safeValidateRecipe } from "../validators/recipe";
import type { Recipe } from "@/types/recipe";

/**
 * 生成菜谱的提示词模板
 */
function buildRecipePrompt(params: {
  dishName: string;
  location?: string;
  cuisine?: string;
  mainIngredients?: string[];
}): string {
  const { dishName, location, cuisine, mainIngredients } = params;

  return `你是一位专业的美食文化研究者和菜谱编写专家。你的任务是:根据用户输入的菜名与约束，生成可直接用于网站渲染与AI出图的“菜谱图文原数据”。

${location ? `地点：${location}\n` : ""}${cuisine ? `菜系：${cuisine}\n` : ""}${mainIngredients && mainIngredients.length > 0 ? `主要食材：${mainIngredients.join("、")}\n` : ""}

**总体要求：**
1. 严格输出JSON: 顶层必须包含schemaVersion与recipe对象。
2. 语言: 中文为主，英文名为辅。
3. 可执行性: 步骤必须包含动作、火候、精确时间、视觉信号(visualCue)、失败检查点。
4. 视觉美学: styleGuide必须统一为“治愈系暖调/自然光/留白/吉卜力或日杂风”。
5. AI绘图指令: imageShots必须提供全套Prompt，且Prompt中要加入"no text, no watermark"等负面词，必须使用英文。
6. 文化深度: story字段要写出《舌尖上的中国》风格的短文案。
7. 图标映射: ingredients中必须包含iconKey(枚举: meat, veg, fruit, seafood, grain, bean, dairy, egg, spice, sauce, oil, tool, other)以便前端匹配图标。
8. 语音适配: step中包含speechText，口语化简练指令。
9. 数据格式: JSON中不能包含注释，不能有trailing comma，字符串中的引号必须转义。

**JSON Schema（必须严格遵循）：**

\`\`\`json
{
  "schemaVersion": "1.1.0",
  "recipe": {
    "id": "string",
    "titleZh": "string",
    "titleEn": "string",
    "summary": {
      "oneLine": "string",
      "healingTone": "string",
      "difficulty": "easy|medium|hard",
      "timeTotalMin": 0,
      "timeActiveMin": 0,
      "servings": 1
    },
    "story": {
      "title": "string (文采标题)",
      "content": "string (150字左右文化渊源)",
      "tags": ["string"]
    },
    "ingredients": [
      {
        "section": "string",
        "items": [
          {
            "name": "string",
            "iconKey": "meat|veg|fruit|seafood|grain|bean|dairy|egg|spice|sauce|oil|other",
            "amount": 0,
            "unit": "string",
            "notes": "string|null"
          }
        ]
      }
    ],
    "steps": [
      {
        "id": "step01",
        "title": "string",
        "action": "string (详细描述)",
        "speechText": "string (简练语音指令)",
        "timerSec": 0,
        "visualCue": "string (看到什么状态)",
        "failPoint": "string",
        "photoBrief": "string"
      }
    ],
    "styleGuide": {
      "theme": "治愈系暖调",
      "lighting": "自然光",
      "composition": "留白",
      "aesthetic": "吉卜力或日杂风"
    },
    "imageShots": [
      {
        "key": "cover|step01|ingredients",
        "imagePrompt": "string (English prompt)",
        "ratio": "16:9|4:3|3:2"
      }
    ]
  }
}
\`\`\`

**One-Shot 示例（参考此风格）：**
\`\`\`json
{
  "schemaVersion": "1.1.0",
  "recipe": {
    "id": "tomato-egg-stirfry-001",
    "titleZh": "番茄炒蛋",
    "titleEn": "Tomato and Egg Stir-Fry",
    "summary": {
      "oneLine": "酸甜交织的家常温暖，唤醒儿时记忆。",
      "healingTone": "温柔治愈，像母亲的拥抱般温暖。",
      "difficulty": "easy",
      "timeTotalMin": 15,
      "timeActiveMin": 10,
      "servings": 2
    },
    "story": {
      "title": "酸甜的乡愁",
      "content": "在广袤的中国大地上，番茄炒蛋如一缕阳光，洒进无数寻常百姓的餐桌。它源于上世纪的改革开放时代，西方番茄遇上东方鸡蛋，碰撞出酸甜的和谐。农家小院里，母亲手持铁锅，翻炒间香气四溢，承载着对丰收的感恩与对家人的眷恋。这道菜不需华丽调味，却能慰藉游子心魂，诉说着中国饮食文化的包容与温情，仿佛一碗热汤，融化冬日的寒意，唤醒内心深处的宁静与满足。",
      "tags": ["家常菜", "中国传统", "温暖回忆"]
    },
    "ingredients": [
      {
        "section": "主料",
        "items": [
          {
            "name": "番茄",
            "iconKey": "veg",
            "amount": 3,
            "unit": "个",
            "notes": "选择熟透的红色番茄"
          },
          {
            "name": "鸡蛋",
            "iconKey": "egg",
            "amount": 4,
            "unit": "个",
            "notes": null
          }
        ]
      },
      {
        "section": "调味",
        "items": [
          {
            "name": "盐",
            "iconKey": "spice",
            "amount": 1,
            "unit": "茶匙",
            "notes": null
          },
          {
            "name": "糖",
            "iconKey": "spice",
            "amount": 1,
            "unit": "茶匙",
            "notes": "用于平衡酸味"
          }
        ]
      }
    ],
    "steps": [
      {
        "id": "step01",
        "title": "准备材料",
        "action": "将番茄洗净切成小块，鸡蛋打入碗中搅拌均匀至起泡，葱切成葱花备用。",
        "speechText": "先洗番茄切块，打蛋搅匀，切点葱花。",
        "timerSec": 0,
        "visualCue": "鸡蛋液呈均匀金黄色，番茄块鲜亮多汁。",
        "failPoint": "鸡蛋搅拌不匀会导致炒蛋不嫩滑。",
        "photoBrief": "切好的番茄与打散的蛋液特写"
      },
      {
        "id": "step02",
        "title": "炒蛋",
        "action": "热锅倒入1汤匙油，中火加热至油温7成热，倒入蛋液快速翻炒至凝固成块，盛出备用。",
        "speechText": "热锅加油，倒蛋液快炒成块，盛出来。",
        "timerSec": 30,
        "visualCue": "蛋块金黄松软，不粘锅底。",
        "failPoint": "火太大蛋会焦糊，火太小蛋不蓬松。",
        "photoBrief": "锅中金黄蛋块翻炒瞬间"
      }
    ],
    "styleGuide": {
      "theme": "治愈系暖调",
      "lighting": "自然光",
      "composition": "留白",
      "aesthetic": "吉卜力或日杂风"
    },
    "imageShots": [
      {
        "key": "cover",
        "imagePrompt": "A warm, healing plate of tomato and egg stir-fry, golden eggs mixed with juicy red tomatoes, soft steam rising, natural light, ample white space, Ghibli-style cozy kitchen background, no text, no watermark, high detail, vibrant colors",
        "ratio": "16:9"
      },
      {
        "key": "step01",
        "imagePrompt": "Close-up of scrambling eggs in wok, golden fluffy texture, warm tones, natural light filtering in, empty space around, Ghibli-inspired soft focus, no text, no watermark, appetizing details",
        "ratio": "4:3"
      }
    ]
  }
}
\`\`\`

**现在请为"${dishName}"生成完整的菜谱JSON数据：**
（请直接输出JSON，不要包含任何markdown代码块标记）`;
}

/**
 * 清理AI返回的JSON字符串
 */
export function cleanAIResponse(response: string): string {
  // 移除markdown代码块标记
  let cleaned = response.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "");
  cleaned = cleaned.replace(/^```\s*/i, "");
  cleaned = cleaned.replace(/\s*```$/i, "");
  cleaned = cleaned.trim();

  // 移除JSON前后可能的多余文字
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');

  if (jsonStart >= 0 && jsonEnd >= 0 && jsonEnd > jsonStart) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }

  // 移除可能的注释（// 或 /* */）
  cleaned = cleaned.replace(/\/\/.*$/gm, '');  // 单行注释
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, ''); // 多行注释

  // 移除trailing commas（JSON不允许）
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  // 修复常见的数学表达式（AI经常生成 1/2, 1/3 等）
  // 将 "amount": 1/2 转换为 "amount": 0.5
  cleaned = cleaned.replace(/"amount":\s*1\/2/g, '"amount": 0.5');
  cleaned = cleaned.replace(/"amount":\s*1\/3/g, '"amount": 0.33');
  cleaned = cleaned.replace(/"amount":\s*2\/3/g, '"amount": 0.67');
  cleaned = cleaned.replace(/"amount":\s*1\/4/g, '"amount": 0.25');
  cleaned = cleaned.replace(/"amount":\s*3\/4/g, '"amount": 0.75');
  cleaned = cleaned.replace(/"amount":\s*(\d+)\/(\d+)/g, (match, num, denom) => {
    return `"amount": ${parseFloat(num) / parseFloat(denom)}`;
  });

  // 修复未加引号的字符串字段（amount/unit/notes）
  cleaned = cleaned.replace(
    /"(amount|unit|notes)"\s*:\s*([^\d"{}\[\]-][^,\n}]*)/g,
    (match, key, rawValue) => {
      const value = String(rawValue).trim();
      if (value === "null") {
        return `"${key}": null`;
      }
      return `"${key}": "${value.replace(/"/g, '\\"')}"`;
    }
  );

  return cleaned.trim();
}

/**
 * 标准化AI生成的数据
 * 将字符串类型的数字转换为数字类型
 */
export function normalizeRecipeData(data: any): any {
  if (!data) return data;

  // 转换 summary 中的数字字段
  if (data.summary) {
    if (typeof data.summary.timeTotalMin === 'string') {
      data.summary.timeTotalMin = parseInt(data.summary.timeTotalMin, 10);
    }
    if (typeof data.summary.timeActiveMin === 'string') {
      data.summary.timeActiveMin = parseInt(data.summary.timeActiveMin, 10);
    }
    if (typeof data.summary.servings === 'string') {
      data.summary.servings = parseInt(data.summary.servings, 10);
    }
  }

  // 转换 ingredients 中的 amount 字段
  if (data.ingredients && Array.isArray(data.ingredients)) {
    data.ingredients.forEach((section: any) => {
      if (section.items && Array.isArray(section.items)) {
        section.items.forEach((item: any) => {
          if (typeof item.amount === 'string') {
            const numeric = parseFloat(item.amount);
            if (Number.isNaN(numeric)) {
              const amountLabel = item.amount.trim();
              item.amount = 1;
              if (!item.unit || String(item.unit).trim().length === 0) {
                item.unit = amountLabel;
              }
            } else {
              item.amount = numeric;
            }
          }
        });
      }
    });
  }

  // 转换 steps 中的 timerSec 字段
  if (data.steps && Array.isArray(data.steps)) {
    data.steps.forEach((step: any) => {
      if (typeof step.timerSec === 'string') {
        step.timerSec = parseInt(step.timerSec, 10);
      }
    });
  }

  return data;
}

/**
 * 生成单个菜谱
 */
export async function generateRecipe(params: {
  dishName: string;
  location?: string;
  cuisine?: string;
  mainIngredients?: string[];
}): Promise<{ success: true; data: Recipe } | { success: false; error: string }> {
  try {
    const provider = getTextProvider();

    // 构建提示词
    const prompt = buildRecipePrompt(params);

    // 调用AI生成
    const response = await provider.chat({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      maxTokens: 6000,
    });

    // 清理响应
    const cleanedContent = cleanAIResponse(response.content);

    // 解析JSON
    let recipeData: any;
    try {
      recipeData = JSON.parse(cleanedContent);
      
      // 兼容处理：如果AI返回的数据包裹在recipe字段中，提取出来
      if (recipeData.recipe && typeof recipeData.recipe === 'object') {
        const { recipe, ...rest } = recipeData;
        recipeData = {
          ...rest,
          ...recipe
        };
      }
    } catch (parseError) {
      console.error("JSON解析失败:", parseError);
      console.error("原始内容（前500字符）:", response.content.substring(0, 500));
      console.error("清理后内容（前500字符）:", cleanedContent.substring(0, 500));

      // 尝试找到错误位置
      if (parseError instanceof SyntaxError && parseError.message.includes('position')) {
        const match = parseError.message.match(/position (\d+)/);
        if (match) {
          const pos = parseInt(match[1]);
          const context = cleanedContent.substring(Math.max(0, pos - 50), Math.min(cleanedContent.length, pos + 50));
          console.error("错误位置上下文:", context);
        }
      }

      return {
        success: false,
        error: `JSON解析失败：${parseError instanceof Error ? parseError.message : String(parseError)}`,
      };
    }

    // 标准化数据（转换字符串数字为数字类型）
    recipeData = normalizeRecipeData(recipeData);

    // 验证格式
    const validation = safeValidateRecipe(recipeData);

    if (!validation.success) {
      console.error("Schema验证失败:", validation.error.issues);
      return {
        success: false,
        error: `Schema验证失败：${validation.error.issues.map((i) => i.message).join(", ")}`,
      };
    }

    return {
      success: true,
      data: validation.data,
    };
  } catch (error) {
    console.error("生成菜谱失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 批量生成菜谱
 */
export async function generateRecipesBatch(
  dishNames: string[],
  options?: {
    location?: string;
    cuisine?: string;
    onProgress?: (current: number, total: number, dishName: string) => void;
  }
): Promise<{
  success: number;
  failed: number;
  results: Array<{
    dishName: string;
    success: boolean;
    data?: Recipe;
    error?: string;
  }>;
}> {
  const results: Array<{
    dishName: string;
    success: boolean;
    data?: Recipe;
    error?: string;
  }> = [];

  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < dishNames.length; i++) {
    const dishName = dishNames[i];

    // 触发进度回调
    if (options?.onProgress) {
      options.onProgress(i + 1, dishNames.length, dishName);
    }

    // 生成单个菜谱
    const result = await generateRecipe({
      dishName,
      location: options?.location,
      cuisine: options?.cuisine,
    });

    if (result.success) {
      successCount++;
      results.push({
        dishName,
        success: true,
        data: result.data,
      });
    } else {
      failedCount++;
      results.push({
        dishName,
        success: false,
        error: result.error,
      });
    }

    // 避免API限流，每次请求间隔1秒
    if (i < dishNames.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return {
    success: successCount,
    failed: failedCount,
    results,
  };
}
