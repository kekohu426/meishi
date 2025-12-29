/**
 * Recipe Schema 验证器
 *
 * 严格遵循 PRD Schema v1.1.0
 * 确保所有数据符合 PRD 定义
 */

import { z } from "zod";

// ==================== 枚举定义 ====================

const DifficultyEnum = z.enum(["easy", "medium", "hard"]);

const IconKeyEnum = z.enum([
  "meat",     // 肉类
  "veg",      // 蔬菜
  "fruit",    // 水果
  "seafood",  // 海鲜
  "grain",    // 谷物
  "bean",     // 豆类
  "dairy",    // 奶制品
  "egg",      // 蛋类
  "spice",    // 香料
  "sauce",    // 酱料
  "oil",      // 油脂
  "other",    // 其他
]);

const RatioEnum = z.enum(["16:9", "4:3", "3:2"]);

// ==================== Summary（摘要）====================

const SummarySchema = z.object({
  oneLine: z.string().min(1, "一句话简介不能为空"),
  healingTone: z.string().min(1, "治愈文案不能为空"),
  difficulty: DifficultyEnum,
  timeTotalMin: z.number().positive("总时间必须大于0"),
  timeActiveMin: z.number().positive("操作时间必须大于0"),
  servings: z.number().positive("份量必须大于0"),
});

// ==================== Story（文化故事）====================

const StorySchema = z.object({
  title: z.string().min(1, "故事标题不能为空"),
  content: z.string().min(50, "故事内容至少50字").max(500, "故事内容最多500字"),
  tags: z.array(z.string()).min(1, "至少需要1个标签"),
});

// ==================== Ingredients（食材）====================

const IngredientItemSchema = z.object({
  name: z.string().min(1, "食材名称不能为空"),
  iconKey: IconKeyEnum,
  amount: z.number().positive("数量必须大于0"),
  unit: z.string().min(1, "单位不能为空"),
  notes: z.string().optional(),
});

const IngredientSectionSchema = z.object({
  section: z.string().min(1, "分组名称不能为空"),
  items: z.array(IngredientItemSchema).min(1, "至少需要1个食材"),
});

const IngredientsSchema = z.array(IngredientSectionSchema).min(1, "至少需要1个食材分组");

// ==================== Steps（制作步骤）====================

const StepSchema = z.object({
  id: z.string().min(1, "步骤ID不能为空"),
  title: z.string().min(1, "步骤标题不能为空"),
  action: z.string().min(1, "步骤描述不能为空"),
  speechText: z.string().min(1, "语音文本不能为空"),
  timerSec: z.number().nonnegative("计时器秒数不能为负"),
  visualCue: z.string().min(1, "视觉信号不能为空"),
  failPoint: z.string().min(1, "失败检查点不能为空"),
  photoBrief: z.string().min(1, "图片描述不能为空"),
});

const StepsSchema = z.array(StepSchema).min(1, "至少需要1个步骤");

// ==================== StyleGuide（风格指南）====================

const StyleGuideSchema = z.object({
  theme: z.string().min(1, "主题不能为空"),
  lighting: z.string().min(1, "光线不能为空"),
  composition: z.string().min(1, "构图不能为空"),
  aesthetic: z.string().min(1, "美学风格不能为空"),
});

// ==================== ImageShots（配图方案）====================

const ImageShotSchema = z.object({
  key: z.string().min(1, "图片key不能为空"),
  imagePrompt: z.string().min(1, "AI提示词不能为空"),
  ratio: RatioEnum,
  imageUrl: z.string().optional(), // ✅ 新增：允许包含图片URL
});

const ImageShotsSchema = z.array(ImageShotSchema);

// ==================== 完整 Recipe Schema ====================

export const RecipeSchema = z.object({
  schemaVersion: z.literal("1.1.0"),
  titleZh: z.string().min(1, "中文标题不能为空"),
  titleEn: z.string().optional(),

  summary: SummarySchema,
  story: StorySchema,
  ingredients: IngredientsSchema,
  steps: StepsSchema,
  styleGuide: StyleGuideSchema,
  imageShots: ImageShotsSchema,
});

// ==================== 类型导出 ====================

export type RecipeData = z.infer<typeof RecipeSchema>;
export type Summary = z.infer<typeof SummarySchema>;
export type Story = z.infer<typeof StorySchema>;
export type IngredientItem = z.infer<typeof IngredientItemSchema>;
export type IngredientSection = z.infer<typeof IngredientSectionSchema>;
export type Step = z.infer<typeof StepSchema>;
export type StyleGuide = z.infer<typeof StyleGuideSchema>;
export type ImageShot = z.infer<typeof ImageShotSchema>;

// ==================== 验证函数 ====================

/**
 * 验证食谱数据是否符合 PRD Schema v1.1.0
 */
export function validateRecipe(data: unknown): RecipeData {
  return RecipeSchema.parse(data);
}

/**
 * 安全验证（返回结果而非抛出异常）
 */
export function safeValidateRecipe(data: unknown) {
  return RecipeSchema.safeParse(data);
}

/**
 * 仅验证 Summary
 */
export function validateSummary(data: unknown) {
  return SummarySchema.parse(data);
}

/**
 * 仅验证 Ingredients
 */
export function validateIngredients(data: unknown) {
  return IngredientsSchema.parse(data);
}

/**
 * 仅验证 Steps
 */
export function validateSteps(data: unknown) {
  return StepsSchema.parse(data);
}
