import { logger } from '../logger.js';

// ── ПРОМПТ 1: Копирайтер (текст поста) ──

const COPYWRITER_SYSTEM = `Ты — копирайтер бренда ESSA.AI (Катерина). Пишешь на русском.

Tone of Voice:
- живо и по-человечески
- короткие предложения, 1 мысль = 1 абзац
- спокойно, уверенно, дружелюбно
- без пафоса, штампов, давления

Запрещено:
- штампы ("в этом посте вы узнаете", "уникальная возможность")
- выдуманные данные
- обещания без подтверждения
- Markdown-звёздочки (**жирный**) — вместо них используй HTML: <b>жирный</b>
- лишние кавычки — пиши без «ёлочек» и "лапок" где они не нужны

Правила форматирования текста:
- Форматирование: HTML (<b>жирный</b>, <i>курсив</i>). НИКОГДА не используй Markdown-звёздочки!
- Абзацы разделяй пустой строкой
- Можно использовать 3-5 эмодзи на пост (уместно, не перегружая)
- Ссылку оформляй так: <a href="URL">текст ссылки</a>
- Максимум 800 символов для text_tg, 1500 для text_vk
- Текст должен быть самодостаточным и НЕ обрываться

Форматы (выбери 1):
A) Мини-кейс: было → сделали → результат → вывод
B) Разбор: проблема → решение → как устроено → эффект
C) Лайфхак: ситуация → приём → пример → ограничение
D) Миф/реальность: миф → реальность → пример → вывод
E) Дневник: что делала → что заметила → что поняла → вывод

Структура поста:
1. ЗАГОЛОВОК (обязательно, первая строка, с эмодзи, <b>жирный</b>)
2. Тело поста (2-4 абзаца)
3. Мягкий вывод/CTA
4. Хэштеги

ВЫХОД СТРОГО JSON (без лишнего текста, без markdown-блока):
{
  "platform": "both",
  "topic_id": "string",
  "hooks": ["вариант 1", "вариант 2", "вариант 3"],
  "post": {
    "headline": "Заголовок поста (2-5 слов, без эмодзи)",
    "text_tg": "готовый текст для Telegram (HTML, до 800 символов, с заголовком в начале)",
    "text_vk": "готовый текст для VK (без HTML, до 1500 символов, с заголовком в начале)",
    "hashtags_tg": ["тег1", "тег2"],
    "hashtags_vk": ["тег1", "тег2", "тег3", "тег4"],
    "cta_soft": "мягкая завершающая фраза",
    "case_link": null
  }
}`;

// ── ПРОМПТ 2: Визуальный ассистент (сцена для постера) ──

const VISUAL_SYSTEM = `Ты — визуальный ассистент для нейрофотосессий. Ты НЕ пишешь посты. Твоя единственная задача — отталкиваясь от темы, придумать визуальную сцену для инфографики и вернуть ответ СТРОГО в формате JSON.

Правила заполнения полей JSON:
1. "character": ВСЕГДА начинай описание с этой точной фразы, чтобы зафиксировать внешность:
"(CRUCIAL: EXACT FACIAL LIKENESS TO REFERENCE PHOTO REQUIRED:1.5). (IDENTITY LOCKED:1.4). A young woman with a soft heart-shaped face, light makeup with an accent on lips and eyes, and skin retouching."
После этой фразы просто допиши на английском, во что она одета под конкретную сцену (например: wearing a stylish tailored blazer). Одежду и причёску КАЖДЫЙ РАЗ придумывай РАЗНУЮ под тему (не повторяй чёрный пиджак!).
2. "action": Что делает персонаж и что находится вокруг неё (на английском). Обязательно контраст БЫЛО/СТАЛО: в одной руке проблема (бумаги, хаос), в другой — решение (планшет, телефон с ботом). Красная стрелка к проблеме, синяя неоновая стрелка к решению. Предметы КОНКРЕТНЫЕ (не holographic interface, а crumpled papers, glowing tablet with organized data).
3. "background": Фон сцены (на английском, с цифровыми элементами).
4. "title": Главный заголовок на карточке (на русском, 2-4 слова, КАПС).
5. "speech": Фраза персонажа в пузыре (на русском, до 8 слов).
6. "pointer_1": Выноска к проблеме (на русском, до 4 слов).
7. "pointer_2": Выноска к решению (на русском, до 4 слов).
8. "style": Теги качества (на английском). Всегда используй: High-end photography, cinematic lighting, sharp focus, 8k resolution.

ВЫХОД СТРОГО JSON (без лишнего текста, без markdown-блока):
{
  "character": "...",
  "action": "...",
  "background": "...",
  "title": "...",
  "speech": "...",
  "pointer_1": "...",
  "pointer_2": "...",
  "style": "..."
}`;

// ── Генерация черновика (двухступенчатая) ──

/**
 * Generate draft: step 1 = copywriter text, step 2 = visual scene for poster.
 */
export async function generateDraft(topic, shouldIncludeLink, generateTextFn, kieConfig) {
  // Step 1: Generate post text
  const copywriterPrompt = buildCopywriterPrompt(topic, shouldIncludeLink);
  let draft;
  try {
    const textResponse = await generateTextFn(`${COPYWRITER_SYSTEM}\n\n${copywriterPrompt}`, kieConfig);
    draft = parseJsonFromResponse(textResponse);
  } catch (err) {
    logger.error({ err: err.message, topic_id: topic.id }, '[DraftGenerator] Text generation failed');
    throw err;
  }

  // Post-process text
  draft.post.text_tg = cleanText(draft.post.text_tg);
  draft.post.text_vk = cleanTextVk(draft.post.text_vk);

  if (!shouldIncludeLink) {
    draft.post.case_link = null;
  } else if (topic.case_link && !draft.post.case_link) {
    draft.post.case_link = topic.case_link;
  }

  if (draft.post.case_link) {
    draft.post.text_tg = injectLinkTg(draft.post.text_tg, draft.post.case_link);
    draft.post.text_vk = injectLinkVk(draft.post.text_vk, draft.post.case_link);
  }

  if (draft.post.hashtags_tg?.length > 0) {
    draft.post.text_tg += '\n\n' + draft.post.hashtags_tg.map(h => h.startsWith('#') ? h : `#${h}`).join(' ');
  }
  if (draft.post.hashtags_vk?.length > 0) {
    draft.post.text_vk += '\n\n' + draft.post.hashtags_vk.map(h => h.startsWith('#') ? h : `#${h}`).join(' ');
  }

  // Step 2: Generate visual scene for poster
  const headline = draft.post.headline || topic.title;
  const visualPrompt = `Сцена: ${topic.title}. Угол: ${topic.angle}. Визуальная метафора: ${topic.visual_metaphor}. Заголовок карточки должен быть связан с: ${headline}`;

  try {
    const visualResponse = await generateTextFn(`${VISUAL_SYSTEM}\n\n${visualPrompt}`, kieConfig);
    const visual = parseJsonFromResponse(visualResponse);
    draft.poster = visual;
    draft.nano_prompt = buildNanoPrompt(visual);
  } catch (err) {
    logger.warn({ err: err.message, topic_id: topic.id }, '[DraftGenerator] Visual generation failed, using fallback');
    draft.poster = { title: headline };
    draft.nano_prompt = buildNanoPromptFallback(headline, topic);
  }

  logger.info({ topic_id: topic.id, has_link: !!draft.post.case_link }, '[DraftGenerator] Draft generated');
  return draft;
}

// ── Промпт для копирайтера ──

function buildCopywriterPrompt(topic, shouldIncludeLink) {
  let prompt = `Тема: ${topic.title}
Категория: ${topic.category}
Угол подачи: ${topic.angle}
Аудитория: ${topic.audience}`;

  if (topic.case_key && shouldIncludeLink) {
    prompt += `\nКейс: ${topic.case_key} (ссылка: ${topic.case_link}). Упомяни кейс по-человечески и в конце дай ссылку через <a href="${topic.case_link}">посмотреть пример</a>.`;
  } else if (topic.case_key) {
    prompt += `\nКейс: ${topic.case_key} (без ссылки сегодня). Можешь упомянуть кейс, но ссылку НЕ ставь (post.case_link=null).`;
  }

  prompt += `\n\nСгенерируй черновик СТРОГО в формате JSON (без markdown, без комментариев).`;
  return prompt;
}

// ── Сборка финального промпта для NanoBanana ──

function buildNanoPrompt(visual) {
  const character = visual.character || '(CRUCIAL: EXACT FACIAL LIKENESS TO REFERENCE PHOTO REQUIRED:1.5). (IDENTITY LOCKED:1.4). A young woman with a soft heart-shaped face, light makeup with an accent on lips and eyes, and skin retouching. Wearing a stylish blazer.';
  const action = visual.action || 'She is standing in a modern workspace with glowing digital elements.';
  const background = visual.background || 'a modern luxury office with ambient blue neon lighting';
  const title = visual.title || 'ЗАГОЛОВОК';
  const speech = visual.speech || '';
  const pointer1 = visual.pointer_1 || '';
  const pointer2 = visual.pointer_2 || '';
  const style = visual.style || 'High-end photography, cinematic lighting, sharp focus, 8k resolution';

  let prompt = `A vertical infographic poster. A highly detailed, realistic photo of ${character}.\n\n`;
  prompt += `${action}\n\n`;
  prompt += `Background is ${background}.\n\n`;
  prompt += `TEXT INSTRUCTIONS:\n`;
  prompt += `1. At the very top, large bold white text says: "${title}"\n`;
  if (speech) {
    prompt += `2. A speech bubble pointing to the character says: "${speech}"\n`;
  }
  prompt += `3. Neon pointer arrows pointing to the details with text:\n`;
  if (pointer1) prompt += `- "${pointer1}"\n`;
  if (pointer2) prompt += `- "${pointer2}"\n`;
  prompt += `\nSTYLE: ${style}`;

  return { prompt, constraints: '(CRUCIAL: EXACT FACIAL LIKENESS TO REFERENCE PHOTO REQUIRED:1.5). (IDENTITY LOCKED:1.4)' };
}

function buildNanoPromptFallback(headline, topic) {
  const prompt = `A vertical infographic poster. A highly detailed, realistic photo of (CRUCIAL: EXACT FACIAL LIKENESS TO REFERENCE PHOTO REQUIRED:1.5). (IDENTITY LOCKED:1.4). A young woman with a soft heart-shaped face, light makeup with an accent on lips and eyes, and skin retouching. Wearing a stylish blazer.\n\nShe is standing in a modern workspace, gesturing towards a glowing screen.\n\nBackground is a modern luxury office with ambient blue neon lighting.\n\nTEXT INSTRUCTIONS:\n1. At the very top, large bold white text says: "${headline}"\n\nSTYLE: High-end photography, cinematic lighting, sharp focus, 8k resolution`;
  return { prompt, constraints: '(CRUCIAL: EXACT FACIAL LIKENESS TO REFERENCE PHOTO REQUIRED:1.5). (IDENTITY LOCKED:1.4)' };
}

// ── Утилиты очистки текста ──

function cleanText(text) {
  if (!text) return '';
  const links = [];
  let protected_ = text.replace(/<a\s+href="([^"]*)">/g, (match) => {
    links.push(match);
    return `\x00LINK${links.length - 1}\x00`;
  });
  protected_ = protected_
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/__(.+?)__/g, '<b>$1</b>')
    .replace(/_(.+?)_/g, '<i>$1</i>')
    .replace(/[«»""]/g, '');
  let result = protected_;
  for (let i = 0; i < links.length; i++) {
    result = result.replace(`\x00LINK${i}\x00`, links[i]);
  }
  return result.trim();
}

function cleanTextVk(text) {
  if (!text) return '';
  const urls = [];
  let result = text.replace(/https?:\/\/[^\s<>"]+/g, (match) => {
    urls.push(match);
    return `\x00URL${urls.length - 1}\x00`;
  });
  result = result.replace(/<a href="([^"]*)">[^<]*<\/a>/g, (_, href) => {
    urls.push(href);
    return `\x00URL${urls.length - 1}\x00`;
  });
  result = result
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?b>/g, '')
    .replace(/<\/?i>/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/[«»""]/g, '');
  for (let i = 0; i < urls.length; i++) {
    result = result.replace(`\x00URL${i}\x00`, urls[i]);
  }
  return result.trim();
}

function injectLinkTg(text, link) {
  if (text.includes(link) || text.includes('href=')) return text;
  return text + `\n\n<a href="${link}">Посмотреть пример</a>`;
}

function injectLinkVk(text, link) {
  const linkNormalized = link.replace(/_/g, '');
  if (text.includes(link) || text.includes(linkNormalized)) return text;
  return text + `\n\nПосмотреть пример: ${link}`;
}

function parseJsonFromResponse(response) {
  let json = response.trim();
  if (json.startsWith('```')) {
    json = json.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '');
  }
  try {
    return JSON.parse(json);
  } catch (err) {
    logger.warn({ response: json.substring(0, 300) }, '[DraftGenerator] JSON parse failed, attempting cleanup');
    const match = json.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Could not parse draft JSON from response');
  }
}
