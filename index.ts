// Supabase Edge Function: menu-assistant
// Deploy:
// supabase functions deploy menu-assistant
// supabase secrets set OPENAI_API_KEY=sk-... OPENAI_MODEL=gpt-4.1-mini

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini';

    if (!apiKey) {
      return json({ error: 'OPENAI_API_KEY fehlt in Supabase Secrets.' }, 500);
    }

    const body = await req.json();
    const {
      theme,
      recipe,
      effort,
      platform,
      goal,
      note,
      businessContext
    } = body;

    const systemPrompt = `Du bist ein spezialisierter Social Media Strategist, Senior Copywriter und Snail-Mail-Commerce Experte für Menu Letters.

Brand-Kontext:
${businessContext}

Deine Aufgabe:
- Generiere aktuelle, realistisch umsetzbare Content-Ideen für Instagram Reels, TikTok, Stories oder Carousels.
- Passe alles an Menu Letters an: Snail Mail, Food, Design, Postkarten, vegetarische Rezepte, Slow Living, analoges Leben, kleine kreative Pausen.
- Denke in 2026 Social-Mechaniken: Hook in den ersten 2 Sekunden, Authentizität, Founder Story, Curiosity, Emotional ROI, Watchtime, Saves, Shares, klare CTA.
- Keine falschen Viral-Versprechen. Formuliere professionell, aber nahbar.
- Gib konkrete Beispiele: Szenen, Voice-over, Caption, Hashtags und Mini-To-dos.
- Sprache: Deutsch, natürlich, modern, freundlich.
- Tonalität: editorial, warm, persönlich, hochwertig.`;

    const userPrompt = {
      monthTheme: theme,
      monthlyRecipe: recipe,
      availableTime: effort,
      platform,
      contentGoal: goal,
      additionalNote: note
    };

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        ideas: {
          type: 'array',
          minItems: 4,
          maxItems: 6,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              platform: { type: 'string' },
              effort: { type: 'string' },
              goal: { type: 'string' },
              theme: { type: 'string' },
              hook: { type: 'string' },
              scenes: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 8 },
              voiceover: { type: 'string' },
              script: { type: 'string' },
              caption: { type: 'string' },
              hashtags: { type: 'string' }
            },
            required: ['title', 'platform', 'effort', 'goal', 'theme', 'hook', 'scenes', 'voiceover', 'script', 'caption', 'hashtags']
          }
        }
      },
      required: ['ideas']
    };

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Erstelle Content-Ideen auf Basis dieser Eingaben:\n${JSON.stringify(userPrompt, null, 2)}` }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'menu_letters_content_ideas',
            schema,
            strict: true
          }
        }
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return json({ error: result.error?.message || 'OpenAI request failed', raw: result }, response.status);
    }

    const outputText = result.output_text || result.output?.flatMap((item: any) => item.content || []).find((content: any) => content.type === 'output_text')?.text;
    const parsed = JSON.parse(outputText);
    return json(parsed);
  } catch (error) {
    return json({ error: error?.message || String(error) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
