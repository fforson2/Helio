import { Property } from "@/types/property";

export type SketchfabArchetype =
  | "single_family"
  | "ranch"
  | "townhouse"
  | "condo"
  | "luxury";

export type TourRendererChoice =
  | {
      mode: "sketchfab";
      archetype: SketchfabArchetype;
      uid: string;
      reason: string;
      confidence: number;
    }
  | {
      mode: "threejs";
      archetype: SketchfabArchetype | "unmapped";
      reason: string;
      confidence: number;
    };

type ArchetypeDecision = {
  archetype: SketchfabArchetype | "unmapped";
  confidence: number;
  reason: string;
};

type SketchfabModel = {
  uid: string;
  label: string;
};

const DEFAULT_SKETCHFAB_MODELS: Record<SketchfabArchetype, SketchfabModel[]> = {
  single_family: [
    { uid: "798ffaeadacf4e08a2665785422fb45d", label: "American House" },
    { uid: "efcc220c62f641d29a1480e8b221c7b3", label: "Suburban House" },
    { uid: "ce4e461285e74456ade764c772da14dc", label: "Suburban Home" },
  ],
  ranch: [
    { uid: "ba186138e81643b087cddb92c9e8e2f3", label: "Modern Ranch Home" },
    { uid: "bf05539cbf5e4d7a9305de54b746700f", label: "Stucco Ranch" },
  ],
  townhouse: [
    { uid: "9ba7b382052e4ad5b7b671ee7890f1e6", label: "Townhouse" },
    { uid: "182a0ecb950749098f81982ff760fd8c", label: "NYC Town House" },
    { uid: "449d873dcca0409bb73b6b801ff36bed", label: "NYC Homes" },
  ],
  condo: [
    { uid: "a8347279e7b64ca3833f875e22ed9b34", label: "Condo Building" },
    { uid: "b3e16399830045a7b67ec8e02447fd27", label: "Miami Style Condominium" },
    { uid: "2f326604f2c34a09b3dcf3d6f8e3fd4b", label: "Vizcayne Condo" },
  ],
  luxury: [
    { uid: "8ac31a2a8c2540708ec98d916cb2ffb5", label: "Luxury Modern House" },
    { uid: "9d6b738250f74201998d05449c090445", label: "Luxury Villa Pool House" },
    { uid: "0e858284939343cb994233d40a48a20a", label: "Luxury Villa With Pool" },
  ],
};

function parseEnvModelList(key: SketchfabArchetype): SketchfabModel[] {
  const raw = process.env[`SKETCHFAB_MODEL_${key.toUpperCase()}`]?.trim();
  if (!raw) return DEFAULT_SKETCHFAB_MODELS[key];

  return raw
    .split(",")
    .map((uid) => uid.trim())
    .filter(Boolean)
    .map((uid, index) => ({
      uid,
      label: `${key.replace(/_/g, " ")} ${index + 1}`,
    }));
}

const SKETCHFAB_MODELS: Record<SketchfabArchetype, SketchfabModel[]> = {
  single_family: parseEnvModelList("single_family"),
  ranch: parseEnvModelList("ranch"),
  townhouse: parseEnvModelList("townhouse"),
  condo: parseEnvModelList("condo"),
  luxury: parseEnvModelList("luxury"),
};

function getOpenAIHeaders() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

function inferHeuristicArchetype(property: Property): ArchetypeDecision {
  const { propertyType, stories } = property.details;
  if (property.price > 1_200_000 || property.details.sqft > 3200) {
    return {
      archetype: "luxury",
      confidence: 0.62,
      reason: "Large or premium-priced listing is a better fit for a luxury archetype.",
    };
  }

  if (propertyType === "condo") {
    return {
      archetype: "condo",
      confidence: 0.78,
      reason: "The listing is explicitly a condo.",
    };
  }

  if (propertyType === "townhouse") {
    return {
      archetype: "townhouse",
      confidence: 0.78,
      reason: "The listing is explicitly a townhouse.",
    };
  }

  if (propertyType === "single_family" && (stories ?? 1) <= 1 && property.details.yearBuilt < 1995) {
    return {
      archetype: "ranch",
      confidence: 0.66,
      reason: "Older single-story single-family home maps well to a ranch archetype.",
    };
  }

  return {
    archetype: "single_family",
    confidence: 0.7,
    reason: "Defaulting to the generic single-family archetype.",
  };
}

async function classifyWithOpenAI(property: Property): Promise<ArchetypeDecision | null> {
  const headers = getOpenAIHeaders();
  if (!headers) return null;

  const availableArchetypes = Object.entries(SKETCHFAB_MODELS)
    .filter(([, value]) => value.length > 0)
    .map(([key]) => key);

  if (availableArchetypes.length === 0) return null;

  const propertyFacts = {
    address: property.location.address,
    city: property.location.city,
    state: property.location.state,
    propertyType: property.details.propertyType,
    beds: property.details.beds,
    baths: property.details.baths,
    sqft: property.details.sqft,
    yearBuilt: property.details.yearBuilt,
    stories: property.details.stories ?? 1,
    garage: property.details.garage ?? false,
    pool: property.details.pool ?? false,
    basement: property.details.basement ?? false,
    price: property.price,
    tags: property.tags,
    description: property.description,
  };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You choose the best 3D home archetype for a listing. Return JSON only with keys archetype, confidence, and reason. The archetype must be one of the provided options or 'unmapped'. Confidence is a number from 0 to 1.",
          },
          {
            role: "user",
            content: `Available archetypes: ${availableArchetypes.join(", ")}.

Property facts:
${JSON.stringify(propertyFacts, null, 2)}

Choose the best archetype for displaying a reusable 3D home model.`,
          },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ArchetypeDecision>;
    if (!parsed.archetype || typeof parsed.confidence !== "number" || !parsed.reason) {
      return null;
    }

    return {
      archetype: parsed.archetype,
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
      reason: parsed.reason,
    };
  } catch {
    return null;
  }
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickDeterministicModel(models: SketchfabModel[], seed: string) {
  return models[hashString(seed) % models.length];
}

function chooseSketchfabModel(property: Property, archetype: SketchfabArchetype) {
  const models = SKETCHFAB_MODELS[archetype];
  if (!models.length) return null;

  if (archetype === "single_family") {
    if (property.details.yearBuilt >= 2015) {
      return models.find((model) => model.label === "Suburban Home") ?? pickDeterministicModel(models, property.id);
    }
    if ((property.details.stories ?? 1) >= 3) {
      return models.find((model) => model.label === "Suburban Home") ?? pickDeterministicModel(models, property.id);
    }
    if (property.details.yearBuilt <= 1955) {
      return models.find((model) => model.label === "American House") ?? pickDeterministicModel(models, property.id);
    }
    if ((property.details.garage ?? false) || property.details.sqft >= 1800) {
      return models.find((model) => model.label === "Suburban House") ?? pickDeterministicModel(models, property.id);
    }
  }

  if (archetype === "ranch") {
    if (property.details.yearBuilt <= 1965) {
      return models.find((model) => model.label === "Stucco Ranch") ?? pickDeterministicModel(models, property.id);
    }
    return models.find((model) => model.label === "Modern Ranch Home") ?? pickDeterministicModel(models, property.id);
  }

  if (archetype === "townhouse") {
    if ((property.details.stories ?? 1) >= 3) {
      return models.find((model) => model.label === "NYC Town House") ?? pickDeterministicModel(models, property.id);
    }
    return pickDeterministicModel(models, property.location.city + property.id);
  }

  if (archetype === "condo") {
    if (property.price >= 1_500_000) {
      return models.find((model) => model.label === "Vizcayne Condo") ?? pickDeterministicModel(models, property.id);
    }
    if (property.location.city.toLowerCase().includes("miami")) {
      return models.find((model) => model.label === "Miami Style Condominium") ?? pickDeterministicModel(models, property.id);
    }
    return models.find((model) => model.label === "Condo Building") ?? pickDeterministicModel(models, property.id);
  }

  if (archetype === "luxury") {
    if (property.details.pool) {
      return models.find((model) => model.label === "Luxury Villa Pool House") ?? pickDeterministicModel(models, property.id);
    }
    if ((property.details.stories ?? 1) >= 3) {
      return models.find((model) => model.label === "Luxury Villa With Pool") ?? pickDeterministicModel(models, property.id);
    }
    return models.find((model) => model.label === "Luxury Modern House") ?? pickDeterministicModel(models, property.id);
  }

  return pickDeterministicModel(models, property.id);
}

export async function chooseTourRenderer(property: Property): Promise<TourRendererChoice> {
  const heuristic = inferHeuristicArchetype(property);
  const aiDecision = await classifyWithOpenAI(property);
  const selected =
    aiDecision &&
    !(
      aiDecision.archetype === "single_family" &&
      heuristic.archetype !== "single_family" &&
      heuristic.archetype !== "unmapped"
    )
      ? aiDecision
      : heuristic;

  if (
    selected.archetype !== "unmapped" &&
    SKETCHFAB_MODELS[selected.archetype].length > 0 &&
    selected.confidence >= 0.55
  ) {
    const model = chooseSketchfabModel(property, selected.archetype);
    if (!model) {
      return {
        mode: "threejs",
        archetype: selected.archetype,
        reason: `${selected.reason} Falling back because no Sketchfab model was selected for that archetype.`,
        confidence: selected.confidence,
      };
    }

    return {
      mode: "sketchfab",
      archetype: selected.archetype,
      uid: model.uid,
      reason: `${selected.reason} Using the ${model.label} Sketchfab model.`,
      confidence: selected.confidence,
    };
  }

  return {
    mode: "threejs",
    archetype: selected.archetype,
    reason:
      selected.archetype === "unmapped"
        ? "No mapped Sketchfab archetype matched this property."
        : `${selected.reason} Falling back because no Sketchfab model is configured for that archetype.`,
    confidence: selected.confidence,
  };
}
