import OpenAI from 'openai';

let openai: OpenAI | null = null;

export function initOpenAI(apiKey: string) {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }
  console.log('API key', apiKey);

  if (!apiKey.startsWith('sk-')) {
    throw new Error('Invalid OpenAI API key format');
  }

  try {
    openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
    return true;
  } catch (error) {
    // Log error message but not the actual API key
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to initialize OpenAI client: ${errorMessage}`);
  }
}

export function isOpenAIInitialized(): boolean {
  const isInit = openai !== null;
  console.log('[OpenAI] isOpenAIInitialized called, returning:', isInit);
  return isInit;
}

// This function is deprecated - API keys should be configured through Settings > AI tab
export function ensureInitFromDefault(): boolean {
  console.warn('[OpenAI] ensureInitFromDefault is deprecated. Please configure API key in Settings > AI tab.');
  return false;
}

export async function convertToJSON(
  pdfText: string,
  options?: { model?: string },
) {
  if (!openai) {
    throw new Error(
      'OpenAI not initialized - call initOpenAI with your API key first',
    );
  }

  try {
    // Use a model that supports JSON mode
    const model = options?.model || 'gpt-4-turbo-preview';

    // JSON mode is supported in gpt-4-turbo and gpt-3.5-turbo models
    const supportsJsonMode =
      model.includes('gpt-4-turbo') ||
      model.includes('gpt-3.5-turbo') ||
      model.includes('gpt-4o');

    const response = await openai.chat.completions.create({
  model,
  messages: [
    {
      role: 'system',
      content: `ROLE: Information Extractor (deterministic)
STYLE: Be literal, concise, and schema-accurate. Do not guess beyond the text.

TASK
Read ONE document and decide if it is a resume/CV.
• If it IS a resume, output valid JSON matching ResumeExtractionSchema.
• If it is NOT a resume, output valid JSON matching NotResumeSchema.
• Output MUST be a single JSON object only. No markdown, no prose, no extra keys, no comments.

DECISION CHECKLIST (apply in order)
1) Resume signals (any strong signal → treat as resume):
   - Sections like "Experience", "Work History", "Education", "Skills", "Projects", "Certifications".
   - Multiple roles with org names + dates; bullets of responsibilities/achievements.
   - Contact block (email/phone/LinkedIn) near the top.
2) NOT a resume (choose NotResumeSchema) if:
   - The document is a job description, proposal, brochure, article, pitch deck, invoice, or generic company profile.
   - It lacks personal work-history records and looks informational/marketing/academic without the candidate's role history.
3) If ambiguous, prefer "resume" ONLY if there are 2+ role entries or one clear role + education + skills.

EXTRACTION RULES (strict)
• Source of truth: text inside the document only. Never invent entities.
• Dates: ISO "YYYY-MM" when month is present; otherwise "YYYY". Unknown → null.
• Arrays: must exist (use [] if empty). Do NOT return null for arrays.
• Strings: return "" if truly empty; otherwise concise content from the document.
• Bullet points: put each bullet/achievement as a separate string in "highlights".
• Metrics: capture numeric KPIs (%, $, counts, time) exactly as written when possible.
• Contact normalization:
  - phone: keep as-is from doc (light cleanup allowed, e.g., remove spaces).
  - email/urls: copy exact text; do not fabricate.
• Titles/companies/locations: copy as shown; avoid expansions unless explicitly present.
• Redact NOTHING unless the source is redacted.
• Never include additional fields beyond the chosen schema.

OUTPUT GUARANTEES
• Return EXACTLY one JSON object conforming to the respective schema.
• If a required field is missing from the doc, fill with "" (strings), null (nullable fields), or [] (arrays) per schema.
• Validate mentally against required fields before responding.

TINY EXAMPLES (for shape only; do not copy values)
# Resume example (shape only)
{
  "is_valid_resume": true,
  "document_title": "Jane Doe - Resume",
  "candidate": {
    "full_name": "Jane Doe",
    "current_titles": ["Senior Data Scientist"],
    "location": "Berlin, Germany"
  },
  "contact": {
    "email": "jane@example.com",
    "phone": "+49-123-4567",
    "website": null
  },
  "public_profiles": {
    "linkedin": "https://www.linkedin.com/in/janedoe",
    "github": null,
    "other": []
  },
  "summary": "Data scientist with 7+ years...",
  "metrics": [{"label":"Model ROI","value":"€1.2M"}],
  "experience": [
    {
      "title": "Senior Data Scientist",
      "company": "Acme Corp",
      "employment_type": null,
      "start_date": "2021-02",
      "end_date": null,
      "location": "Berlin",
      "highlights": ["Built X", "Improved Y by 15%"]
    }
  ],
  "education": [
    {
      "degree": "MSc Data Science",
      "institution": "TU Berlin",
      "start_date": "2017",
      "end_date": "2019",
      "focus": null
    }
  ],
  "skills": {
    "technical": ["Python","PyTorch"],
    "domains": ["NLP"],
    "leadership": []
  },
  "projects": [],
  "certifications": [],
  "awards": []
}

# Not-resume example (shape only)
{
  "is_valid_resume": false,
  "document_title": "Acme Corp - Senior DS Job Description",
  "doc_type": "job_description",
  "reason": "Describes a role and requirements; no personal work history."
}

=== ResumeExtractionSchema (JSON Schema draft-07) ===
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ResumeExtractionSchema",
  "type": "object",
  "required": ["is_valid_resume","document_title","candidate","contact","summary","experience","education","skills","projects","certifications","awards","public_profiles","metrics"],
  "properties": {
    "is_valid_resume": { "type": "boolean", "const": true },
    "document_title": { "type": "string" },
    "candidate": {
      "type": "object",
      "required": ["full_name","current_titles","location"],
      "properties": {
        "full_name": { "type": "string" },
        "current_titles": { "type": "array", "items": { "type": "string" } },
        "location": { "type": "string" }
      }
    },
    "contact": {
      "type": "object",
      "required": ["email","phone"],
      "properties": {
        "email": { "type": "string" },
        "phone": { "type": "string" },
        "website": { "type": ["string","null"] }
      }
    },
    "public_profiles": {
      "type": "object",
      "properties": {
        "linkedin": { "type": ["string","null"] },
        "github": { "type": ["string","null"] },
        "other": { "type": "array", "items": { "type": "string" } }
      }
    },
    "summary": { "type": "string" },
    "metrics": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["label","value"],
        "properties": {
          "label": { "type": "string" },
          "value": { "type": "string" }
        }
      }
    },
    "experience": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["title","company","start_date","end_date","location","highlights"],
        "properties": {
          "title": { "type": "string" },
          "company": { "type": "string" },
          "employment_type": { "type": ["string","null"] },
          "start_date": { "type": ["string","null"] },
          "end_date": { "type": ["string","null"] },
          "location": { "type": "string" },
          "highlights": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "education": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["degree","institution","start_date","end_date"],
        "properties": {
          "degree": { "type": "string" },
          "institution": { "type": "string" },
          "start_date": { "type": ["string","null"] },
          "end_date": { "type": ["string","null"] },
          "focus": { "type": ["string","null"] }
        }
      }
    },
    "skills": {
      "type": "object",
      "properties": {
        "technical": { "type": "array", "items": { "type": "string" } },
        "domains": { "type": "array", "items": { "type": "string" } },
        "leadership": { "type": "array", "items": { "type": "string" } }
      }
    },
    "projects": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name","highlights"],
        "properties": {
          "name": { "type": "string" },
          "highlights": { "type": "array", "items": { "type": "string" } },
          "impact": { "type": ["string","null"] }
        }
      }
    },
    "certifications": { "type": "array", "items": { "type": "string" } },
    "awards": { "type": "array", "items": { "type": "string" } }
  }
}

=== NotResumeSchema (JSON Schema draft-07) ===
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "NotResumeSchema",
  "type": "object",
  "required": ["is_valid_resume","document_title","doc_type","reason"],
  "properties": {
    "is_valid_resume": { "type": "boolean", "const": false },
    "document_title": { "type": "string" },
    "doc_type": { "type": "string" },
    "reason": { "type": "string" }
  }
}`
    },
    {
      role: 'user',
      content: `Analyze the following document text and determine if it's a resume/CV. If it is a resume, extract structured data according to ResumeExtractionSchema. If it's not a resume, use NotResumeSchema. Return only valid JSON:\n\n${pdfText}`
    }
  ],
  temperature: 0.1,
  ...(supportsJsonMode && { response_format: { type: 'json_object' } }),
});

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    // Try to parse and format the JSON for better readability
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch (parseError) {
      // If it's not valid JSON, return as-is (might still be useful)
      console.warn('OpenAI response is not valid JSON, returning as-is');
      return content;
    }
  } catch (error) {
    // Log error but avoid exposing sensitive details
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to convert PDF content to JSON: ${errorMessage}`);
  }
}
